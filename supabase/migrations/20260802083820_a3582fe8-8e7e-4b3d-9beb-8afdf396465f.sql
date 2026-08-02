-- ============ 1. SYSTEM SETTINGS ============
CREATE TABLE public.system_settings (
  group_key text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);
GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read system settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER system_settings_bump BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

INSERT INTO public.system_settings(group_key, payload) VALUES
 ('general', jsonb_build_object(
    'system_name','Smart Baggage Ecosystem',
    'company_name','International Aviation Business (IAB)',
    'logo_url','',
    'time_zone','Africa/Cairo',
    'date_format','dd/MM/yyyy',
    'default_language','en',
    'distance_unit','km')),
 ('contacts', jsonb_build_object(
    'call_number','',
    'whatsapp_number','',
    'email',''));

-- ============ 2. SLA REGIONS ============
CREATE TABLE public.sla_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text NOT NULL DEFAULT '',
  sla_hours integer NOT NULL DEFAULT 24 CHECK (sla_hours > 0 AND sla_hours <= 2000),
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX sla_regions_name_key ON public.sla_regions (lower(name));
CREATE UNIQUE INDEX sla_regions_one_default ON public.sla_regions (is_default) WHERE is_default;
GRANT SELECT ON public.sla_regions TO authenticated;
GRANT ALL ON public.sla_regions TO service_role;
ALTER TABLE public.sla_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read delivery regions" ON public.sla_regions
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER sla_regions_bump BEFORE UPDATE ON public.sla_regions
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

INSERT INTO public.sla_regions(name, name_ar, sla_hours, is_default, sort_order) VALUES
 ('Cairo','القاهرة',24,true,1),
 ('Giza','الجيزة',24,false,2),
 ('Alexandria','الإسكندرية',48,false,3),
 ('Upper Egypt','صعيد مصر',72,false,4);

INSERT INTO public.system_settings(group_key, payload)
VALUES ('sla', jsonb_build_object('lf_sla_hours', 24));

ALTER TABLE public.baggage_cases
  ADD COLUMN region_id uuid REFERENCES public.sla_regions(id) ON DELETE SET NULL;

-- ============ 3. NOTIFICATION TEMPLATES ============
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key text NOT NULL,
  channel public.notification_channel NOT NULL,
  subject_en text NOT NULL DEFAULT '',
  subject_ar text NOT NULL DEFAULT '',
  body_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  UNIQUE (trigger_key, channel)
);
GRANT SELECT ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read notification templates" ON public.notification_templates
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER notification_templates_bump BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

ALTER TABLE public.notification_events ADD COLUMN trigger_key text NOT NULL DEFAULT '';

