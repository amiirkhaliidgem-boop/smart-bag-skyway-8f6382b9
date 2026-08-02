CREATE OR REPLACE FUNCTION public.lf_set_region(p_case uuid, p_region uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  UPDATE public.baggage_cases SET region_id = p_region WHERE id = p_case;
END; $$;
REVOKE EXECUTE ON FUNCTION public.lf_set_region(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lf_set_region(uuid, uuid) TO authenticated;

-- Accept region_id from the Lost & Found create/update payloads.
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
    preferred_delivery_time, google_maps_link, dest_lat, dest_lng, region_id,
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
    coalesce(nullif(btrim(coalesce(p_payload->>'region_id','')),'')::uuid,
             (SELECT id FROM public.sla_regions WHERE is_default AND active LIMIT 1)),
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

CREATE OR REPLACE FUNCTION public.lf_apply_region(p_case uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_payload ? 'region_id' THEN
    UPDATE public.baggage_cases
       SET region_id = nullif(btrim(coalesce(p_payload->>'region_id','')),'')::uuid
     WHERE id = p_case;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.lf_apply_region(uuid, jsonb) FROM PUBLIC, anon;