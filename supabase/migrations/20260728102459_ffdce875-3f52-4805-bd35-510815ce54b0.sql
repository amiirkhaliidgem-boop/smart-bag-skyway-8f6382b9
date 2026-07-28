-- ============================================================
-- Phase 1 · Migration 5 — Operation API
-- ============================================================

CREATE OR REPLACE FUNCTION public.wf_require(p_roles text[])
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles ur
             WHERE ur.user_id = auth.uid() AND ur.role::text = ANY(p_roles)) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'You do not have permission to perform this action'
    USING ERRCODE = '42501';
END; $$;
REVOKE EXECUTE ON FUNCTION public.wf_require(text[]) FROM PUBLIC, anon, authenticated;

-- ============ LOST & FOUND ============
CREATE OR REPLACE FUNCTION public.lf_create_case(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_station uuid; v_tags text[]; t text; i integer := 0;
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  SELECT id INTO v_station FROM public.stations WHERE is_default LIMIT 1;

  INSERT INTO public.baggage_cases (
    case_no, pir_number, station_id, priority, passenger_name,
    passenger_first_name, passenger_middle_name, passenger_last_name,
    nationality, passport_number, pnr, ticket_number, contact_mobile,
    contact_mobile_alt, email, airline, flight_number, arrival_date, arrival_time,
    origin_airport, destination_airport, terminal, arrival_belt, number_of_bags,
    weight_kg, bag_brand, bag_color, bag_type, bag_size, distinctive_marks,
    fragile, rush_delivery, description, delivery_method, full_address,
    preferred_delivery_time, google_maps_link, dest_lat, dest_lng,
    department, internal_notes, incomplete, missing_fields, created_by)
  VALUES (
    public.next_case_no(),
    nullif(btrim(p_payload->>'pir_number'),''),
    v_station,
    coalesce((p_payload->>'priority')::public.case_priority, 'Normal'),
    coalesce(p_payload->>'passenger_name',''),
    p_payload->>'passenger_first_name', p_payload->>'passenger_middle_name',
    p_payload->>'passenger_last_name', p_payload->>'nationality',
    p_payload->>'passport_number', p_payload->>'pnr', p_payload->>'ticket_number',
    coalesce(p_payload->>'contact_mobile',''), p_payload->>'contact_mobile_alt',
    p_payload->>'email', coalesce(p_payload->>'airline',''),
    coalesce(p_payload->>'flight_number',''),
    nullif(p_payload->>'arrival_date','')::date, p_payload->>'arrival_time',
    p_payload->>'origin_airport', p_payload->>'destination_airport',
    p_payload->>'terminal', p_payload->>'arrival_belt',
    coalesce(nullif(p_payload->>'number_of_bags','')::int, 1),
    nullif(p_payload->>'weight_kg','')::numeric,
    p_payload->>'bag_brand', p_payload->>'bag_color', p_payload->>'bag_type',
    p_payload->>'bag_size', p_payload->>'distinctive_marks',
    coalesce((p_payload->>'fragile')::boolean, false),
    coalesce((p_payload->>'rush_delivery')::boolean, false),
    coalesce(p_payload->>'description',''),
    coalesce((p_payload->>'delivery_method')::public.delivery_method,'Home Delivery'),
    coalesce(p_payload->>'full_address',''), p_payload->>'preferred_delivery_time',
    p_payload->>'google_maps_link',
    nullif(p_payload->>'dest_lat','')::double precision,
    nullif(p_payload->>'dest_lng','')::double precision,
    coalesce(p_payload->>'department',''), coalesce(p_payload->>'internal_notes',''),
    coalesce((p_payload->>'incomplete')::boolean, false),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'missing_fields','[]'::jsonb))), '{}'),
    public.current_app_user_id())
  RETURNING id INTO v_id;

  v_tags := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_payload->'bag_tags','[]'::jsonb)));
  FOREACH t IN ARRAY v_tags LOOP
    i := i + 1;
    IF btrim(t) <> '' THEN
      INSERT INTO public.case_bags(case_id, bag_tag, seq) VALUES (v_id, btrim(t), i)
      ON CONFLICT (case_id, bag_tag) DO NOTHING;
    END IF;
  END LOOP;

  PERFORM public.wf_journal(v_id, NULL, NULL, 'PIR_CREATED', NULL, NULL, 'lost_found',
    format('Case %s created', p_payload->>'pir_number'), 'PIR registered', 'case.create');
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.lf_create_case(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.lf_update_case(
  p_case uuid, p_payload jsonb, p_expected_version integer DEFAULT NULL)
RETURNS public.baggage_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.baggage_cases%ROWTYPE; v_tags text[]; t text; i integer := 0;
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND c.version <> p_expected_version THEN
    RAISE EXCEPTION 'This case changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.baggage_cases SET
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

  PERFORM public.wf_journal(p_case, NULL, c.workflow_status, c.workflow_status, NULL, NULL,
    'lost_found', format('Case %s updated', c.pir_number), '', 'case.update');
  RETURN c;
END; $$;
GRANT EXECUTE ON FUNCTION public.lf_update_case(uuid, jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.lf_set_status(
  p_case uuid, p_status public.lf_status, p_expected_version integer DEFAULT NULL)
RETURNS public.baggage_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.baggage_cases%ROWTYPE; v_from public.lf_status;
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND c.version <> p_expected_version THEN
    RAISE EXCEPTION 'This case changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;

  IF p_status NOT IN ('Open','Tracing','Located','Arrived at Airport',
                      'Waiting Customs Clearance','Ready for Delivery') THEN
    RAISE EXCEPTION 'Lost & Found ownership ends at Ready for Delivery. % is owned by Delivery Management.', p_status
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.deliveries d WHERE d.case_id = p_case
             AND d.stage <> 'Ready for Delivery') THEN
    RAISE EXCEPTION 'This case has been handed over to Delivery Management and is read-only here.'
      USING ERRCODE = '42501';
  END IF;

  v_from := c.lf_status;
  IF v_from = p_status THEN RETURN c; END IF;

  UPDATE public.baggage_cases SET
    lf_status = p_status,
    workflow_status = CASE p_status
      WHEN 'Open' THEN 'PIR_CREATED' WHEN 'Tracing' THEN 'PIR_CREATED'
      WHEN 'Located' THEN 'HOME_DELIVERY_REQUESTED'
      WHEN 'Arrived at Airport' THEN 'DELIVERY_APPROVED'
      WHEN 'Waiting Customs Clearance' THEN 'DELIVERY_APPROVED'
      WHEN 'Ready for Delivery' THEN 'READY_FOR_COLLECTION'
      ELSE workflow_status END::public.workflow_status
  WHERE id = p_case RETURNING * INTO c;

  PERFORM public.wf_journal(p_case, NULL, NULL, c.workflow_status, NULL, NULL, 'lost_found',
    format('Case %s → %s', c.pir_number, p_status), '', 'case.status');

  IF p_status = 'Ready for Delivery' THEN
    PERFORM public.wf_open_delivery(p_case);
  END IF;
  RETURN c;
END; $$;
GRANT EXECUTE ON FUNCTION public.lf_set_status(uuid, public.lf_status, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.lf_bulk_set_status(p_cases uuid[], p_status public.lf_status)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; n integer := 0;
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  FOREACH v IN ARRAY p_cases LOOP
    BEGIN
      PERFORM public.lf_set_status(v, p_status, NULL);
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN n;
END; $$;
GRANT EXECUTE ON FUNCTION public.lf_bulk_set_status(uuid[], public.lf_status) TO authenticated;

-- ============ DISPATCH ============
CREATE OR REPLACE FUNCTION public.dm_schedule(
  p_delivery uuid, p_scheduled_for timestamptz, p_expected_version integer DEFAULT NULL)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deliveries%ROWTYPE;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  UPDATE public.deliveries SET scheduled_for = p_scheduled_for WHERE id = p_delivery;
  d := public.wf_transition(p_delivery, 'Scheduled', 'Scheduled by dispatcher',
        jsonb_build_object('scheduled_for', p_scheduled_for), p_expected_version);
  RETURN d;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_schedule(uuid, timestamptz, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_assign_agent(
  p_delivery uuid, p_agent uuid, p_expected_version integer DEFAULT NULL)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deliveries%ROWTYPE; v_code text; v_token text; v_case uuid;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  IF NOT EXISTS (SELECT 1 FROM public.app_users u
                 WHERE u.id = p_agent AND u.user_type = 'driver' AND u.status = 'Active') THEN
    RAISE EXCEPTION 'Selected user is not an active Delivery Agent' USING ERRCODE = '23514';
  END IF;

  SELECT case_id INTO v_case FROM public.deliveries WHERE id = p_delivery;
  UPDATE public.deliveries
     SET assigned_agent_id = p_agent, assigned_at = now()
   WHERE id = p_delivery;

  -- One-time code
  UPDATE public.otp_challenges SET state = 'Expired'
   WHERE delivery_id = p_delivery AND state IN ('Pending','Sent');
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  INSERT INTO public.otp_challenges(delivery_id, code, state, expires_at, issued_by)
  VALUES (p_delivery, v_code, 'Sent', now() + interval '24 hours', auth.uid());

  -- Passenger tracking link
  IF NOT EXISTS (SELECT 1 FROM public.passenger_links
                 WHERE delivery_id = p_delivery AND revoked_at IS NULL) THEN
    v_token := replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.passenger_links(token, delivery_id, case_id, channel, expires_at)
    VALUES (v_token, p_delivery, v_case, 'sms', now() + interval '30 days');
  END IF;

  d := public.wf_transition(p_delivery, 'Assigned', 'Delivery Agent assigned',
        jsonb_build_object('agent_id', p_agent), p_expected_version);
  RETURN d;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_assign_agent(uuid, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_resend_otp(p_delivery uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  UPDATE public.otp_challenges SET state = 'Expired'
   WHERE delivery_id = p_delivery AND state IN ('Pending','Sent');
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  INSERT INTO public.otp_challenges(delivery_id, code, state, expires_at, issued_by)
  VALUES (p_delivery, v_code, 'Sent', now() + interval '24 hours', auth.uid());
  PERFORM public.wf_queue_notification(p_delivery, 'DRIVER_ASSIGNED');
  PERFORM public.wf_refresh_passenger_view(p_delivery);
  PERFORM public.wf_journal(
    (SELECT case_id FROM public.deliveries WHERE id = p_delivery), p_delivery,
    NULL, 'DRIVER_ASSIGNED', NULL, NULL, 'otp', 'One-time code re-issued', '', 'otp.reissue');
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_resend_otp(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_add_note(p_delivery uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_id uuid;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','agent','driver']);
  IF btrim(coalesce(p_body,'')) = '' THEN
    RAISE EXCEPTION 'Note cannot be empty' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO a FROM public.wf_actor();
  INSERT INTO public.delivery_notes(delivery_id, author_user_id, author_name, body)
  VALUES (p_delivery, auth.uid(), coalesce(a.display_name,'System'), btrim(p_body))
  RETURNING id INTO v_id;
  PERFORM public.wf_journal(
    (SELECT case_id FROM public.deliveries WHERE id = p_delivery), p_delivery,
    NULL, (SELECT workflow_status FROM public.deliveries WHERE id = p_delivery),
    NULL, NULL, 'delivery', 'Internal note added', btrim(p_body), 'delivery.note');
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_add_note(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_mark_failed(
  p_delivery uuid, p_reason_code text, p_note text DEFAULT '',
  p_expected_version integer DEFAULT NULL)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reason uuid;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','driver']);
  SELECT id INTO v_reason FROM public.failure_reasons WHERE code = p_reason_code AND active;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Unknown failure reason: %', p_reason_code USING ERRCODE = '23514';
  END IF;
  UPDATE public.deliveries
     SET failure_reason_id = v_reason, failure_note = coalesce(p_note,'')
   WHERE id = p_delivery;
  RETURN public.wf_transition(p_delivery, 'Delivery Failed', coalesce(p_note,''),
    jsonb_build_object('reason', p_reason_code), p_expected_version);
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_mark_failed(uuid, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_mark_returned(
  p_delivery uuid, p_expected_version integer DEFAULT NULL)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  RETURN public.wf_transition(p_delivery, 'Returned to Airport',
    'Baggage returned to airport', '{}'::jsonb, p_expected_version);
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_mark_returned(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_close(p_delivery uuid)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deliveries%ROWTYPE;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator']);
  UPDATE public.deliveries SET closed_at = now() WHERE id = p_delivery RETURNING * INTO d;
  UPDATE public.baggage_cases SET lf_status = 'Closed', workflow_status = 'CLOSED',
         closed_at = now() WHERE id = d.case_id;
  PERFORM public.wf_journal(d.case_id, d.id, d.workflow_status, 'CLOSED', d.stage, d.stage,
    'delivery', format('Delivery %s closed', d.delivery_no), '', 'delivery.close');
  RETURN d;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_close(uuid) TO authenticated;

-- ============ DELIVERY AGENT ============
CREATE OR REPLACE FUNCTION public.agent_owns(p_delivery uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.deliveries d
                 WHERE d.id = p_delivery AND d.assigned_agent_id = public.current_app_user_id())
$$;
GRANT EXECUTE ON FUNCTION public.agent_owns(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.agent_advance(
  p_delivery uuid, p_to public.delivery_stage, p_expected_version integer DEFAULT NULL)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.wf_require(ARRAY['driver']);
  IF NOT public.agent_owns(p_delivery) AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'This delivery is not assigned to you' USING ERRCODE = '42501';
  END IF;
  IF p_to NOT IN ('Driver Accepted','Collected Bag','Out for Delivery','Scheduled') THEN
    RAISE EXCEPTION 'Delivery Agents cannot move a delivery to %', p_to USING ERRCODE = '42501';
  END IF;
  IF p_to = 'Scheduled' THEN
    UPDATE public.deliveries SET assigned_agent_id = NULL, assigned_at = NULL
     WHERE id = p_delivery;
  END IF;
  RETURN public.wf_transition(p_delivery, p_to, 'Delivery Agent action', '{}'::jsonb, p_expected_version);
END; $$;
GRANT EXECUTE ON FUNCTION public.agent_advance(uuid, public.delivery_stage, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.agent_complete_delivery(p_delivery uuid, p_code text)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.otp_challenges%ROWTYPE;
BEGIN
  PERFORM public.wf_require(ARRAY['driver']);
  IF NOT public.agent_owns(p_delivery) AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'This delivery is not assigned to you' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO o FROM public.otp_challenges
   WHERE delivery_id = p_delivery AND state IN ('Pending','Sent')
   ORDER BY issued_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active one-time code for this delivery' USING ERRCODE = '42501';
  END IF;
  IF o.expires_at <= now() THEN
    UPDATE public.otp_challenges SET state = 'Expired' WHERE id = o.id;
    RAISE EXCEPTION 'The one-time code has expired. Ask dispatch to resend it.' USING ERRCODE = '42501';
  END IF;
  IF o.attempts >= o.max_attempts THEN
    RAISE EXCEPTION 'Too many incorrect attempts. Ask dispatch to resend the code.' USING ERRCODE = '42501';
  END IF;

  IF o.code <> btrim(coalesce(p_code,'')) THEN
    UPDATE public.otp_challenges
       SET attempts = attempts + 1,
           state = CASE WHEN attempts + 1 >= max_attempts THEN 'Failed' ELSE state END,
           locked_at = CASE WHEN attempts + 1 >= max_attempts THEN now() ELSE locked_at END
     WHERE id = o.id;
    PERFORM public.wf_refresh_passenger_view(p_delivery);
    RAISE EXCEPTION 'Incorrect code' USING ERRCODE = '42501';
  END IF;

  UPDATE public.otp_challenges SET state = 'Verified', verified_at = now() WHERE id = o.id;
  RETURN public.wf_transition(p_delivery, 'Delivered', 'Verified with passenger code');
END; $$;
GRANT EXECUTE ON FUNCTION public.agent_complete_delivery(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.agent_report_position(
  p_lat double precision, p_lng double precision, p_accuracy double precision DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_agent uuid;
BEGIN
  PERFORM public.wf_require(ARRAY['driver']);
  v_agent := public.current_app_user_id();
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'No Delivery Agent record for this account' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.agent_positions(agent_id, lat, lng, accuracy, reported_at)
  VALUES (v_agent, p_lat, p_lng, p_accuracy, now())
  ON CONFLICT (agent_id) DO UPDATE SET
    lat = EXCLUDED.lat, lng = EXCLUDED.lng,
    accuracy = EXCLUDED.accuracy, reported_at = now();
  PERFORM public.wf_recompute_route(v_agent);
END; $$;
GRANT EXECUTE ON FUNCTION public.agent_report_position(double precision, double precision, double precision) TO authenticated;

-- ============ ROUTE ENGINE (nearest neighbour from the station) ============
CREATE OR REPLACE FUNCTION public.wf_recompute_route(p_agent uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_route uuid; v_lat double precision; v_lng double precision; v_label text;
  cur_lat double precision; cur_lng double precision;
  nxt record; i integer := 0; total numeric := 0;
BEGIN
  SELECT coalesce(p.lat, s.lat), coalesce(p.lng, s.lng), s.name
    INTO v_lat, v_lng, v_label
  FROM public.stations s
  LEFT JOIN public.agent_positions p ON p.agent_id = p_agent
  WHERE s.is_default LIMIT 1;

  INSERT INTO public.agent_routes(agent_id, origin_lat, origin_lng, origin_label, computed_at)
  VALUES (p_agent, v_lat, v_lng, coalesce(v_label,''), now())
  ON CONFLICT (agent_id) DO UPDATE SET
    origin_lat = EXCLUDED.origin_lat, origin_lng = EXCLUDED.origin_lng,
    origin_label = EXCLUDED.origin_label, computed_at = now()
  RETURNING id INTO v_route;

  DELETE FROM public.agent_route_stops WHERE route_id = v_route;

  CREATE TEMP TABLE _pending ON COMMIT DROP AS
  SELECT d.id, d.dest_lat AS lat, d.dest_lng AS lng, d.address AS label
  FROM public.deliveries d
  WHERE d.assigned_agent_id = p_agent
    AND d.stage IN ('Assigned','Driver Accepted','Collected Bag','Out for Delivery');

  cur_lat := v_lat; cur_lng := v_lng;
  LOOP
    SELECT * INTO nxt FROM _pending
    ORDER BY CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END,
             sqrt(power(coalesce(lat, cur_lat) - cur_lat, 2) + power(coalesce(lng, cur_lng) - cur_lng, 2))
    LIMIT 1;
    EXIT WHEN NOT FOUND;
    i := i + 1;
    INSERT INTO public.agent_route_stops(route_id, delivery_id, seq, lat, lng, label, leg_km)
    VALUES (v_route, nxt.id, i, nxt.lat, nxt.lng, coalesce(nxt.label,''),
      round((111.0 * sqrt(power(coalesce(nxt.lat, cur_lat) - cur_lat, 2)
                        + power(coalesce(nxt.lng, cur_lng) - cur_lng, 2)))::numeric, 2));
    total := total + round((111.0 * sqrt(power(coalesce(nxt.lat, cur_lat) - cur_lat, 2)
                        + power(coalesce(nxt.lng, cur_lng) - cur_lng, 2)))::numeric, 2);
    cur_lat := coalesce(nxt.lat, cur_lat); cur_lng := coalesce(nxt.lng, cur_lng);
    DELETE FROM _pending WHERE id = nxt.id;
  END LOOP;

  UPDATE public.agent_routes SET total_km = total WHERE id = v_route;
  DROP TABLE IF EXISTS _pending;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wf_recompute_route(uuid) FROM PUBLIC, anon, authenticated;

-- ============ PASSENGER PORTAL (token only, no sign-in) ============
CREATE OR REPLACE FUNCTION public.passenger_get_view(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.passenger_links%ROWTYPE; v public.passenger_view%ROWTYPE; expose boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN NULL; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.passenger_view WHERE delivery_id = l.delivery_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  expose := v.stage IN ('Out for Delivery');
  RETURN jsonb_build_object(
    'passenger_name', v.passenger_name,
    'stage', v.stage,
    'status', v.workflow_status,
    'pir_number', v.pir_number,
    'bag_tag', v.bag_tag,
    'airline', v.airline,
    'flight_no', v.flight_no,
    'flight_date', v.flight_date,
    'delivered_at', v.delivered_at,
    'otp_code', CASE WHEN expose THEN v.otp_code ELSE NULL END);
END; $$;
GRANT EXECUTE ON FUNCTION public.passenger_get_view(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.passenger_submit_feedback(
  p_token text, p_rating integer, p_resolved boolean, p_comments text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.passenger_links%ROWTYPE;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN false; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN false; END IF;

  INSERT INTO public.passenger_feedback(delivery_id, case_id, link_id, rating, resolved, comments)
  VALUES (l.delivery_id, l.case_id, l.id, p_rating, coalesce(p_resolved,true),
          left(coalesce(p_comments,''), 2000))
  ON CONFLICT (delivery_id) DO NOTHING;

  INSERT INTO public.timeline_events(module, case_id, delivery_id, title, detail, status, actor_name)
  VALUES ('feedback', l.case_id, l.delivery_id, 'Passenger feedback submitted',
          format('Rating %s/5', p_rating), 'FEEDBACK_SUBMITTED', 'Passenger Portal');
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.passenger_submit_feedback(text, integer, boolean, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.passenger_report_misconduct(p_token text, p_details text DEFAULT '')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.passenger_links%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN false; END IF;

  INSERT INTO public.quality_incidents(case_id, delivery_id, category, severity, state,
    description, reported_by)
  VALUES (l.case_id, l.delivery_id, 'Possible Misconduct', 'High', 'Open',
    coalesce(nullif(left(p_details,2000),''),
      'Passenger reported a request for money, tips, gifts or unofficial payment.'),
    'Passenger Portal');

  INSERT INTO public.timeline_events(module, case_id, delivery_id, title, detail, status, actor_name)
  VALUES ('quality', l.case_id, l.delivery_id, 'Possible misconduct reported',
          'Raised from the Passenger Portal', 'Open', 'Passenger Portal');
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.passenger_report_misconduct(text, text) TO anon, authenticated;

-- ============ NOTIFICATION WORKER ============
CREATE OR REPLACE FUNCTION public.notif_claim_batch(p_limit integer DEFAULT 20)
RETURNS SETOF public.notification_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','agent']);
  RETURN QUERY
  UPDATE public.notification_events n SET state = 'sending', last_attempt_at = now()
  WHERE n.id IN (
    SELECT id FROM public.notification_events
    WHERE state IN ('queued','failed') AND attempt_count < 5 AND next_attempt_at <= now()
    ORDER BY created_at LIMIT greatest(1, least(p_limit, 100))
    FOR UPDATE SKIP LOCKED)
  RETURNING n.*;
END; $$;
GRANT EXECUTE ON FUNCTION public.notif_claim_batch(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.notif_record_result(
  p_id uuid, p_success boolean, p_provider text, p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.notification_events%ROWTYPE;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','agent']);
  SELECT * INTO n FROM public.notification_events WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.notification_attempts(notification_id, attempt_no, provider, succeeded,
    provider_message_id, error)
  VALUES (p_id, n.attempt_count + 1, coalesce(p_provider,'simulated'), p_success,
    p_provider_message_id, coalesce(p_error,''));

  UPDATE public.notification_events SET
    attempt_count = attempt_count + 1,
    provider = coalesce(p_provider, provider),
    provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    state = CASE WHEN p_success THEN 'sent'
                 WHEN attempt_count + 1 >= 5 THEN 'failed'
                 ELSE 'queued' END::public.notification_state,
    sent_at = CASE WHEN p_success THEN now() ELSE sent_at END,
    failure_reason = CASE WHEN p_success THEN '' ELSE coalesce(p_error,'') END,
    next_attempt_at = CASE WHEN p_success THEN next_attempt_at
                           ELSE now() + (power(2, attempt_count + 1) * interval '1 minute') END
  WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.notif_record_result(uuid, boolean, text, text, text) TO authenticated;
