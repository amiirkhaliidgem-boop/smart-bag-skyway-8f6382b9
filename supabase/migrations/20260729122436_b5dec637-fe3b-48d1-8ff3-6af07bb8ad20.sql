-- 1. PIR number optional
ALTER TABLE public.baggage_cases ALTER COLUMN pir_number DROP NOT NULL;

-- 2. Staff officer lookup (mirrors list_delivery_agents)
CREATE OR REPLACE FUNCTION public.list_staff_officers()
RETURNS TABLE(id uuid, full_name text, employee_id text, department text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id, u.full_name, u.employee_id, u.department
  FROM public.app_users u
  WHERE u.user_type <> 'driver' AND u.status = 'Active'
  ORDER BY u.full_name
$$;

REVOKE EXECUTE ON FUNCTION public.list_staff_officers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_staff_officers() TO authenticated;

-- 3. lf_update_case: officer assignment + richer journaling
CREATE OR REPLACE FUNCTION public.lf_update_case(p_case uuid, p_payload jsonb, p_expected_version integer DEFAULT NULL::integer)
 RETURNS baggage_cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.baggage_cases%ROWTYPE; v_tags text[]; t text; i integer := 0;
        v_prev_officer uuid; v_officer_name text; v_detail text;
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
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

-- 4. lf_set_status: keep journaling readable when PIR is empty
CREATE OR REPLACE FUNCTION public.lf_set_status(p_case uuid, p_status lf_status, p_expected_version integer DEFAULT NULL::integer)
 RETURNS baggage_cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.wf_journal(p_case, NULL, public.wf_lf_workflow(v_from), c.workflow_status,
    NULL, NULL, 'lost_found',
    format('Case %s → %s', coalesce(nullif(c.pir_number,''), c.case_no), p_status),
    format('Lost & Found status changed from %s to %s', v_from, p_status), 'case.status');

  IF p_status = 'Ready for Delivery' THEN
    PERFORM public.wf_open_delivery(p_case);
  END IF;
  RETURN c;
END; $function$;

-- helper used above
CREATE OR REPLACE FUNCTION public.wf_lf_workflow(p lf_status)
RETURNS workflow_status
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE p
    WHEN 'Open' THEN 'PIR_CREATED'
    WHEN 'Tracing' THEN 'PIR_CREATED'
    WHEN 'Located' THEN 'HOME_DELIVERY_REQUESTED'
    WHEN 'Arrived at Airport' THEN 'DELIVERY_APPROVED'
    WHEN 'Waiting Customs Clearance' THEN 'DELIVERY_APPROVED'
    WHEN 'Ready for Delivery' THEN 'READY_FOR_COLLECTION'
    WHEN 'Assigned Driver' THEN 'DRIVER_ASSIGNED'
    WHEN 'Out for Delivery' THEN 'OUT_FOR_DELIVERY'
    WHEN 'Delivered' THEN 'DELIVERED'
    WHEN 'Closed' THEN 'CLOSED'
  END::public.workflow_status
$$;

REVOKE EXECUTE ON FUNCTION public.wf_lf_workflow(lf_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_lf_workflow(lf_status) TO authenticated;

-- 5. Storage assignment / quality incidents / import-export journaling helper
CREATE OR REPLACE FUNCTION public.wf_journal_event(
  p_module timeline_module,
  p_title text,
  p_detail text DEFAULT ''::text,
  p_case uuid DEFAULT NULL,
  p_delivery uuid DEFAULT NULL,
  p_action text DEFAULT 'event',
  p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE a record; v_ref text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.wf_actor();

  SELECT coalesce(d.delivery_no, nullif(c.pir_number,''), c.case_no, '')
    INTO v_ref
  FROM (SELECT 1) x
  LEFT JOIN public.baggage_cases c ON c.id = p_case
  LEFT JOIN public.deliveries d ON d.id = p_delivery;

  INSERT INTO public.timeline_events(module, case_id, delivery_id, reference, title,
    detail, status, actor_user_id, actor_name, metadata)
  VALUES (p_module, p_case, p_delivery, coalesce(v_ref,''), p_title, coalesce(p_detail,''),
    '', auth.uid(), coalesce(a.display_name,'System'), coalesce(p_metadata,'{}'::jsonb));

  INSERT INTO public.audit_events(actor_user_id, actor_name, actor_role, action,
    entity_type, entity_id, case_id, delivery_id, note, metadata)
  VALUES (auth.uid(), coalesce(a.display_name,'System'), a.role_key, p_action,
    CASE WHEN p_delivery IS NOT NULL THEN 'delivery' ELSE 'case' END,
    coalesce(v_ref,''), p_case, p_delivery, coalesce(p_detail,''), coalesce(p_metadata,'{}'::jsonb));
END; $$;

REVOKE EXECUTE ON FUNCTION public.wf_journal_event(timeline_module, text, text, uuid, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_journal_event(timeline_module, text, text, uuid, uuid, text, jsonb) TO authenticated;