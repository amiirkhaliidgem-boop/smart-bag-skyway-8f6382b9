-- D1: atomic claim for the notification outbox.
CREATE OR REPLACE FUNCTION public.notif_claim_batch_atomic(p_limit integer, p_max_attempts integer)
RETURNS SETOF public.notification_events
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.notification_events e
     SET state = 'sending', last_attempt_at = now()
   WHERE e.id IN (
     SELECT c.id FROM public.notification_events c
      WHERE c.state IN ('queued','failed')
        AND c.attempt_count < p_max_attempts
        AND c.next_attempt_at <= now()
      ORDER BY c.created_at
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
  RETURNING e.*;
$$;

REVOKE ALL ON FUNCTION public.notif_claim_batch_atomic(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_claim_batch_atomic(integer, integer) TO service_role;

-- D2: a bag tag may exist on only one case. Historic rows are left as they are;
-- the advisory lock makes the check race-proof for new registrations.
CREATE OR REPLACE FUNCTION public.case_bags_tag_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_tag text; v_other text;
BEGIN
  v_tag := upper(btrim(coalesce(NEW.bag_tag, '')));
  IF v_tag = '' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND upper(btrim(coalesce(OLD.bag_tag,''))) = v_tag
     AND OLD.case_id = NEW.case_id THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('case_bags:' || v_tag));

  SELECT c.case_no INTO v_other
    FROM public.case_bags b
    JOIN public.baggage_cases c ON c.id = b.case_id
   WHERE upper(btrim(b.bag_tag)) = v_tag
     AND b.id <> NEW.id
   LIMIT 1;

  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'Bag tag % is already registered on case %', NEW.bag_tag, v_other
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS case_bags_tag_unique_trg ON public.case_bags;
CREATE TRIGGER case_bags_tag_unique_trg
BEFORE INSERT OR UPDATE OF bag_tag, case_id ON public.case_bags
FOR EACH ROW EXECUTE FUNCTION public.case_bags_tag_unique();

CREATE INDEX IF NOT EXISTS case_bags_tag_upper_idx
  ON public.case_bags (upper(btrim(bag_tag)));

-- D3: one lock order everywhere — parent case first, then the delivery row.
CREATE OR REPLACE FUNCTION public.wf_assert_version(p_delivery uuid, p_expected_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v integer; v_case uuid;
BEGIN
  SELECT case_id INTO v_case FROM public.deliveries WHERE id = p_delivery;
  IF v_case IS NULL THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.baggage_cases WHERE id = v_case FOR UPDATE;

  SELECT version INTO v FROM public.deliveries WHERE id = p_delivery FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND v <> p_expected_version THEN
    RAISE EXCEPTION 'This record changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.wf_transition(
  p_delivery uuid,
  p_to public.delivery_stage,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d public.deliveries%ROWTYPE; v_from public.delivery_stage;
        v_ws public.workflow_status; v_ws_from public.workflow_status;
        v_case uuid;
BEGIN
  -- Lock the parent case before the delivery row. Lost & Found takes the same
  -- order, so the two engines can never deadlock against each other.
  SELECT case_id INTO v_case FROM public.deliveries WHERE id = p_delivery;
  IF v_case IS NULL THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.baggage_cases WHERE id = v_case FOR UPDATE;

  SELECT * INTO d FROM public.deliveries WHERE id = p_delivery FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;

  IF p_expected_version IS NOT NULL AND d.version <> p_expected_version THEN
    RAISE EXCEPTION 'This record changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;

  v_from := d.stage;
  IF v_from = p_to THEN RETURN d; END IF;
  IF NOT public.wf_stage_allowed(v_from, p_to) THEN
    RAISE EXCEPTION 'Cannot move a delivery from % to %', v_from, p_to USING ERRCODE = '23514';
  END IF;

  v_ws := public.wf_stage_workflow(p_to);
  v_ws_from := public.wf_stage_workflow(v_from);

  UPDATE public.deliveries SET
    stage = p_to,
    workflow_status = v_ws,
    accepted_at  = CASE WHEN p_to = 'Driver Accepted'     THEN now() ELSE accepted_at END,
    collected_at = CASE WHEN p_to = 'Collected Bag'       THEN now() ELSE collected_at END,
    started_at   = CASE WHEN p_to = 'Out for Delivery'    THEN now() ELSE started_at END,
    delivered_at = CASE WHEN p_to = 'Delivered'           THEN now() ELSE delivered_at END,
    failed_at    = CASE WHEN p_to = 'Delivery Failed'     THEN now() ELSE failed_at END,
    returned_at  = CASE WHEN p_to = 'Returned to Airport' THEN now() ELSE returned_at END
  WHERE id = p_delivery
  RETURNING * INTO d;

  UPDATE public.baggage_cases SET
    lf_status = public.wf_stage_lf(p_to),
    workflow_status = v_ws,
    resolved_at = CASE WHEN p_to = 'Delivered' THEN coalesce(resolved_at, now()) ELSE resolved_at END
  WHERE id = d.case_id;

  PERFORM public.wf_journal(d.case_id, d.id, v_ws_from, v_ws,
    v_from, p_to, 'delivery',
    format('Delivery %s → %s', d.delivery_no, p_to), coalesce(p_reason,''),
    'delivery.transition', p_reason, p_metadata);

  IF v_ws_from IS DISTINCT FROM v_ws THEN
    PERFORM public.wf_queue_notification(d.id, v_ws);
  END IF;

  PERFORM public.wf_refresh_passenger_view(d.id);
  RETURN d;
END;
$$;