CREATE OR REPLACE FUNCTION public.qm_raise_incident(
  p_source text,
  p_category text,
  p_description text,
  p_case uuid DEFAULT NULL,
  p_delivery uuid DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL,
  p_severity public.incident_severity DEFAULT NULL,
  p_reported_by text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid; v_case uuid; v_agent uuid; v_airline text := '';
  v_station uuid; v_sev public.incident_severity; v_ref text := '';
  v_actor text := 'Workflow Engine'; v_no text;
BEGIN
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.quality_incidents WHERE dedupe_key = p_dedupe_key;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  v_case := p_case;
  IF p_delivery IS NOT NULL THEN
    SELECT d.case_id, d.assigned_agent_id, d.station_id, d.delivery_no
      INTO v_case, v_agent, v_station, v_ref
    FROM public.deliveries d WHERE d.id = p_delivery;
    v_case := coalesce(p_case, v_case);
  END IF;

  IF v_case IS NOT NULL THEN
    SELECT c.airline, coalesce(v_station, c.station_id),
           coalesce(nullif(v_ref,''), nullif(c.pir_number,''), c.case_no)
      INTO v_airline, v_station, v_ref
    FROM public.baggage_cases c WHERE c.id = v_case;
  END IF;

  v_sev := coalesce(p_severity, public.qm_default_severity(p_category));
  v_no := public.next_incident_no();

  INSERT INTO public.quality_incidents(
    case_id, delivery_id, category, severity, state, description, reported_by,
    incident_no, source, agent_id, airline, station_id, dedupe_key, due_at)
  VALUES (v_case, p_delivery, p_category, v_sev, 'Open', coalesce(p_description,''),
    coalesce(p_reported_by,'Workflow Engine'), v_no, p_source, v_agent,
    coalesce(v_airline,''), v_station, p_dedupe_key,
    now() + CASE v_sev WHEN 'High' THEN interval '4 hours'
                       WHEN 'Medium' THEN interval '24 hours'
                       ELSE interval '72 hours' END)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.quality_incidents WHERE dedupe_key = p_dedupe_key;
    RETURN v_id;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT coalesce(display_name, 'Workflow Engine') INTO v_actor FROM public.wf_actor();
  END IF;

  INSERT INTO public.timeline_events(module, case_id, delivery_id, reference, title,
    detail, status, actor_user_id, actor_name, metadata)
  VALUES ('quality', v_case, p_delivery, coalesce(v_ref,''),
    format('Quality incident %s raised · %s', v_no, p_category),
    coalesce(p_description,''), 'Open', auth.uid(), v_actor,
    jsonb_build_object('incident_no', v_no, 'source', p_source, 'severity', v_sev));

  INSERT INTO public.audit_events(actor_user_id, actor_name, actor_role, action,
    entity_type, entity_id, case_id, delivery_id, note, metadata)
  VALUES (auth.uid(), v_actor, NULL, 'quality.raise', 'incident', v_no,
    v_case, p_delivery, coalesce(p_description,''),
    jsonb_build_object('category', p_category, 'source', p_source, 'severity', v_sev));

  RETURN v_id;
END;
$fn$;