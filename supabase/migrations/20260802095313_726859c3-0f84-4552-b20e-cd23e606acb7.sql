ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS subject_en text,
  ADD COLUMN IF NOT EXISTS subject_ar text,
  ADD COLUMN IF NOT EXISTS body_en text,
  ADD COLUMN IF NOT EXISTS body_ar text,
  ADD COLUMN IF NOT EXISTS runtime_context jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.notification_events n
SET subject_en = CASE WHEN n.locale = 'en' THEN n.subject ELSE n.subject_en END,
    body_en = CASE WHEN n.locale = 'en' THEN n.body ELSE n.body_en END,
    subject_ar = CASE WHEN n.locale = 'ar' THEN n.subject ELSE n.subject_ar END,
    body_ar = CASE WHEN n.locale = 'ar' THEN n.body ELSE n.body_ar END,
    runtime_context = n.runtime_context || jsonb_strip_nulls(jsonb_build_object(
      'DeliveryID', d.delivery_no,
      'PassengerName', c.passenger_name,
      'PIR', coalesce(nullif(c.pir_number, ''), c.case_no)
    ))
FROM public.deliveries d
JOIN public.baggage_cases c ON c.id = d.case_id
WHERE n.delivery_id = d.id;

CREATE OR REPLACE FUNCTION public.wf_queue_notification_key(p_delivery uuid, p_trigger_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d record;
  v_token text;
  v_link text;
  v_ctx jsonb;
  t record;
  v_locale text;
  v_body_en text;
  v_body_ar text;
  v_subject_en text;
  v_subject_ar text;
  v_base text;
BEGIN
  SELECT dd.*, c.pir_number, c.case_no, c.email AS case_email,
         (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = c.id ORDER BY b.seq LIMIT 1) AS bag_tag,
         (SELECT u.full_name FROM public.app_users u WHERE u.id = dd.assigned_agent_id) AS agent_name
    INTO d
  FROM public.deliveries dd
  JOIN public.baggage_cases c ON c.id = dd.case_id
  WHERE dd.id = p_delivery;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT token INTO v_token
  FROM public.passenger_links
  WHERE delivery_id = p_delivery AND revoked_at IS NULL
  ORDER BY issued_at DESC
  LIMIT 1;

  v_base := coalesce(nullif(public.settings_group('general')->>'portal_base_url', ''), '');
  v_link := CASE WHEN v_token IS NULL THEN '' ELSE v_base || '/passenger/' || v_token END;
  v_locale := CASE
    WHEN public.settings_group('general')->>'default_language' = 'ar' THEN 'ar'
    ELSE 'en'
  END;

  v_ctx := jsonb_build_object(
    'PassengerName', d.passenger_name,
    'PIR', coalesce(nullif(d.pir_number, ''), d.case_no),
    'DeliveryID', d.delivery_no,
    'TrackingLink', v_link,
    'AgentName', coalesce(d.agent_name, ''),
    'BagTag', coalesce(d.bag_tag, '')
  );

  FOR t IN
    SELECT *
    FROM public.notification_templates
    WHERE trigger_key = p_trigger_key AND active
  LOOP
    IF t.channel = 'email' AND coalesce(d.case_email, '') = '' THEN CONTINUE; END IF;
    IF t.channel IN ('sms', 'whatsapp') AND coalesce(d.mobile, '') = '' THEN CONTINUE; END IF;

    v_body_en := public.wf_fill_template(t.body_en, v_ctx);
    v_body_ar := public.wf_fill_template(t.body_ar, v_ctx);
    v_subject_en := public.wf_fill_template(t.subject_en, v_ctx);
    v_subject_ar := public.wf_fill_template(t.subject_ar, v_ctx);

    IF btrim(coalesce(CASE WHEN v_locale = 'ar' THEN v_body_ar ELSE v_body_en END, '')) = '' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notification_events(
      delivery_id, case_id, trigger_status, trigger_key, channel, locale,
      recipient, subject, body, subject_en, subject_ar, body_en, body_ar,
      runtime_context
    )
    VALUES (
      p_delivery, d.case_id, d.workflow_status, p_trigger_key, t.channel, v_locale,
      CASE WHEN t.channel = 'email' THEN d.case_email ELSE d.mobile END,
      CASE WHEN v_locale = 'ar' THEN v_subject_ar ELSE v_subject_en END,
      CASE WHEN v_locale = 'ar' THEN v_body_ar ELSE v_body_en END,
      v_subject_en, v_subject_ar, v_body_en, v_body_ar, v_ctx
    );
  END LOOP;
END;
$function$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_events;
  END IF;
END
$do$;