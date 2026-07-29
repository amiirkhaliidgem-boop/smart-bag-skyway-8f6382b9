CREATE OR REPLACE FUNCTION public.wf_transition(p_delivery uuid, p_to delivery_stage, p_reason text DEFAULT ''::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_expected_version integer DEFAULT NULL::integer)
 RETURNS deliveries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d public.deliveries%ROWTYPE; v_from public.delivery_stage;
        v_ws public.workflow_status; v_ws_from public.workflow_status;
BEGIN
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

  -- Passenger-facing messages are keyed on the workflow status, so only send
  -- when that status actually changes (Assigned → Driver Accepted must not
  -- re-send the assignment SMS/WhatsApp).
  IF v_ws_from IS DISTINCT FROM v_ws THEN
    PERFORM public.wf_queue_notification(d.id, v_ws);
  END IF;

  PERFORM public.wf_refresh_passenger_view(d.id);
  RETURN d;
END; $function$;