INSERT INTO public.notification_templates(trigger_key, channel, subject_en, subject_ar, body_en, body_ar, sort_order) VALUES
 ('DELIVERY_APPROVED','sms','IAB Baggage Delivery','توصيل حقائب IAB',
  'Dear {{PassengerName}}, home delivery of your baggage (PIR {{PIR}}) has been approved. Track: {{TrackingLink}}',
  'عزيزنا {{PassengerName}}، تم اعتماد توصيل حقيبتك (PIR {{PIR}}). للمتابعة: {{TrackingLink}}',1),
 ('DELIVERY_APPROVED','whatsapp','IAB Baggage Delivery','توصيل حقائب IAB',
  'Hello {{PassengerName}}, your home delivery request (PIR {{PIR}}) has been approved. Track: {{TrackingLink}}',
  'مرحباً {{PassengerName}}، تم اعتماد طلب توصيل حقيبتك (PIR {{PIR}}). للمتابعة: {{TrackingLink}}',2),
 ('DELIVERY_APPROVED','email','Your baggage delivery is approved','تم اعتماد توصيل حقيبتك',
  'Dear {{PassengerName}}, home delivery of your baggage (PIR {{PIR}}) has been approved. Track: {{TrackingLink}}',
  'عزيزنا {{PassengerName}}، تم اعتماد توصيل حقيبتك (PIR {{PIR}}). للمتابعة: {{TrackingLink}}',3),
 ('DRIVER_ASSIGNED','sms','IAB Baggage Delivery','توصيل حقائب IAB',
  'Dear {{PassengerName}}, a delivery agent has been assigned to your baggage (PIR {{PIR}}). Track: {{TrackingLink}}',
  'عزيزنا {{PassengerName}}، تم تعيين مندوب لتوصيل حقيبتك (PIR {{PIR}}). للمتابعة: {{TrackingLink}}',4),
 ('DRIVER_ASSIGNED','whatsapp','IAB Baggage Delivery','توصيل حقائب IAB',
  'Hello {{PassengerName}}, delivery agent {{AgentName}} is handling your baggage (PIR {{PIR}}). Track: {{TrackingLink}}',
  'مرحباً {{PassengerName}}، المندوب {{AgentName}} مسؤول عن توصيل حقيبتك (PIR {{PIR}}). للمتابعة: {{TrackingLink}}',5),
 ('DRIVER_ASSIGNED','email','A delivery agent has been assigned','تم تعيين مندوب التوصيل',
  'Dear {{PassengerName}}, delivery agent {{AgentName}} has been assigned to your baggage (PIR {{PIR}}). Track: {{TrackingLink}}',
  'عزيزنا {{PassengerName}}، تم تعيين المندوب {{AgentName}} لتوصيل حقيبتك (PIR {{PIR}}). للمتابعة: {{TrackingLink}}',6),
 ('OUT_FOR_DELIVERY','sms','IAB Baggage Delivery','توصيل حقائب IAB',
  'Dear {{PassengerName}}, your baggage (PIR {{PIR}}) is out for delivery. Track: {{TrackingLink}}',
  'عزيزنا {{PassengerName}}، حقيبتك (PIR {{PIR}}) في الطريق إليك. للمتابعة: {{TrackingLink}}',7),
 ('OUT_FOR_DELIVERY','whatsapp','IAB Baggage Delivery','توصيل حقائب IAB',
  'Hello {{PassengerName}}, your baggage (PIR {{PIR}}) is out for delivery. Track: {{TrackingLink}}',
  'مرحباً {{PassengerName}}، حقيبتك (PIR {{PIR}}) في الطريق إليك. للمتابعة: {{TrackingLink}}',8),
 ('OUT_FOR_DELIVERY','email','Your baggage is out for delivery','حقيبتك في الطريق إليك',
  'Dear {{PassengerName}}, your baggage (PIR {{PIR}}) is out for delivery. Track: {{TrackingLink}}',
  'عزيزنا {{PassengerName}}، حقيبتك (PIR {{PIR}}) في الطريق إليك. للمتابعة: {{TrackingLink}}',9),
 ('DELIVERED','sms','IAB Baggage Delivery','توصيل حقائب IAB',
  'Dear {{PassengerName}}, your baggage (PIR {{PIR}}) has been delivered. Thank you for your patience.',
  'عزيزنا {{PassengerName}}، تم تسليم حقيبتك (PIR {{PIR}}). شكراً لتفهمك.',10),
 ('DELIVERED','whatsapp','IAB Baggage Delivery','توصيل حقائب IAB',
  'Hello {{PassengerName}}, your baggage (PIR {{PIR}}) has been delivered. Thank you for your patience.',
  'مرحباً {{PassengerName}}، تم تسليم حقيبتك (PIR {{PIR}}). شكراً لتفهمك.',11),
 ('DELIVERED','email','Your baggage has been delivered','تم تسليم حقيبتك',
  'Dear {{PassengerName}}, your baggage (PIR {{PIR}}) has been delivered. Thank you for your patience.',
  'عزيزنا {{PassengerName}}، تم تسليم حقيبتك (PIR {{PIR}}). شكراً لتفهمك.',12),
 ('DELIVERY_FAILED','sms','IAB Baggage Delivery','توصيل حقائب IAB',
  'Dear {{PassengerName}}, we could not complete the delivery of your baggage (PIR {{PIR}}). Our team will contact you.',
  'عزيزنا {{PassengerName}}، تعذّر إتمام تسليم حقيبتك (PIR {{PIR}}). سيتواصل معك فريقنا.',13),
 ('DELIVERY_FAILED','whatsapp','IAB Baggage Delivery','توصيل حقائب IAB',
  'Hello {{PassengerName}}, we could not complete the delivery of your baggage (PIR {{PIR}}). Our team will contact you.',
  'مرحباً {{PassengerName}}، تعذّر إتمام تسليم حقيبتك (PIR {{PIR}}). سيتواصل معك فريقنا.',14),
 ('DELIVERY_FAILED','email','Delivery attempt unsuccessful','تعذّر إتمام التسليم',
  'Dear {{PassengerName}}, we could not complete the delivery of your baggage (PIR {{PIR}}). Our team will contact you.',
  'عزيزنا {{PassengerName}}، تعذّر إتمام تسليم حقيبتك (PIR {{PIR}}). سيتواصل معك فريقنا.',15),
 ('RETURNED_TO_AIRPORT','sms','IAB Baggage Delivery','توصيل حقائب IAB',
  'Dear {{PassengerName}}, your baggage (PIR {{PIR}}) has returned to the airport and will be re-scheduled.',
  'عزيزنا {{PassengerName}}، عادت حقيبتك (PIR {{PIR}}) إلى المطار وسيتم إعادة جدولة التسليم.',16),
 ('RETURNED_TO_AIRPORT','whatsapp','IAB Baggage Delivery','توصيل حقائب IAB',
  'Hello {{PassengerName}}, your baggage (PIR {{PIR}}) has returned to the airport and will be re-scheduled.',
  'مرحباً {{PassengerName}}، عادت حقيبتك (PIR {{PIR}}) إلى المطار وسيتم إعادة جدولة التسليم.',17),
 ('RETURNED_TO_AIRPORT','email','Your baggage returned to the airport','عادت حقيبتك إلى المطار',
  'Dear {{PassengerName}}, your baggage (PIR {{PIR}}) has returned to the airport and will be re-scheduled.',
  'عزيزنا {{PassengerName}}، عادت حقيبتك (PIR {{PIR}}) إلى المطار وسيتم إعادة جدولة التسليم.',18);

