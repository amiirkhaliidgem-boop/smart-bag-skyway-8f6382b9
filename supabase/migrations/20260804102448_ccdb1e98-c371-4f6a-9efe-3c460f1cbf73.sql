-- 1. Gapless, transaction-safe counter store
CREATE TABLE IF NOT EXISTS public.number_counters (
  key text PRIMARY KEY,
  current_value bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.number_counters TO service_role;
ALTER TABLE public.number_counters ENABLE ROW LEVEL SECURITY;
-- No policies: reachable only through SECURITY DEFINER allocation functions.

CREATE OR REPLACE FUNCTION public.alloc_number(p_key text, p_prefix text, p_width integer)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_next bigint;
BEGIN
  -- Single statement: takes the row lock, increments, and returns the new
  -- value inside the caller's transaction. If the caller's transaction rolls
  -- back, the increment rolls back with it -> no gaps. Concurrent callers
  -- serialise on the row lock -> no duplicates.
  INSERT INTO public.number_counters(key, current_value)
  VALUES (p_key, 1)
  ON CONFLICT (key) DO UPDATE
    SET current_value = public.number_counters.current_value + 1,
        updated_at = now()
  RETURNING current_value INTO v_next;

  RETURN p_prefix || lpad(v_next::text, p_width, '0');
END; $$;

REVOKE EXECUTE ON FUNCTION public.alloc_number(text, text, integer) FROM PUBLIC, anon, authenticated;

-- 2. Seed counters from the highest value currently in use
INSERT INTO public.number_counters(key, current_value)
VALUES ('case_no', coalesce((SELECT max(nullif(regexp_replace(case_no, '\D', '', 'g'), '')::bigint) FROM public.baggage_cases), 0))
ON CONFLICT (key) DO UPDATE SET current_value = GREATEST(public.number_counters.current_value, excluded.current_value);

INSERT INTO public.number_counters(key, current_value)
VALUES ('delivery_no', coalesce((SELECT max(nullif(regexp_replace(delivery_no, '\D', '', 'g'), '')::bigint) FROM public.deliveries), 0))
ON CONFLICT (key) DO UPDATE SET current_value = GREATEST(public.number_counters.current_value, excluded.current_value);

INSERT INTO public.number_counters(key, current_value)
VALUES ('incident_no', coalesce((SELECT max(nullif(regexp_replace(coalesce(incident_no,''), '\D', '', 'g'), '')::bigint) FROM public.quality_incidents), 0))
ON CONFLICT (key) DO UPDATE SET current_value = GREATEST(public.number_counters.current_value, excluded.current_value);

-- 3. Reference-number generators now use the transactional counter
CREATE OR REPLACE FUNCTION public.next_case_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.alloc_number('case_no', 'BAG-', 6) $$;

CREATE OR REPLACE FUNCTION public.next_delivery_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.alloc_number('delivery_no', 'DEL-', 6) $$;

CREATE OR REPLACE FUNCTION public.next_incident_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$ SELECT public.alloc_number('incident_no', 'INC-', 5) $$;

-- 4. Validate before allocating: duplicate PIR / bag tags must fail before a
--    case number is drawn, with a business-readable message.
CREATE OR REPLACE FUNCTION public.lf_create_case(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid; v_station uuid; v_tags text[]; t text; i integer := 0;
  v_pir text; v_existing text; v_dup text;
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);

  v_pir := nullif(btrim(p_payload->>'pir_number'),'');

  IF v_pir IS NOT NULL THEN
    SELECT case_no INTO v_existing FROM public.baggage_cases WHERE pir_number = v_pir LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'PIR number % already exists on case %', v_pir, v_existing
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  v_tags := ARRAY(SELECT btrim(x) FROM jsonb_array_elements_text(coalesce(p_payload->'bag_tags','[]'::jsonb)) x WHERE btrim(x) <> '');

  SELECT x INTO v_dup FROM unnest(v_tags) x GROUP BY x HAVING count(*) > 1 LIMIT 1;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Bag tag % is listed more than once on this case', v_dup
      USING ERRCODE = 'unique_violation';
  END IF;

  SELECT b.bag_tag INTO v_dup
  FROM public.case_bags b WHERE b.bag_tag = ANY(v_tags) LIMIT 1;
  IF v_dup IS NOT NULL THEN
    SELECT c.case_no INTO v_existing
    FROM public.case_bags b JOIN public.baggage_cases c ON c.id = b.case_id
    WHERE b.bag_tag = v_dup LIMIT 1;
    RAISE EXCEPTION 'Bag tag % is already registered on case %', v_dup, v_existing
      USING ERRCODE = 'unique_violation';
  END IF;

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
    v_pir,
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

  FOREACH t IN ARRAY v_tags LOOP
    i := i + 1;
    INSERT INTO public.case_bags(case_id, bag_tag, seq) VALUES (v_id, t, i)
    ON CONFLICT (case_id, bag_tag) DO NOTHING;
  END LOOP;

  PERFORM public.wf_journal(v_id, NULL, NULL, 'PIR_CREATED', NULL, NULL, 'lost_found',
    format('Case %s created', coalesce(v_pir, 'without PIR')), 'PIR registered', 'case.create');
  RETURN v_id;
END; $function$;

-- 5. Retire the non-transactional sequences
DROP SEQUENCE IF EXISTS public.pir_no_seq;
DROP SEQUENCE IF EXISTS public.delivery_no_seq;
DROP SEQUENCE IF EXISTS public.incident_no_seq;