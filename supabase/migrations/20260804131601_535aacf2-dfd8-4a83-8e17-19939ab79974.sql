-- 1. Passenger projection: always write an operational reference (PIR, else BAG no).
CREATE OR REPLACE FUNCTION public.wf_refresh_passenger_view(p_delivery uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.passenger_view (delivery_id, case_id, passenger_name, stage,
    workflow_status, pir_number, bag_tag, airline, flight_no, flight_date,
    otp_code, otp_state, delivered_at, updated_at)
  SELECT d.id, d.case_id, d.passenger_name, d.stage, d.workflow_status,
         coalesce(nullif(btrim(c.pir_number),''), c.case_no, d.delivery_no),
         (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = c.id ORDER BY b.seq LIMIT 1),
         c.airline, c.flight_number, c.arrival_date,
         o.code, o.state, d.delivered_at, now()
  FROM public.deliveries d
  JOIN public.baggage_cases c ON c.id = d.case_id
  LEFT JOIN LATERAL (
    SELECT code, state FROM public.otp_challenges
    WHERE delivery_id = d.id ORDER BY issued_at DESC LIMIT 1) o ON true
  WHERE d.id = p_delivery
  ON CONFLICT (delivery_id) DO UPDATE SET
    passenger_name = EXCLUDED.passenger_name, stage = EXCLUDED.stage,
    workflow_status = EXCLUDED.workflow_status, pir_number = EXCLUDED.pir_number,
    bag_tag = EXCLUDED.bag_tag, airline = EXCLUDED.airline,
    flight_no = EXCLUDED.flight_no, flight_date = EXCLUDED.flight_date,
    otp_code = EXCLUDED.otp_code, otp_state = EXCLUDED.otp_state,
    delivered_at = EXCLUDED.delivered_at, updated_at = now();
END; $function$;

-- 2. Handover journal title must not print an empty PIR.
CREATE OR REPLACE FUNCTION public.wf_open_delivery(p_case uuid)
RETURNS deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.baggage_cases%ROWTYPE; d public.deliveries%ROWTYPE; v_attempt integer;
BEGIN
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO d FROM public.deliveries
  WHERE case_id = p_case AND stage NOT IN ('Delivered','Delivery Failed','Returned to Airport')
  LIMIT 1;
  IF FOUND THEN
    PERFORM public.wf_ensure_passenger_link(d.id);
    PERFORM public.wf_refresh_passenger_view(d.id);
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
    format('Delivery %s opened for case %s', d.delivery_no,
           coalesce(nullif(btrim(c.pir_number),''), c.case_no)),
    'Ownership handed over from Lost & Found', 'delivery.open');

  PERFORM public.wf_ensure_passenger_link(d.id);
  PERFORM public.wf_refresh_passenger_view(d.id);
  RETURN d;
END; $function$;

-- 3. Timeline/audit reference falls back to the BAG number.
CREATE OR REPLACE FUNCTION public.wf_journal(p_case uuid, p_delivery uuid, p_from workflow_status, p_to workflow_status, p_from_stage delivery_stage, p_to_stage delivery_stage, p_module timeline_module, p_title text, p_detail text, p_action text, p_reason text DEFAULT ''::text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; v_ref text;
BEGIN
  SELECT * INTO a FROM public.wf_actor();
  SELECT coalesce(d.delivery_no, nullif(btrim(c.pir_number),''), c.case_no, '') INTO v_ref
  FROM public.baggage_cases c
  LEFT JOIN public.deliveries d ON d.id = p_delivery
  WHERE c.id = p_case;

  INSERT INTO public.workflow_events(case_id, delivery_id, from_status, to_status,
    from_stage, to_stage, actor_user_id, actor_name, actor_role, reason, metadata)
  VALUES (p_case, p_delivery, p_from, p_to, p_from_stage, p_to_stage,
    auth.uid(), coalesce(a.display_name,'System'), a.role_key, coalesce(p_reason,''), p_metadata);

  INSERT INTO public.timeline_events(module, case_id, delivery_id, reference, title,
    detail, status, actor_user_id, actor_name, metadata)
  VALUES (p_module, p_case, p_delivery, coalesce(v_ref,''), p_title, coalesce(p_detail,''),
    coalesce(p_to::text,''), auth.uid(), coalesce(a.display_name,'System'), p_metadata);

  INSERT INTO public.audit_events(actor_user_id, actor_name, actor_role, action,
    entity_type, entity_id, case_id, delivery_id, note, metadata)
  VALUES (auth.uid(), coalesce(a.display_name,'System'), a.role_key, p_action,
    CASE WHEN p_delivery IS NOT NULL THEN 'delivery' ELSE 'case' END,
    coalesce(v_ref,''), p_case, p_delivery, coalesce(p_detail,''), p_metadata);
END; $function$;

-- 4. Backfill existing projection rows that drifted from the case reference.
UPDATE public.passenger_view v
   SET pir_number = coalesce(nullif(btrim(c.pir_number),''), c.case_no),
       updated_at = now()
  FROM public.baggage_cases c
 WHERE c.id = v.case_id
   AND v.pir_number IS DISTINCT FROM coalesce(nullif(btrim(c.pir_number),''), c.case_no);