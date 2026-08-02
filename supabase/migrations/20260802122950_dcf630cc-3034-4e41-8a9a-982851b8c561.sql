-- 1. Passenger links may now belong to a case with no delivery (Airport Pickup)
ALTER TABLE public.passenger_links ALTER COLUMN delivery_id DROP NOT NULL;

-- 2. Status mapping
CREATE OR REPLACE FUNCTION public.wf_lf_workflow(p lf_status)
RETURNS workflow_status LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  SELECT CASE p
    WHEN 'Open' THEN 'PIR_CREATED'
    WHEN 'Tracing' THEN 'PIR_CREATED'
    WHEN 'Located' THEN 'HOME_DELIVERY_REQUESTED'
    WHEN 'Arrived at Airport' THEN 'DELIVERY_APPROVED'
    WHEN 'Waiting Customs Clearance' THEN 'DELIVERY_APPROVED'
    WHEN 'Ready for Delivery' THEN 'READY_FOR_COLLECTION'
    WHEN 'Ready for Airport Pickup' THEN 'READY_FOR_AIRPORT_PICKUP'
    WHEN 'Assigned Driver' THEN 'DRIVER_ASSIGNED'
    WHEN 'Out for Delivery' THEN 'OUT_FOR_DELIVERY'
    WHEN 'Delivered' THEN 'DELIVERED'
    WHEN 'Passenger Picked Up' THEN 'PASSENGER_PICKED_UP'
    ELSE 'CLOSED' END::public.workflow_status
$function$;

-- 3. Which statuses each operational path owns
CREATE OR REPLACE FUNCTION public.lf_allowed_statuses(p_method delivery_method)
RETURNS lf_status[] LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  SELECT CASE WHEN p_method = 'Airport Pickup'
    THEN ARRAY['Open','Tracing','Located','Arrived at Airport',
               'Waiting Customs Clearance','Ready for Airport Pickup',
               'Passenger Picked Up']::public.lf_status[]
    ELSE ARRAY['Open','Tracing','Located','Arrived at Airport',
               'Waiting Customs Clearance','Ready for Delivery']::public.lf_status[]
  END
$function$;

