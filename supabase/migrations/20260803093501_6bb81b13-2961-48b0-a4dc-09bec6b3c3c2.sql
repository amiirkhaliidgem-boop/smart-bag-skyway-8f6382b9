
-- 1) One token per journey: reuse the case-level link when attaching a delivery.
CREATE OR REPLACE FUNCTION public.wf_ensure_passenger_link(p_delivery uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_token text; v_case uuid;
BEGIN
  SELECT token INTO v_token FROM public.passenger_links
   WHERE delivery_id = p_delivery AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY issued_at DESC LIMIT 1;
  IF v_token IS NOT NULL THEN RETURN v_token; END IF;

  SELECT case_id INTO v_case FROM public.deliveries WHERE id = p_delivery;
  IF v_case IS NULL THEN RETURN NULL; END IF;

  -- Reuse the case-level link issued during Lost & Found so the passenger
  -- keeps the exact same URL for the whole journey.
  UPDATE public.passenger_links
     SET delivery_id = p_delivery, updated_at = now()
   WHERE id = (
     SELECT id FROM public.passenger_links
      WHERE case_id = v_case AND delivery_id IS NULL AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY issued_at DESC LIMIT 1
   )
  RETURNING token INTO v_token;
  IF v_token IS NOT NULL THEN RETURN v_token; END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.passenger_links(token, delivery_id, case_id, channel, expires_at)
  VALUES (v_token, p_delivery, v_case, 'sms', now() + interval '30 days');
  RETURN v_token;
END;
$fn$;

-- 2) Resolve the public portal origin, with a safe stable fallback.
CREATE OR REPLACE FUNCTION public.wf_portal_base_url()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT rtrim(
    coalesce(
      nullif(btrim(public.settings_group('general')->>'portal_base_url'), ''),
      'https://project--75f669c5-eaf5-480f-906c-a1cf61344ac4.lovable.app'
    ), '/');
$fn$;

REVOKE EXECUTE ON FUNCTION public.wf_portal_base_url() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_portal_base_url() TO authenticated, service_role;

