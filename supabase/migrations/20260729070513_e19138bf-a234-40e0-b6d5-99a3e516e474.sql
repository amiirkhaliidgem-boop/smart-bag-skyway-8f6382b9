-- 1. Version assertion helper: locks the row and checks the version BEFORE any write.
CREATE OR REPLACE FUNCTION public.wf_assert_version(p_delivery uuid, p_expected_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v integer;
BEGIN
  SELECT version INTO v FROM public.deliveries WHERE id = p_delivery FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND v <> p_expected_version THEN
    RAISE EXCEPTION 'This record changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.wf_assert_version(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_assert_version(uuid, integer) TO authenticated, service_role;

-- 2. Passenger tracking link: idempotent, reusable from delivery creation and assignment.
CREATE OR REPLACE FUNCTION public.wf_ensure_passenger_link(p_delivery uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_token text; v_case uuid;
BEGIN
  SELECT token INTO v_token FROM public.passenger_links
   WHERE delivery_id = p_delivery AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY issued_at DESC LIMIT 1;
  IF v_token IS NOT NULL THEN RETURN v_token; END IF;

  SELECT case_id INTO v_case FROM public.deliveries WHERE id = p_delivery;
  IF v_case IS NULL THEN RETURN NULL; END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.passenger_links(token, delivery_id, case_id, channel, expires_at)
  VALUES (v_token, p_delivery, v_case, 'sms', now() + interval '30 days');
  RETURN v_token;
END; $$;

REVOKE EXECUTE ON FUNCTION public.wf_ensure_passenger_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_ensure_passenger_link(uuid) TO authenticated, service_role;

-- 3. Mint the tracking link at hand-over time.
CREATE OR REPLACE FUNCTION public.wf_open_delivery(p_case uuid)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE c public.baggage_cases%ROWTYPE; d public.deliveries%ROWTYPE; v_attempt integer;
BEGIN
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO d FROM public.deliveries
  WHERE case_id = p_case AND stage NOT IN ('Delivered','Delivery Failed','Returned to Airport')
  LIMIT 1;
  IF FOUND THEN
    PERFORM public.wf_ensure_passenger_link(d.id);
    RETURN d;
  END IF;

  SELECT coalesce(max(attempt_no),0) + 1 INTO v_attempt FROM public.deliveries WHERE case_id = p_case;

  INSERT INTO public.deliveries(delivery_no, case_id, station_id, stage, workflow_status,
    priority, delivery_type, passenger_name, mobile, address, dest_lat, dest_lng,
    attempt_no, created_by)
  VALUES (public.next_delivery_no(), c.id, c.station_id, 'Ready for Delivery',
    'READY_FOR_COLLECTION', c.priority, c.delivery_method, c.passenger_name,
    c.contact_mobile, c.full_address, c.dest_lat, c.dest_lng, v_attempt,
    public.current_app_user_id())
  RETURNING * INTO d;

  PERFORM public.wf_journal(c.id, d.id, c.workflow_status, 'READY_FOR_COLLECTION',
    NULL, 'Ready for Delivery', 'delivery',
    format('Delivery %s opened for case %s', d.delivery_no, c.pir_number),
    'Ownership handed over from Lost & Found', 'delivery.open');

  PERFORM public.wf_ensure_passenger_link(d.id);
  PERFORM public.wf_refresh_passenger_view(d.id);
  RETURN d;
END; $$;

-- 4. Assign agent: version check first, then writes, then transition with no re-check.
CREATE OR REPLACE FUNCTION public.dm_assign_agent(p_delivery uuid, p_agent uuid, p_expected_version integer DEFAULT NULL::integer)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE d public.deliveries%ROWTYPE; v_code text;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  IF NOT EXISTS (SELECT 1 FROM public.app_users u
                 WHERE u.id = p_agent AND u.user_type = 'driver' AND u.status = 'Active') THEN
    RAISE EXCEPTION 'Selected user is not an active Delivery Agent' USING ERRCODE = '23514';
  END IF;

  PERFORM public.wf_assert_version(p_delivery, p_expected_version);

  UPDATE public.deliveries
     SET assigned_agent_id = p_agent, assigned_at = now()
   WHERE id = p_delivery;

  -- One-time code
  UPDATE public.otp_challenges SET state = 'Expired'
   WHERE delivery_id = p_delivery AND state IN ('Pending','Sent');
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  INSERT INTO public.otp_challenges(delivery_id, code, state, expires_at, issued_by)
  VALUES (p_delivery, v_code, 'Sent', now() + interval '24 hours', auth.uid());

  -- Passenger tracking link (idempotent)
  PERFORM public.wf_ensure_passenger_link(p_delivery);

  d := public.wf_transition(p_delivery, 'Assigned', 'Delivery Agent assigned',
        jsonb_build_object('agent_id', p_agent), NULL);

  PERFORM public.wf_recompute_route(p_agent);
  RETURN d;
END; $$;

-- 5. Schedule: same ordering fix.
CREATE OR REPLACE FUNCTION public.dm_schedule(p_delivery uuid, p_scheduled_for timestamp with time zone, p_expected_version integer DEFAULT NULL::integer)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  PERFORM public.wf_assert_version(p_delivery, p_expected_version);
  UPDATE public.deliveries SET scheduled_for = p_scheduled_for WHERE id = p_delivery;
  RETURN public.wf_transition(p_delivery, 'Scheduled', 'Scheduled by dispatcher',
    jsonb_build_object('scheduled_for', p_scheduled_for), NULL);
END; $$;

-- 6. Mark failed: same ordering fix.
CREATE OR REPLACE FUNCTION public.dm_mark_failed(p_delivery uuid, p_reason_code text, p_note text DEFAULT ''::text, p_expected_version integer DEFAULT NULL::integer)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_reason uuid;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','driver']);
  SELECT id INTO v_reason FROM public.failure_reasons WHERE code = p_reason_code AND active;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Unknown failure reason: %', p_reason_code USING ERRCODE = '23514';
  END IF;
  PERFORM public.wf_assert_version(p_delivery, p_expected_version);
  UPDATE public.deliveries
     SET failure_reason_id = v_reason, failure_note = coalesce(p_note,'')
   WHERE id = p_delivery;
  RETURN public.wf_transition(p_delivery, 'Delivery Failed', coalesce(p_note,''),
    jsonb_build_object('reason', p_reason_code), NULL);
END; $$;

-- 7. Mark returned: assert up front for consistent error semantics.
CREATE OR REPLACE FUNCTION public.dm_mark_returned(p_delivery uuid, p_expected_version integer DEFAULT NULL::integer)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  PERFORM public.wf_assert_version(p_delivery, p_expected_version);
  RETURN public.wf_transition(p_delivery, 'Returned to Airport',
    'Baggage returned to airport', '{}'::jsonb, NULL);
END; $$;

-- 8. Agent advance: version check before the un-assign write.
CREATE OR REPLACE FUNCTION public.agent_advance(p_delivery uuid, p_to delivery_stage, p_expected_version integer DEFAULT NULL::integer)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.wf_require(ARRAY['driver']);
  IF NOT public.agent_owns(p_delivery) AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'This delivery is not assigned to you' USING ERRCODE = '42501';
  END IF;
  IF p_to NOT IN ('Driver Accepted','Collected Bag','Out for Delivery','Scheduled') THEN
    RAISE EXCEPTION 'Delivery Agents cannot move a delivery to %', p_to USING ERRCODE = '42501';
  END IF;
  PERFORM public.wf_assert_version(p_delivery, p_expected_version);
  IF p_to = 'Scheduled' THEN
    UPDATE public.deliveries SET assigned_agent_id = NULL, assigned_at = NULL
     WHERE id = p_delivery;
  END IF;
  RETURN public.wf_transition(p_delivery, p_to, 'Delivery Agent action', '{}'::jsonb, NULL);
END; $$;

-- 9. Backfill: every live delivery gets a tracking link and a fresh passenger view.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.deliveries LOOP
    PERFORM public.wf_ensure_passenger_link(r.id);
    PERFORM public.wf_refresh_passenger_view(r.id);
  END LOOP;
END; $$;