-- ============ 4. SETTINGS ACCESS FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.settings_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(auth.uid(),'Administration','Manage')
      OR public.has_role(auth.uid(),'admin')
$$;

CREATE OR REPLACE FUNCTION public.settings_group(p_group text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT payload FROM public.system_settings WHERE group_key = p_group), '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.settings_get_all()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'general', public.settings_group('general'),
    'contacts', public.settings_group('contacts'),
    'sla', public.settings_group('sla'),
    'can_manage', public.settings_is_admin(),
    'regions', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'name_ar', r.name_ar, 'sla_hours', r.sla_hours,
        'is_default', r.is_default, 'active', r.active, 'sort_order', r.sort_order)
        ORDER BY r.sort_order, r.name) FROM public.sla_regions r), '[]'::jsonb),
    'templates', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'trigger_key', t.trigger_key, 'channel', t.channel,
        'subject_en', t.subject_en, 'subject_ar', t.subject_ar,
        'body_en', t.body_en, 'body_ar', t.body_ar, 'active', t.active)
        ORDER BY t.sort_order) FROM public.notification_templates t), '[]'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION public.settings_get_public()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'contacts', public.settings_group('contacts'),
    'company_name', coalesce(public.settings_group('general')->>'company_name',''),
    'system_name', coalesce(public.settings_group('general')->>'system_name',''),
    'logo_url', coalesce(public.settings_group('general')->>'logo_url',''),
    'default_language', coalesce(public.settings_group('general')->>'default_language','en'))
