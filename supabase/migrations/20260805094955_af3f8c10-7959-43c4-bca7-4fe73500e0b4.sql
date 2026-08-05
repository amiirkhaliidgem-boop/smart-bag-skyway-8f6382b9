-- ============================================================
-- D4: bounded lock acquisition + lock-failure -> business conflict
-- ============================================================

CREATE OR REPLACE FUNCTION public.wf_lock_case(p_case uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET lock_timeout TO '2s'
AS $function$
BEGIN
  PERFORM 1 FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
EXCEPTION
  WHEN lock_not_available OR query_canceled THEN
    RAISE EXCEPTION 'This record is being updated by someone else right now. Reload and try again.'
      USING ERRCODE = '40001';
END; $function$;

CREATE OR REPLACE FUNCTION public.wf_lock_delivery(p_delivery uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET lock_timeout TO '2s'
AS $function$
BEGIN
  PERFORM 1 FROM public.deliveries WHERE id = p_delivery FOR UPDATE;
EXCEPTION
  WHEN lock_not_available OR query_canceled THEN
    RAISE EXCEPTION 'This record is being updated by someone else right now. Reload and try again.'
      USING ERRCODE = '40001';
END; $function$;

REVOKE ALL ON FUNCTION public.wf_lock_case(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wf_lock_delivery(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- wf_assert_version: case -> delivery, both bounded
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wf_assert_version(p_delivery uuid, p_expected_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET lock_timeout TO '2s'
AS $function$
DECLARE v integer; v_case uuid;
BEGIN
  SELECT case_id INTO v_case FROM public.deliveries WHERE id = p_delivery;
  IF v_case IS NULL THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.wf_lock_case(v_case);
  PERFORM public.wf_lock_delivery(p_delivery);

  SELECT version INTO v FROM public.deliveries WHERE id = p_delivery;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND v <> p_expected_version THEN
    RAISE EXCEPTION 'This record changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;
END; $function$;

-- ------------------------------------------------------------
-- wf_transition
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wf_transition(p_delivery uuid, p_to delivery_stage, p_reason text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_expected_version integer DEFAULT NULL::integer)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET lock_timeout TO '2s'
AS $function$
DECLARE d public.deliveries%ROWTYPE; v_from public.delivery_stage;
        v_ws public.workflow_status; v_ws_from public.workflow_status;
        v_case uuid;
BEGIN
  -- Canonical lock order: parent case first, then the delivery row. Bounded by
  -- lock_timeout so a contended writer gets a business conflict, never a hang.
  SELECT case_id INTO v_case FROM public.deliveries WHERE id = p_delivery;
  IF v_case IS NULL THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.wf_lock_case(v_case);
  PERFORM public.wf_lock_delivery(p_delivery);

  SELECT * INTO d FROM public.deliveries WHERE id = p_delivery;
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
END; $function$;

-- ------------------------------------------------------------
-- lf_set_status
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lf_set_status(p_case uuid, p_status lf_status, p_expected_version integer DEFAULT NULL::integer)
RETURNS baggage_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET lock_timeout TO '2s'
AS $function$
DECLARE c public.baggage_cases%ROWTYPE; v_from public.lf_status; v_allowed public.lf_status[];
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  PERFORM public.wf_lock_case(p_case);
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND c.version <> p_expected_version THEN
    RAISE EXCEPTION 'This case changed since you opened it. Reload and try again.' USING ERRCODE = '40001';
  END IF;

  v_allowed := public.lf_allowed_statuses(c.delivery_method);
  IF NOT (p_status = ANY (v_allowed)) THEN
    IF c.delivery_method = 'Airport Pickup' THEN
      RAISE EXCEPTION '% is not part of the Airport Pickup workflow.', p_status USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'Lost & Found ownership ends at Ready for Delivery. % is owned by Delivery Management.', p_status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF c.delivery_method <> 'Airport Pickup'
     AND EXISTS (SELECT 1 FROM public.deliveries d WHERE d.case_id = p_case AND d.stage <> 'Ready for Delivery') THEN
    RAISE EXCEPTION 'This case has been handed over to Delivery Management and is read-only here.' USING ERRCODE = '42501';
  END IF;

  v_from := c.lf_status;
  IF v_from = p_status THEN RETURN c; END IF;

  UPDATE public.baggage_cases SET
    lf_status = p_status,
    workflow_status = public.wf_lf_workflow(p_status),
    resolved_at = CASE WHEN p_status = 'Passenger Picked Up' THEN now() ELSE resolved_at END
  WHERE id = p_case RETURNING * INTO c;

  PERFORM public.wf_journal(p_case, NULL, public.wf_lf_workflow(v_from), c.workflow_status,
    NULL, NULL, 'lost_found',
    format('Case %s → %s', coalesce(nullif(c.pir_number,''), c.case_no), p_status),
    format('Case status changed from %s to %s', v_from, p_status), 'case.status');

  IF c.delivery_method = 'Airport Pickup' THEN
    IF p_status = 'Ready for Airport Pickup' THEN
      PERFORM public.wf_ensure_case_link(p_case);
      PERFORM public.wf_queue_case_notification(p_case, 'READY_FOR_AIRPORT_PICKUP');
    ELSIF p_status = 'Passenger Picked Up' THEN
      PERFORM public.wf_queue_case_notification(p_case, 'PASSENGER_PICKED_UP');
    END IF;
  ELSIF p_status = 'Ready for Delivery' THEN
    PERFORM public.wf_open_delivery(p_case);
  END IF;
  RETURN c;
END; $function$;

-- ------------------------------------------------------------
-- wf_open_delivery
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wf_open_delivery(p_case uuid)
RETURNS deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET lock_timeout TO '2s'
AS $function$
DECLARE c public.baggage_cases%ROWTYPE; d public.deliveries%ROWTYPE; v_attempt integer;
BEGIN
  PERFORM public.wf_lock_case(p_case);
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case;
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

-- ------------------------------------------------------------
-- lf_update_case (locking preamble only; body unchanged)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lf_update_case(p_case uuid, p_payload jsonb, p_expected_version integer DEFAULT NULL::integer)
RETURNS baggage_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET lock_timeout TO '2s'
AS $function$
DECLARE c public.baggage_cases%ROWTYPE; v_tags text[]; t text; i integer := 0;
        v_prev_officer uuid; v_officer_name text; v_detail text;
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  PERFORM public.wf_lock_case(p_case);
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND c.version <> p_expected_version THEN
    RAISE EXCEPTION 'This case changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;

  v_prev_officer := c.assigned_officer_id;

  UPDATE public.baggage_cases SET
    pir_number = CASE WHEN p_payload ? 'pir_number'
      THEN nullif(btrim(coalesce(p_payload->>'pir_number','')),'') ELSE pir_number END,
    passenger_name = coalesce(p_payload->>'passenger_name', passenger_name),
    passenger_first_name = coalesce(p_payload->>'passenger_first_name', passenger_first_name),
    passenger_middle_name = coalesce(p_payload->>'passenger_middle_name', passenger_middle_name),
    passenger_last_name = coalesce(p_payload->>'passenger_last_name', passenger_last_name),
    nationality = coalesce(p_payload->>'nationality', nationality),
    passport_number = coalesce(p_payload->>'passport_number', passport_number),
    pnr = coalesce(p_payload->>'pnr', pnr),
    ticket_number = coalesce(p_payload->>'ticket_number', ticket_number),
    contact_mobile = coalesce(p_payload->>'contact_mobile', contact_mobile),
    contact_mobile_alt = coalesce(p_payload->>'contact_mobile_alt', contact_mobile_alt),
    email = coalesce(p_payload->>'email', email),
    airline = coalesce(p_payload->>'airline', airline),
    flight_number = coalesce(p_payload->>'flight_number', flight_number),
    arrival_date = coalesce(nullif(p_payload->>'arrival_date','')::date, arrival_date),
    arrival_time = coalesce(p_payload->>'arrival_time', arrival_time),
    origin_airport = coalesce(p_payload->>'origin_airport', origin_airport),
    destination_airport = coalesce(p_payload->>'destination_airport', destination_airport),
    terminal = coalesce(p_payload->>'terminal', terminal),
    arrival_belt = coalesce(p_payload->>'arrival_belt', arrival_belt),
    number_of_bags = coalesce(nullif(p_payload->>'number_of_bags','')::int, number_of_bags),
    weight_kg = coalesce(nullif(p_payload->>'weight_kg','')::numeric, weight_kg),
    bag_brand = coalesce(p_payload->>'bag_brand', bag_brand),
    bag_color = coalesce(p_payload->>'bag_color', bag_color),
    bag_type = coalesce(p_payload->>'bag_type', bag_type),
    bag_size = coalesce(p_payload->>'bag_size', bag_size),
    distinctive_marks = coalesce(p_payload->>'distinctive_marks', distinctive_marks),
    fragile = coalesce((p_payload->>'fragile')::boolean, fragile),
    rush_delivery = coalesce((p_payload->>'rush_delivery')::boolean, rush_delivery),
    description = coalesce(p_payload->>'description', description),
    priority = coalesce((p_payload->>'priority')::public.case_priority, priority),
    delivery_method = coalesce((p_payload->>'delivery_method')::public.delivery_method, delivery_method),
    full_address = coalesce(p_payload->>'full_address', full_address),
    preferred_delivery_time = coalesce(p_payload->>'preferred_delivery_time', preferred_delivery_time),
    google_maps_link = coalesce(p_payload->>'google_maps_link', google_maps_link),
    dest_lat = coalesce(nullif(p_payload->>'dest_lat','')::double precision, dest_lat),
    dest_lng = coalesce(nullif(p_payload->>'dest_lng','')::double precision, dest_lng),
    storage_zone = coalesce(p_payload->>'storage_zone', storage_zone),
    storage_shelf = coalesce(p_payload->>'storage_shelf', storage_shelf),
    storage_position = coalesce(p_payload->>'storage_position', storage_position),
    assigned_officer_id = CASE WHEN p_payload ? 'assigned_officer_id'
      THEN nullif(btrim(coalesce(p_payload->>'assigned_officer_id','')),'')::uuid
      ELSE assigned_officer_id END,
    department = coalesce(p_payload->>'department', department),
    internal_notes = coalesce(p_payload->>'internal_notes', internal_notes),
    incomplete = coalesce((p_payload->>'incomplete')::boolean, incomplete),
    missing_fields = CASE WHEN p_payload ? 'missing_fields'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_payload->'missing_fields'))
      ELSE missing_fields END
  WHERE id = p_case RETURNING * INTO c;

  IF p_payload ? 'bag_tags' THEN
    DELETE FROM public.case_bags WHERE case_id = p_case;
    v_tags := ARRAY(SELECT jsonb_array_elements_text(p_payload->'bag_tags'));
    FOREACH t IN ARRAY v_tags LOOP
      i := i + 1;
      IF btrim(t) <> '' THEN
        INSERT INTO public.case_bags(case_id, bag_tag, seq) VALUES (p_case, btrim(t), i)
        ON CONFLICT (case_id, bag_tag) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  IF c.assigned_officer_id IS DISTINCT FROM v_prev_officer THEN
    SELECT u.full_name INTO v_officer_name FROM public.app_users u WHERE u.id = c.assigned_officer_id;
    v_detail := CASE WHEN c.assigned_officer_id IS NULL
      THEN 'Officer unassigned'
      ELSE format('Officer assigned: %s', coalesce(v_officer_name,'Unknown')) END;
    PERFORM public.wf_journal(p_case, NULL, c.workflow_status, c.workflow_status, NULL, NULL,
      'lost_found', format('Case %s · %s', coalesce(nullif(c.pir_number,''), c.case_no), v_detail),
      v_detail, 'case.assign_officer');
  ELSE
    PERFORM public.wf_journal(p_case, NULL, c.workflow_status, c.workflow_status, NULL, NULL,
      'lost_found', format('Case %s updated', coalesce(nullif(c.pir_number,''), c.case_no)), '', 'case.update');
  END IF;

  RETURN c;
END; $function$;

-- ------------------------------------------------------------
-- Bound every other mutating entry point
-- ------------------------------------------------------------
ALTER FUNCTION public.lf_create_case(jsonb) SET lock_timeout TO '2s';
ALTER FUNCTION public.lf_bulk_set_status(uuid[], lf_status) SET lock_timeout TO '5s';
ALTER FUNCTION public.lf_set_region(uuid, uuid) SET lock_timeout TO '2s';
ALTER FUNCTION public.dm_assign_agent(uuid, uuid, integer) SET lock_timeout TO '2s';
ALTER FUNCTION public.dm_schedule(uuid, timestamptz, integer) SET lock_timeout TO '2s';
ALTER FUNCTION public.dm_mark_failed(uuid, text, text, integer) SET lock_timeout TO '2s';
ALTER FUNCTION public.dm_mark_returned(uuid, text, text, integer) SET lock_timeout TO '2s';
ALTER FUNCTION public.dm_add_note(uuid, text) SET lock_timeout TO '2s';
ALTER FUNCTION public.dm_resend_otp(uuid) SET lock_timeout TO '2s';
ALTER FUNCTION public.agent_advance(uuid, delivery_stage, integer) SET lock_timeout TO '2s';
ALTER FUNCTION public.agent_complete_delivery(uuid, text) SET lock_timeout TO '2s';

-- ------------------------------------------------------------
-- Abandoned sessions can no longer hold row locks forever
-- ------------------------------------------------------------
ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE anon SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE authenticated SET lock_timeout = '4s';
ALTER ROLE anon SET lock_timeout = '3s';