-- 3) Delivery notifications: always ensure the link, always absolute URL.
CREATE OR REPLACE FUNCTION public.wf_queue_notification_key(p_delivery uuid, p_trigger_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  d record; v_token text; v_link text; v_ctx jsonb; t record; v_locale text;
  v_body_en text; v_body_ar text; v_subject_en text; v_subject_ar text; v_base text;
BEGIN
  SELECT dd.*, c.pir_number, c.case_no, c.email AS case_email,
         (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = c.id ORDER BY b.seq LIMIT 1) AS bag_tag,
         (SELECT u.full_name FROM public.app_users u WHERE u.id = dd.assigned_agent_id) AS agent_name
    INTO d
  FROM public.deliveries dd
  JOIN public.baggage_cases c ON c.id = dd.case_id
  WHERE dd.id = p_delivery;
  IF NOT FOUND THEN RETURN; END IF;

  v_token := public.wf_ensure_passenger_link(p_delivery);
  v_base := public.wf_portal_base_url();
  v_link := CASE WHEN v_token IS NULL THEN '' ELSE v_base || '/passenger/' || v_token END;
  v_locale := CASE WHEN public.settings_group('general')->>'default_language' = 'ar' THEN 'ar' ELSE 'en' END;

  v_ctx := jsonb_build_object(
    'PassengerName', d.passenger_name,
    'PIR', coalesce(nullif(d.pir_number, ''), d.case_no),
    'DeliveryID', d.delivery_no,
    'TrackingLink', v_link,
    'AgentName', coalesce(d.agent_name, ''),
    'BagTag', coalesce(d.bag_tag, '')
  );

  FOR t IN SELECT * FROM public.notification_templates WHERE trigger_key = p_trigger_key AND active LOOP
    IF t.channel = 'email' AND coalesce(d.case_email, '') = '' THEN CONTINUE; END IF;
    IF t.channel IN ('sms','whatsapp') AND coalesce(d.mobile, '') = '' THEN CONTINUE; END IF;

    v_body_en := public.wf_fill_template(t.body_en, v_ctx);
    v_body_ar := public.wf_fill_template(t.body_ar, v_ctx);
    v_subject_en := public.wf_fill_template(t.subject_en, v_ctx);
    v_subject_ar := public.wf_fill_template(t.subject_ar, v_ctx);
    IF btrim(coalesce(CASE WHEN v_locale = 'ar' THEN v_body_ar ELSE v_body_en END, '')) = '' THEN CONTINUE; END IF;

    INSERT INTO public.notification_events(
      delivery_id, case_id, trigger_status, trigger_key, channel, locale,
      recipient, subject, body, subject_en, subject_ar, body_en, body_ar, runtime_context)
    VALUES (
      p_delivery, d.case_id, d.workflow_status, p_trigger_key, t.channel, v_locale,
      CASE WHEN t.channel = 'email' THEN d.case_email ELSE d.mobile END,
      CASE WHEN v_locale = 'ar' THEN v_subject_ar ELSE v_subject_en END,
      CASE WHEN v_locale = 'ar' THEN v_body_ar ELSE v_body_en END,
      v_subject_en, v_subject_ar, v_body_en, v_body_ar, v_ctx);
  END LOOP;
END;
$fn$;

-- 4) Case notifications: same absolute-URL rule.
CREATE OR REPLACE FUNCTION public.wf_queue_case_notification(p_case uuid, p_trigger_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  c record; t record; v_token text; v_link text; v_ctx jsonb; v_locale text; v_base text;
  v_body_en text; v_body_ar text; v_subject_en text; v_subject_ar text;
BEGIN
  SELECT cc.*, (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = cc.id ORDER BY b.seq LIMIT 1) AS bag_tag
    INTO c FROM public.baggage_cases cc WHERE cc.id = p_case;
  IF NOT FOUND THEN RETURN; END IF;

  v_token := public.wf_ensure_case_link(p_case);
  v_base := public.wf_portal_base_url();
  v_link := CASE WHEN v_token IS NULL THEN '' ELSE v_base || '/passenger/' || v_token END;
  v_locale := CASE WHEN public.settings_group('general')->>'default_language' = 'ar' THEN 'ar' ELSE 'en' END;

  v_ctx := jsonb_build_object(
    'PassengerName', c.passenger_name,
    'PIR', coalesce(nullif(c.pir_number, ''), c.case_no),
    'DeliveryID', '',
    'TrackingLink', v_link,
    'AgentName', '',
    'BagTag', coalesce(c.bag_tag, ''),
    'Airline', coalesce(c.airline, ''),
    'FlightNumber', coalesce(c.flight_number, ''),
    'Terminal', coalesce(c.terminal, '')
  );

  FOR t IN SELECT * FROM public.notification_templates WHERE trigger_key = p_trigger_key AND active LOOP
    IF t.channel = 'email' AND coalesce(c.email, '') = '' THEN CONTINUE; END IF;
    IF t.channel IN ('sms','whatsapp') AND coalesce(c.contact_mobile, '') = '' THEN CONTINUE; END IF;

    v_body_en := public.wf_fill_template(t.body_en, v_ctx);
    v_body_ar := public.wf_fill_template(t.body_ar, v_ctx);
    v_subject_en := public.wf_fill_template(t.subject_en, v_ctx);
    v_subject_ar := public.wf_fill_template(t.subject_ar, v_ctx);
    IF btrim(coalesce(CASE WHEN v_locale = 'ar' THEN v_body_ar ELSE v_body_en END, '')) = '' THEN CONTINUE; END IF;

    INSERT INTO public.notification_events(
      delivery_id, case_id, trigger_status, trigger_key, channel, locale,
      recipient, subject, body, subject_en, subject_ar, body_en, body_ar, runtime_context)
    VALUES (
      NULL, c.id, c.workflow_status, p_trigger_key, t.channel, v_locale,
      CASE WHEN t.channel = 'email' THEN c.email ELSE c.contact_mobile END,
      CASE WHEN v_locale = 'ar' THEN v_subject_ar ELSE v_subject_en END,
      CASE WHEN v_locale = 'ar' THEN v_body_ar ELSE v_body_en END,
      v_subject_en, v_subject_ar, v_body_en, v_body_ar, v_ctx);
  END LOOP;
END;
$fn$;