$$;
GRANT EXECUTE ON FUNCTION public.settings_get_public() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.settings_save(p_group text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  IF NOT public.settings_is_admin() THEN
    RAISE EXCEPTION 'Only Airport Administrators can change System Settings' USING ERRCODE = '42501';
  END IF;
  IF p_group NOT IN ('general','contacts','sla') THEN
    RAISE EXCEPTION 'Unknown settings group %', p_group USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.system_settings(group_key, payload, updated_by)
  VALUES (p_group, coalesce(p_payload,'{}'::jsonb), auth.uid())
  ON CONFLICT (group_key) DO UPDATE
    SET payload = EXCLUDED.payload, updated_by = auth.uid();

  SELECT * INTO a FROM public.wf_actor();
  INSERT INTO public.admin_audit_log(actor_user_id, actor_name, actor_role, action, target, details)
  VALUES (auth.uid(), coalesce(a.display_name,'Administrator'), 'Administration',
          'settings.save', p_group, 'System Settings updated');
  PERFORM public.wf_journal_event('system', format('System Settings updated · %s', p_group),
    'Configuration changed by an administrator', NULL, NULL, 'settings.save',
    jsonb_build_object('group', p_group));
  RETURN public.settings_group(p_group);
END; $$;

CREATE OR REPLACE FUNCTION public.sla_region_upsert(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_hours integer; v_default boolean;
BEGIN
  IF NOT public.settings_is_admin() THEN
    RAISE EXCEPTION 'Only Airport Administrators can change SLA configuration' USING ERRCODE = '42501';
  END IF;
  v_id := nullif(p_payload->>'id','')::uuid;
  v_hours := coalesce(nullif(p_payload->>'sla_hours','')::int, 24);
  IF v_hours <= 0 THEN RAISE EXCEPTION 'SLA hours must be greater than zero' USING ERRCODE = '23514'; END IF;
  v_default := coalesce((p_payload->>'is_default')::boolean, false);
  IF v_default THEN UPDATE public.sla_regions SET is_default = false WHERE is_default; END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.sla_regions(name, name_ar, sla_hours, is_default, active, sort_order)
    VALUES (btrim(coalesce(p_payload->>'name','')), coalesce(p_payload->>'name_ar',''), v_hours,
            v_default, coalesce((p_payload->>'active')::boolean, true),
            coalesce(nullif(p_payload->>'sort_order','')::int,
                     (SELECT coalesce(max(sort_order),0)+1 FROM public.sla_regions)))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.sla_regions SET
      name = coalesce(nullif(btrim(p_payload->>'name'),''), name),
      name_ar = coalesce(p_payload->>'name_ar', name_ar),
      sla_hours = v_hours,
      is_default = v_default,
      active = coalesce((p_payload->>'active')::boolean, active),
      sort_order = coalesce(nullif(p_payload->>'sort_order','')::int, sort_order)
    WHERE id = v_id;
  END IF;

  PERFORM public.wf_journal_event('system', 'Delivery SLA updated',
    format('Region "%s" SLA set to %s hours', coalesce(p_payload->>'name','region'), v_hours),
    NULL, NULL, 'settings.sla_region', p_payload);
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.sla_region_delete(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.settings_is_admin() THEN
    RAISE EXCEPTION 'Only Airport Administrators can change SLA configuration' USING ERRCODE = '42501';
  END IF;
  IF (SELECT is_default FROM public.sla_regions WHERE id = p_id) THEN
    RAISE EXCEPTION 'The default region cannot be deleted. Mark another region as default first.'
      USING ERRCODE = '23514';
  END IF;
  DELETE FROM public.sla_regions WHERE id = p_id;
  PERFORM public.wf_journal_event('system', 'Delivery region removed', '', NULL, NULL,
    'settings.sla_region_delete', jsonb_build_object('id', p_id));
END; $$;

CREATE OR REPLACE FUNCTION public.notif_template_upsert(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.settings_is_admin() THEN
    RAISE EXCEPTION 'Only Airport Administrators can change notification templates' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.notification_templates(trigger_key, channel, subject_en, subject_ar,
    body_en, body_ar, active, updated_by)
  VALUES (p_payload->>'trigger_key', (p_payload->>'channel')::public.notification_channel,
    coalesce(p_payload->>'subject_en',''), coalesce(p_payload->>'subject_ar',''),
    coalesce(p_payload->>'body_en',''), coalesce(p_payload->>'body_ar',''),
    coalesce((p_payload->>'active')::boolean, true), auth.uid())
  ON CONFLICT (trigger_key, channel) DO UPDATE SET
    subject_en = EXCLUDED.subject_en, subject_ar = EXCLUDED.subject_ar,
    body_en = EXCLUDED.body_en, body_ar = EXCLUDED.body_ar,
    active = EXCLUDED.active, updated_by = auth.uid()
  RETURNING id INTO v_id;

  PERFORM public.wf_journal_event('notification', 'Notification template updated',
    format('%s · %s', p_payload->>'trigger_key', p_payload->>'channel'), NULL, NULL,
    'settings.template', jsonb_build_object('trigger', p_payload->>'trigger_key',
      'channel', p_payload->>'channel'));
  RETURN v_id;
END; $$;

-- ============ 5. TEMPLATE-DRIVEN NOTIFICATION QUEUEING ============
CREATE OR REPLACE FUNCTION public.wf_fill_template(p_text text, p_ctx jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT replace(replace(replace(replace(replace(coalesce(p_text,''),
    '{{PassengerName}}', coalesce(p_ctx->>'PassengerName','')),
    '{{PIR}}', coalesce(p_ctx->>'PIR','')),
    '{{TrackingLink}}', coalesce(p_ctx->>'TrackingLink','')),
    '{{AgentName}}', coalesce(p_ctx->>'AgentName','')),
    '{{BagTag}}', coalesce(p_ctx->>'BagTag',''))
$$;

CREATE OR REPLACE FUNCTION public.wf_queue_notification_key(p_delivery uuid, p_trigger_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record; v_token text; v_link text; v_ctx jsonb; t record;
  v_locale text; v_body text; v_subject text; v_base text;
BEGIN
  SELECT dd.*, c.pir_number, c.case_no, c.email AS case_email,
         (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = c.id ORDER BY b.seq LIMIT 1) AS bag_tag,
         (SELECT u.full_name FROM public.app_users u WHERE u.id = dd.assigned_agent_id) AS agent_name
    INTO d
  FROM public.deliveries dd JOIN public.baggage_cases c ON c.id = dd.case_id
  WHERE dd.id = p_delivery;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT token INTO v_token FROM public.passenger_links
   WHERE delivery_id = p_delivery AND revoked_at IS NULL LIMIT 1;
  v_base := coalesce(nullif(public.settings_group('general')->>'portal_base_url',''), '');
  v_link := CASE WHEN v_token IS NULL THEN '' ELSE v_base || '/passenger/' || v_token END;
  v_locale := coalesce(nullif(public.settings_group('general')->>'default_language',''),'en');

  v_ctx := jsonb_build_object(
    'PassengerName', d.passenger_name,
    'PIR', coalesce(nullif(d.pir_number,''), d.case_no),
    'TrackingLink', v_link,
    'AgentName', coalesce(d.agent_name,''),
    'BagTag', coalesce(d.bag_tag,''));

  FOR t IN SELECT * FROM public.notification_templates
            WHERE trigger_key = p_trigger_key AND active LOOP
    IF t.channel = 'email' AND coalesce(d.case_email,'') = '' THEN CONTINUE; END IF;
    IF t.channel IN ('sms','whatsapp') AND coalesce(d.mobile,'') = '' THEN CONTINUE; END IF;

    v_body := public.wf_fill_template(
      CASE WHEN v_locale = 'ar' THEN t.body_ar ELSE t.body_en END, v_ctx);
    v_subject := public.wf_fill_template(
      CASE WHEN v_locale = 'ar' THEN t.subject_ar ELSE t.subject_en END, v_ctx);
    IF btrim(coalesce(v_body,'')) = '' THEN CONTINUE; END IF;

    INSERT INTO public.notification_events(delivery_id, case_id, trigger_status, trigger_key,
      channel, locale, recipient, subject, body)
    VALUES (p_delivery, d.case_id, d.workflow_status, p_trigger_key, t.channel, v_locale,
      CASE WHEN t.channel = 'email' THEN d.case_email ELSE d.mobile END,
      v_subject, v_body);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.wf_queue_notification(p_delivery uuid, p_trigger workflow_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.wf_queue_notification_key(p_delivery, p_trigger::text);
END; $$;

-- ============ 6. SLA BREACH ENGINE (reads System Settings) ============
CREATE OR REPLACE FUNCTION public.sla_delivery_hours(p_case uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT r.sla_hours FROM public.baggage_cases c
       JOIN public.sla_regions r ON r.id = c.region_id AND r.active
      WHERE c.id = p_case),
    (SELECT r.sla_hours FROM public.sla_regions r WHERE r.is_default AND r.active LIMIT 1),
    24)
$$;

CREATE OR REPLACE FUNCTION public.qm_sweep_sla()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0; v_lf_hours integer; v_hours integer;
BEGIN
  v_lf_hours := coalesce(nullif(public.settings_group('sla')->>'lf_sla_hours','')::int, 24);

  -- Lost & Found: Arrived at Airport → Ready for Delivery
  FOR r IN
    SELECT c.id, coalesce(nullif(c.pir_number,''), c.case_no) AS ref, c.lf_status,
           coalesce((SELECT max(w.occurred_at) FROM public.workflow_events w
                      WHERE w.case_id = c.id AND w.to_status = 'DELIVERY_APPROVED'),
                    c.updated_at) AS since
      FROM public.baggage_cases c
     WHERE c.lf_status IN ('Arrived at Airport','Waiting Customs Clearance')
  LOOP
    IF r.since IS NOT NULL
       AND extract(epoch FROM (now() - r.since)) / 3600 > v_lf_hours THEN
      PERFORM public.qm_raise_incident('sla', 'Late Delivery',
        format('Case %s has been waiting at the airport for longer than the %s hour Lost & Found service target.',
               r.ref, v_lf_hours),
        r.id, NULL,
        format('sla-lf:%s:%s', r.id, to_char(r.since, 'YYYYMMDDHH24MI')),
        NULL, 'Workflow Engine');
      n := n + 1;
    END IF;
  END LOOP;

  -- Home Delivery: region SLA measured from the moment the delivery was opened
  FOR r IN
    SELECT d.id, d.delivery_no, d.case_id, d.stage, d.created_at AS since,
           public.sla_delivery_hours(d.case_id) AS hours
      FROM public.deliveries d
     WHERE d.stage NOT IN ('Delivered','Returned to Airport','Delivery Failed')
  LOOP
    v_hours := r.hours;
    IF extract(epoch FROM (now() - r.since)) / 3600 > v_hours THEN
      PERFORM public.qm_raise_incident('sla', 'Late Delivery',
        format('Delivery %s has exceeded the %s hour delivery service target (currently "%s").',
               r.delivery_no, v_hours, r.stage),
        r.case_id, r.id,
        format('sla-dm:%s:%s', r.id, to_char(r.since, 'YYYYMMDDHH24MI')),
        NULL, 'Workflow Engine');
      n := n + 1;
    END IF;
  END LOOP;

  RETURN n;
END; $$;

DROP TABLE IF EXISTS public.sla_policies;

-- ============ 7. REALTIME ============
ALTER TABLE public.system_settings REPLICA IDENTITY FULL;
ALTER TABLE public.sla_regions REPLICA IDENTITY FULL;
ALTER TABLE public.notification_templates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sla_regions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_templates;