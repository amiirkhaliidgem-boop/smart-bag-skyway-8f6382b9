-- 1. Lifecycle states
ALTER TYPE public.incident_state ADD VALUE IF NOT EXISTS 'Assigned' AFTER 'Open';
ALTER TYPE public.incident_state ADD VALUE IF NOT EXISTS 'Investigating' AFTER 'Assigned';

-- 2. Incident numbering
CREATE SEQUENCE IF NOT EXISTS public.incident_no_seq START 1;

-- 3. Columns
ALTER TABLE public.quality_incidents
  ADD COLUMN IF NOT EXISTS incident_no text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS airline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES public.stations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_category text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS quality_incidents_dedupe_uidx
  ON public.quality_incidents (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS quality_incidents_created_idx ON public.quality_incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS quality_incidents_state_idx ON public.quality_incidents (state);

CREATE OR REPLACE FUNCTION public.next_incident_no()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT 'QI-' || lpad(nextval('public.incident_no_seq')::text, 6, '0') $$;

-- 4. Severity matrix
CREATE OR REPLACE FUNCTION public.qm_default_severity(p_category text)
RETURNS public.incident_severity LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE p_category
    WHEN 'Possible Misconduct' THEN 'High'
    WHEN 'Money Request / Extortion' THEN 'High'
    WHEN 'Damaged Baggage' THEN 'High'
    WHEN 'Missing Baggage' THEN 'High'
    WHEN 'Failed Verification' THEN 'High'
    WHEN 'Return to Airport' THEN 'High'
    WHEN 'Unprofessional Behaviour' THEN 'Medium'
    WHEN 'Late Delivery' THEN 'Medium'
    WHEN 'Service Quality' THEN 'Medium'
    ELSE 'Low'
  END::public.incident_severity
$$;

-- 5. Core raise routine (idempotent, journals to timeline + audit)
CREATE OR REPLACE FUNCTION public.qm_raise_incident(
  p_source text,
  p_category text,
  p_description text,
  p_case uuid DEFAULT NULL,
  p_delivery uuid DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL,
  p_severity public.incident_severity DEFAULT NULL,
  p_reported_by text DEFAULT 'Workflow Engine'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  ON CONFLICT (dedupe_key) DO NOTHING
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
END; $$;

REVOKE EXECUTE ON FUNCTION public.qm_raise_incident(text,text,text,uuid,uuid,text,public.incident_severity,text) FROM PUBLIC, anon, authenticated;

-- 6. Staff actions
CREATE OR REPLACE FUNCTION public.qm_create_incident(
  p_category text, p_description text, p_case uuid DEFAULT NULL,
  p_delivery uuid DEFAULT NULL, p_severity public.incident_severity DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE a record;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','agent']);
  SELECT * INTO a FROM public.wf_actor();
  RETURN public.qm_raise_incident('manual', p_category, p_description, p_case,
    p_delivery, NULL, p_severity, coalesce(a.display_name,'Staff'));
END; $$;

CREATE OR REPLACE FUNCTION public.qm_assign_incident(p_incident uuid, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE i public.quality_incidents%ROWTYPE; v_name text;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','agent']);
  SELECT full_name INTO v_name FROM public.app_users WHERE id = p_user;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Unknown staff member' USING ERRCODE = '23514'; END IF;
  UPDATE public.quality_incidents
     SET assigned_to = p_user, assigned_at = now(),
         state = CASE WHEN state::text = 'Open' THEN 'Assigned'::public.incident_state ELSE state END
   WHERE id = p_incident RETURNING * INTO i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.wf_journal_event('quality',
    format('Incident %s assigned to %s', i.incident_no, v_name), '',
    i.case_id, i.delivery_id, 'quality.assign',
    jsonb_build_object('incident_no', i.incident_no, 'assignee', v_name));
END; $$;

CREATE OR REPLACE FUNCTION public.qm_set_state(p_incident uuid, p_state public.incident_state, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE i public.quality_incidents%ROWTYPE;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','agent']);
  UPDATE public.quality_incidents
     SET state = p_state,
         resolved_at = CASE WHEN p_state::text = 'Resolved' THEN now() ELSE NULL END
   WHERE id = p_incident RETURNING * INTO i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.wf_journal_event('quality',
    format('Incident %s → %s', i.incident_no, p_state), coalesce(p_note,''),
    i.case_id, i.delivery_id, 'quality.state',
    jsonb_build_object('incident_no', i.incident_no, 'state', p_state));
END; $$;

CREATE OR REPLACE FUNCTION public.qm_resolve_incident(p_incident uuid, p_resolution_category text, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE i public.quality_incidents%ROWTYPE;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','agent']);
  UPDATE public.quality_incidents
     SET state = 'Resolved', resolved_at = now(),
         resolution_category = coalesce(p_resolution_category,''),
         resolution_note = coalesce(p_note,'')
   WHERE id = p_incident RETURNING * INTO i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.wf_journal_event('quality',
    format('Incident %s resolved · %s', i.incident_no, coalesce(p_resolution_category,'')),
    coalesce(p_note,''), i.case_id, i.delivery_id, 'quality.resolve',
    jsonb_build_object('incident_no', i.incident_no));
END; $$;

-- 7. SLA sweep
CREATE OR REPLACE FUNCTION public.qm_sweep_sla()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r record; n integer := 0; v_id uuid;
BEGIN
  FOR r IN
    SELECT d.id, d.delivery_no, d.stage, s.target_minutes,
           coalesce(
             (SELECT max(w.occurred_at) FROM public.workflow_events w WHERE w.delivery_id = d.id),
             d.updated_at) AS since
    FROM public.deliveries d
    JOIN public.sla_policies s ON s.stage = d.stage AND s.active
    WHERE d.stage NOT IN ('Delivered','Returned to Airport','Delivery Failed')
  LOOP
    IF r.since IS NOT NULL
       AND extract(epoch FROM (now() - r.since)) / 60 > r.target_minutes THEN
      v_id := public.qm_raise_incident(
        'sla', 'Late Delivery',
        format('Delivery %s has been in stage "%s" for longer than the %s minute service target.',
               r.delivery_no, r.stage, r.target_minutes),
        NULL, r.id,
        format('sla:%s:%s:%s', r.id, r.stage, to_char(r.since, 'YYYYMMDDHH24MI')),
        NULL, 'Workflow Engine');
      n := n + 1;
    END IF;
  END LOOP;
  RETURN n;
END; $$;

-- 8. Automatic sources wired into existing engine RPCs
CREATE OR REPLACE FUNCTION public.dm_mark_returned(p_delivery uuid, p_reason_code text DEFAULT NULL::text, p_note text DEFAULT ''::text, p_expected_version integer DEFAULT NULL::integer)
 RETURNS deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d public.deliveries%ROWTYPE; v_reason uuid; v_agent uuid; v_label text; v_no text;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','driver']);
  PERFORM public.wf_assert_version(p_delivery, p_expected_version);

  IF p_reason_code IS NOT NULL AND p_reason_code <> '' THEN
    SELECT id, label_en INTO v_reason, v_label FROM public.failure_reasons WHERE code = p_reason_code AND active;
  END IF;

  SELECT assigned_agent_id, delivery_no INTO v_agent, v_no FROM public.deliveries WHERE id = p_delivery;

  UPDATE public.deliveries
     SET failure_reason_id = coalesce(v_reason, failure_reason_id),
         failure_note = coalesce(p_note, '')
   WHERE id = p_delivery;

  d := public.wf_transition(p_delivery, 'Returned to Airport',
        coalesce(p_note, 'Baggage returned to airport'),
        jsonb_build_object('reason', coalesce(p_reason_code, ''), 'previous_agent', v_agent), NULL);

  PERFORM public.qm_raise_incident('return', 'Return to Airport',
    format('Delivery %s was returned to the airport. Reason: %s. %s',
           v_no, coalesce(nullif(v_label,''), nullif(p_reason_code,''), 'Not specified'), coalesce(p_note,'')),
    d.case_id, p_delivery,
    format('return:%s:%s', p_delivery, d.attempt_no), NULL, 'Workflow Engine');

  UPDATE public.otp_challenges SET state = 'Expired'
   WHERE delivery_id = p_delivery AND state IN ('Pending','Sent');

  UPDATE public.deliveries
     SET assigned_agent_id = NULL, assigned_at = NULL,
         accepted_at = NULL, collected_at = NULL, started_at = NULL
   WHERE id = p_delivery;

  d := public.wf_transition(p_delivery, 'Ready for Delivery',
        'Returned to airport — re-queued for dispatch', '{}'::jsonb, NULL);

  IF v_agent IS NOT NULL THEN
    PERFORM public.wf_recompute_route(v_agent);
  END IF;

  RETURN d;
END; $function$;

CREATE OR REPLACE FUNCTION public.agent_complete_delivery(p_delivery uuid, p_code text)
 RETURNS deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.otp_challenges%ROWTYPE; v_no text;
BEGIN
  PERFORM public.wf_require(ARRAY['driver']);
  IF NOT public.agent_owns(p_delivery) AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'This delivery is not assigned to you' USING ERRCODE = '42501';
  END IF;

  SELECT delivery_no INTO v_no FROM public.deliveries WHERE id = p_delivery;

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
    IF o.attempts + 1 >= o.max_attempts THEN
      PERFORM public.qm_raise_incident('otp', 'Failed Verification',
        format('Delivery %s was locked after %s incorrect one-time code attempts at the door.',
               v_no, o.max_attempts),
        NULL, p_delivery, format('otp:%s', o.id), NULL, 'Workflow Engine');
    END IF;
    PERFORM public.wf_refresh_passenger_view(p_delivery);
    RAISE EXCEPTION 'Incorrect code' USING ERRCODE = '42501';
  END IF;

  UPDATE public.otp_challenges SET state = 'Verified', verified_at = now() WHERE id = o.id;
  RETURN public.wf_transition(p_delivery, 'Delivered', 'Verified with passenger code');
END; $function$;

CREATE OR REPLACE FUNCTION public.passenger_submit_feedback(p_token text, p_rating integer, p_resolved boolean, p_comments text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l public.passenger_links%ROWTYPE; v_new boolean := false;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN false; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN false; END IF;

  INSERT INTO public.passenger_feedback(delivery_id, case_id, link_id, rating, resolved, comments)
  VALUES (l.delivery_id, l.case_id, l.id, p_rating, coalesce(p_resolved,true),
          left(coalesce(p_comments,''), 2000))
  ON CONFLICT (delivery_id) DO NOTHING;
  v_new := FOUND;

  INSERT INTO public.timeline_events(module, case_id, delivery_id, title, detail, status, actor_name)
  VALUES ('feedback', l.case_id, l.delivery_id, 'Passenger feedback submitted',
          format('Rating %s/5', p_rating), 'FEEDBACK_SUBMITTED', 'Passenger Portal');

  IF p_rating <= 2 THEN
    PERFORM public.qm_raise_incident('csat', 'Service Quality',
      format('Passenger rated the delivery %s/5. %s', p_rating, coalesce(left(p_comments,500),'')),
      l.case_id, l.delivery_id, format('csat:%s', l.delivery_id), NULL, 'Passenger Portal');
  END IF;
  RETURN true;
END; $function$;

CREATE OR REPLACE FUNCTION public.passenger_report_misconduct(p_token text, p_details text DEFAULT ''::text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE l public.passenger_links%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN false; END IF;

  PERFORM public.qm_raise_incident('passenger', 'Possible Misconduct',
    coalesce(nullif(left(p_details,2000),''),
      'Passenger reported a request for money, tips, gifts or unofficial payment.'),
    l.case_id, l.delivery_id, format('misconduct:%s', l.delivery_id), NULL, 'Passenger Portal');
  RETURN true;
END; $function$;

-- 9. Backfill incident numbers for any legacy rows
UPDATE public.quality_incidents SET incident_no = public.next_incident_no() WHERE incident_no IS NULL;