-- 4. Case-level passenger link (Airport Pickup has no delivery row)
CREATE OR REPLACE FUNCTION public.wf_ensure_case_link(p_case uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_token text;
BEGIN
  SELECT token INTO v_token FROM public.passenger_links
   WHERE case_id = p_case AND delivery_id IS NULL AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY issued_at DESC LIMIT 1;
  IF v_token IS NOT NULL THEN RETURN v_token; END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.passenger_links(token, delivery_id, case_id, channel, expires_at)
  VALUES (v_token, NULL, p_case, 'sms', now() + interval '30 days');
  RETURN v_token;
END; $function$;

-- 5. Case-level notification queueing (Airport Pickup triggers)
CREATE OR REPLACE FUNCTION public.wf_queue_case_notification(p_case uuid, p_trigger_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  c record; t record; v_token text; v_link text; v_ctx jsonb; v_locale text; v_base text;
  v_body_en text; v_body_ar text; v_subject_en text; v_subject_ar text;
BEGIN
  SELECT cc.*, (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = cc.id ORDER BY b.seq LIMIT 1) AS bag_tag
    INTO c FROM public.baggage_cases cc WHERE cc.id = p_case;
  IF NOT FOUND THEN RETURN; END IF;

  v_token := public.wf_ensure_case_link(p_case);
  v_base := coalesce(nullif(public.settings_group('general')->>'portal_base_url', ''), '');
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
END; $function$;

-- 6. Branching status engine
CREATE OR REPLACE FUNCTION public.lf_set_status(p_case uuid, p_status lf_status, p_expected_version integer DEFAULT NULL::integer)
RETURNS baggage_cases LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c public.baggage_cases%ROWTYPE; v_from public.lf_status; v_allowed public.lf_status[];
BEGIN
  PERFORM public.wf_require(ARRAY['agent','coordinator']);
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
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

-- 7. Airport Pickup cases can never produce a delivery order
CREATE OR REPLACE FUNCTION public.wf_block_pickup_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.baggage_cases c
              WHERE c.id = NEW.case_id AND c.delivery_method = 'Airport Pickup') THEN
    RAISE EXCEPTION 'Airport Pickup cases are not handled by Delivery Management.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_block_pickup_delivery ON public.deliveries;
CREATE TRIGGER trg_block_pickup_delivery BEFORE INSERT ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.wf_block_pickup_delivery();

-- 8. "Closed" is no longer an operational outcome
DROP FUNCTION IF EXISTS public.dm_close(uuid);

-- 9. Passenger portal serves case-only (Airport Pickup) links
CREATE OR REPLACE FUNCTION public.passenger_get_view(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE l public.passenger_links%ROWTYPE; v public.passenger_view%ROWTYPE; c record; expose boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN NULL; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN NULL; END IF;

  UPDATE public.passenger_links SET view_count = view_count + 1, last_viewed_at = now() WHERE id = l.id;

  IF l.delivery_id IS NULL THEN
    SELECT cc.passenger_name, cc.lf_status, cc.workflow_status, cc.delivery_method,
           coalesce(nullif(cc.pir_number,''), cc.case_no) AS pir_number,
           cc.airline, cc.flight_number, cc.arrival_date, cc.terminal, cc.resolved_at,
           (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = cc.id ORDER BY b.seq LIMIT 1) AS bag_tag
      INTO c FROM public.baggage_cases cc WHERE cc.id = l.case_id;
    IF NOT FOUND THEN RETURN NULL; END IF;
    RETURN jsonb_build_object(
      'passenger_name', c.passenger_name,
      'journey', 'pickup',
      'delivery_method', c.delivery_method,
      'stage', NULL,
      'lf_status', c.lf_status,
      'status', c.workflow_status,
      'pir_number', c.pir_number,
      'bag_tag', c.bag_tag,
      'airline', c.airline,
      'flight_no', c.flight_number,
      'flight_date', c.arrival_date,
      'terminal', coalesce(c.terminal, ''),
      'delivered_at', c.resolved_at,
      'otp_code', NULL);
  END IF;

  SELECT * INTO v FROM public.passenger_view WHERE delivery_id = l.delivery_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  expose := v.stage IN ('Out for Delivery','Delivery Failed')
            AND coalesce(v.otp_state::text,'') NOT IN ('Verified','Expired');

  RETURN jsonb_build_object(
    'passenger_name', v.passenger_name,
    'journey', 'delivery',
    'delivery_method', 'Home Delivery',
    'stage', v.stage,
    'status', v.workflow_status,
    'pir_number', v.pir_number,
    'bag_tag', v.bag_tag,
    'airline', v.airline,
    'flight_no', v.flight_no,
    'flight_date', v.flight_date,
    'delivered_at', v.delivered_at,
    'otp_code', CASE WHEN expose THEN v.otp_code ELSE NULL END);
END; $function$;

-- 10. Feedback is only meaningful for a delivery
CREATE OR REPLACE FUNCTION public.passenger_submit_feedback(p_token text, p_rating integer, p_resolved boolean, p_comments text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE l public.passenger_links%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN false; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL OR l.delivery_id IS NULL THEN RETURN false; END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN false; END IF;

  INSERT INTO public.passenger_feedback(delivery_id, case_id, link_id, rating, resolved, comments)
  VALUES (l.delivery_id, l.case_id, l.id, p_rating, coalesce(p_resolved, true), coalesce(p_comments, ''))
  ON CONFLICT (delivery_id) DO UPDATE
    SET rating = EXCLUDED.rating, resolved = EXCLUDED.resolved,
        comments = EXCLUDED.comments, submitted_at = now();

  PERFORM public.wf_journal_event('feedback', 'Passenger feedback submitted',
    format('Rating %s / 5', p_rating), l.case_id, l.delivery_id, 'feedback.submit', '{}'::jsonb);
  RETURN true;
END; $function$;

-- 11. Dashboard counters recognise the Airport Pickup statuses
DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'dashboard_executive';

  src := replace(src, $q$NOT IN ('Delivered','Closed')$q$,
                      $q$NOT IN ('Delivered','Closed','Passenger Picked Up')$q$);
  src := replace(src, $q$IN ('Located','Arrived at Airport','Waiting Customs Clearance',
                                'Ready for Delivery','Assigned Driver','Out for Delivery',
                                'Delivered','Closed')$q$,
                      $q$IN ('Located','Arrived at Airport','Waiting Customs Clearance',
                                'Ready for Delivery','Ready for Airport Pickup','Assigned Driver','Out for Delivery',
                                'Delivered','Closed','Passenger Picked Up')$q$);
  src := replace(src, $q$c.lf_status::text = 'Ready for Delivery'$q$,
                      $q$c.lf_status::text IN ('Ready for Delivery','Ready for Airport Pickup')$q$);
  src := replace(src, $q$INTO k_delivered FROM public.baggage_cases c
   WHERE c.lf_status::text IN ('Delivered','Closed')$q$,
                      $q$INTO k_delivered FROM public.baggage_cases c
   WHERE c.lf_status::text IN ('Delivered','Closed','Passenger Picked Up')$q$);
  src := replace(src, $q$w.to_status::text = 'READY_FOR_COLLECTION'$q$,
                      $q$w.to_status::text IN ('READY_FOR_COLLECTION','READY_FOR_AIRPORT_PICKUP')$q$);
  EXECUTE src;
END $do$;