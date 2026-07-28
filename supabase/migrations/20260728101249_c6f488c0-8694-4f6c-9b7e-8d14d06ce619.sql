-- ============================================================
-- Phase 1 · Migration 4 — Workflow Engine
-- ============================================================

-- ---------- Internal: actor resolution ----------
CREATE OR REPLACE FUNCTION public.wf_actor()
RETURNS TABLE(app_user_id uuid, display_name text, role_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id,
         coalesce(nullif(u.full_name,''), u.username, 'System'),
         (SELECT ur.role::text FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
          ORDER BY CASE ur.role WHEN 'admin' THEN 0 ELSE 1 END LIMIT 1)
  FROM public.app_users u
  WHERE u.user_id = auth.uid() AND u.status = 'Active'
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.wf_actor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_actor() TO authenticated;

-- ---------- Internal: mappings ----------
CREATE OR REPLACE FUNCTION public.wf_stage_workflow(p public.delivery_stage)
RETURNS public.workflow_status LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p
    WHEN 'Ready for Delivery' THEN 'READY_FOR_COLLECTION'
    WHEN 'Scheduled' THEN 'DELIVERY_APPROVED'
    WHEN 'Assigned' THEN 'DRIVER_ASSIGNED'
    WHEN 'Driver Accepted' THEN 'DRIVER_ASSIGNED'
    WHEN 'Collected Bag' THEN 'CLAIMED_ON_HAND'
    WHEN 'Out for Delivery' THEN 'OUT_FOR_DELIVERY'
    WHEN 'Delivered' THEN 'DELIVERED'
    WHEN 'Delivery Failed' THEN 'OUT_FOR_DELIVERY'
    WHEN 'Returned to Airport' THEN 'DELIVERY_APPROVED'
  END::public.workflow_status
$$;

CREATE OR REPLACE FUNCTION public.wf_stage_lf(p public.delivery_stage)
RETURNS public.lf_status LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p
    WHEN 'Ready for Delivery' THEN 'Ready for Delivery'
    WHEN 'Scheduled' THEN 'Ready for Delivery'
    WHEN 'Assigned' THEN 'Assigned Driver'
    WHEN 'Driver Accepted' THEN 'Assigned Driver'
    WHEN 'Collected Bag' THEN 'Assigned Driver'
    WHEN 'Out for Delivery' THEN 'Out for Delivery'
    WHEN 'Delivered' THEN 'Delivered'
    WHEN 'Delivery Failed' THEN 'Out for Delivery'
    WHEN 'Returned to Airport' THEN 'Ready for Delivery'
  END::public.lf_status
$$;

CREATE OR REPLACE FUNCTION public.wf_stage_allowed(
  p_from public.delivery_stage, p_to public.delivery_stage)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_from
    WHEN 'Ready for Delivery'   THEN p_to IN ('Scheduled','Assigned')
    WHEN 'Scheduled'            THEN p_to IN ('Assigned','Ready for Delivery')
    WHEN 'Assigned'             THEN p_to IN ('Driver Accepted','Scheduled','Assigned','Delivery Failed')
    WHEN 'Driver Accepted'      THEN p_to IN ('Collected Bag','Delivery Failed')
    WHEN 'Collected Bag'        THEN p_to IN ('Out for Delivery','Delivery Failed')
    WHEN 'Out for Delivery'     THEN p_to IN ('Delivered','Delivery Failed')
    WHEN 'Delivery Failed'      THEN p_to IN ('Returned to Airport','Scheduled')
    WHEN 'Returned to Airport'  THEN p_to IN ('Scheduled','Assigned')
    WHEN 'Delivered'            THEN false
    ELSE false
  END
$$;

-- ---------- Internal: journals ----------
CREATE OR REPLACE FUNCTION public.wf_journal(
  p_case uuid, p_delivery uuid,
  p_from public.workflow_status, p_to public.workflow_status,
  p_from_stage public.delivery_stage, p_to_stage public.delivery_stage,
  p_module public.timeline_module, p_title text, p_detail text,
  p_action text, p_reason text DEFAULT '', p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_ref text;
BEGIN
  SELECT * INTO a FROM public.wf_actor();
  SELECT coalesce(d.delivery_no, c.pir_number, '') INTO v_ref
  FROM public.baggage_cases c
  LEFT JOIN public.deliveries d ON d.id = p_delivery
  WHERE c.id = p_case;

  INSERT INTO public.workflow_events(case_id, delivery_id, from_status, to_status,
    from_stage, to_stage, actor_user_id, actor_name, actor_role, reason, metadata)
  VALUES (p_case, p_delivery, p_from, p_to, p_from_stage, p_to_stage,
    auth.uid(), coalesce(a.display_name,'System'), a.role_key, coalesce(p_reason,''), p_metadata);

  INSERT INTO public.timeline_events(module, case_id, delivery_id, reference, title,
    detail, status, actor_user_id, actor_name, metadata)
  VALUES (p_module, p_case, p_delivery, coalesce(v_ref,''), p_title, coalesce(p_detail,''),
    coalesce(p_to::text,''), auth.uid(), coalesce(a.display_name,'System'), p_metadata);

  INSERT INTO public.audit_events(actor_user_id, actor_name, actor_role, action,
    entity_type, entity_id, case_id, delivery_id, note, metadata)
  VALUES (auth.uid(), coalesce(a.display_name,'System'), a.role_key, p_action,
    CASE WHEN p_delivery IS NOT NULL THEN 'delivery' ELSE 'case' END,
    coalesce(v_ref,''), p_case, p_delivery, coalesce(p_detail,''), p_metadata);
END; $$;
REVOKE EXECUTE ON FUNCTION public.wf_journal(uuid,uuid,public.workflow_status,public.workflow_status,public.delivery_stage,public.delivery_stage,public.timeline_module,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;

-- ---------- Internal: passenger projection ----------
CREATE OR REPLACE FUNCTION public.wf_refresh_passenger_view(p_delivery uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.passenger_view (delivery_id, case_id, passenger_name, stage,
    workflow_status, pir_number, bag_tag, airline, flight_no, flight_date,
    otp_code, otp_state, delivered_at, updated_at)
  SELECT d.id, d.case_id, d.passenger_name, d.stage, d.workflow_status, c.pir_number,
         (SELECT b.bag_tag FROM public.case_bags b WHERE b.case_id = c.id ORDER BY b.seq LIMIT 1),
         c.airline, c.flight_number, c.arrival_date,
         o.code, o.state, d.delivered_at, now()
  FROM public.deliveries d
  JOIN public.baggage_cases c ON c.id = d.case_id
  LEFT JOIN LATERAL (
    SELECT code, state FROM public.otp_challenges
    WHERE delivery_id = d.id ORDER BY issued_at DESC LIMIT 1) o ON true
  WHERE d.id = p_delivery
  ON CONFLICT (delivery_id) DO UPDATE SET
    passenger_name = EXCLUDED.passenger_name, stage = EXCLUDED.stage,
    workflow_status = EXCLUDED.workflow_status, pir_number = EXCLUDED.pir_number,
    bag_tag = EXCLUDED.bag_tag, airline = EXCLUDED.airline,
    flight_no = EXCLUDED.flight_no, flight_date = EXCLUDED.flight_date,
    otp_code = EXCLUDED.otp_code, otp_state = EXCLUDED.otp_state,
    delivered_at = EXCLUDED.delivered_at, updated_at = now();
END; $$;
REVOKE EXECUTE ON FUNCTION public.wf_refresh_passenger_view(uuid) FROM PUBLIC, anon, authenticated;

-- ---------- Internal: notification queue ----------
CREATE OR REPLACE FUNCTION public.wf_queue_notification(
  p_delivery uuid, p_trigger public.workflow_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; v_token text; v_link text; v_body text; ch public.notification_channel;
BEGIN
  SELECT dd.*, c.pir_number INTO d
  FROM public.deliveries dd JOIN public.baggage_cases c ON c.id = dd.case_id
  WHERE dd.id = p_delivery;
  IF NOT FOUND OR coalesce(d.mobile,'') = '' THEN RETURN; END IF;

  SELECT token INTO v_token FROM public.passenger_links
  WHERE delivery_id = p_delivery AND revoked_at IS NULL LIMIT 1;
  v_link := CASE WHEN v_token IS NULL THEN '' ELSE '/passenger/' || v_token END;

  v_body := CASE p_trigger
    WHEN 'DRIVER_ASSIGNED' THEN format(
      'Dear %s, a Delivery Agent has been assigned to your baggage (PIR %s). Track your delivery: %s',
      d.passenger_name, d.pir_number, v_link)
    WHEN 'OUT_FOR_DELIVERY' THEN format(
      'Dear %s, your baggage (PIR %s) is out for delivery. Track it here: %s',
      d.passenger_name, d.pir_number, v_link)
    WHEN 'DELIVERED' THEN format(
      'Dear %s, your baggage (PIR %s) has been delivered. Thank you for your patience.',
      d.passenger_name, d.pir_number)
    ELSE NULL END;

  IF v_body IS NULL THEN RETURN; END IF;

  FOREACH ch IN ARRAY ARRAY['sms','whatsapp']::public.notification_channel[] LOOP
    INSERT INTO public.notification_events(delivery_id, case_id, trigger_status, channel,
      locale, recipient, subject, body)
    VALUES (p_delivery, d.case_id, p_trigger, ch, 'en', d.mobile, 'IAB Baggage Delivery', v_body);
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wf_queue_notification(uuid, public.workflow_status) FROM PUBLIC, anon, authenticated;

-- ---------- Internal: the single stage transition ----------
CREATE OR REPLACE FUNCTION public.wf_transition(
  p_delivery uuid,
  p_to public.delivery_stage,
  p_reason text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_expected_version integer DEFAULT NULL)
RETURNS public.deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deliveries%ROWTYPE; v_from public.delivery_stage; v_ws public.workflow_status;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = p_delivery FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found' USING ERRCODE = 'P0002'; END IF;

  IF p_expected_version IS NOT NULL AND d.version <> p_expected_version THEN
    RAISE EXCEPTION 'This record changed since you opened it. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;

  v_from := d.stage;
  IF v_from = p_to THEN RETURN d; END IF;
  IF NOT public.wf_stage_allowed(v_from, p_to) THEN
    RAISE EXCEPTION 'Cannot move a delivery from % to %', v_from, p_to USING ERRCODE = '23514';
  END IF;

  v_ws := public.wf_stage_workflow(p_to);

  UPDATE public.deliveries SET
    stage = p_to,
    workflow_status = v_ws,
    accepted_at  = CASE WHEN p_to = 'Driver Accepted'     THEN now() ELSE accepted_at END,
    collected_at = CASE WHEN p_to = 'Collected Bag'       THEN now() ELSE collected_at END,
    started_at   = CASE WHEN p_to = 'Out for Delivery'    THEN now() ELSE started_at END,
    delivered_at = CASE WHEN p_to = 'Delivered'           THEN now() ELSE delivered_at END,
    failed_at    = CASE WHEN p_to = 'Delivery Failed'     THEN now() ELSE failed_at END,
    returned_at  = CASE WHEN p_to = 'Returned to Airport' THEN now() ELSE returned_at END
  WHERE id = p_delivery
  RETURNING * INTO d;

  UPDATE public.baggage_cases SET
    lf_status = public.wf_stage_lf(p_to),
    workflow_status = v_ws,
    resolved_at = CASE WHEN p_to = 'Delivered' THEN coalesce(resolved_at, now()) ELSE resolved_at END
  WHERE id = d.case_id;

  PERFORM public.wf_journal(d.case_id, d.id, public.wf_stage_workflow(v_from), v_ws,
    v_from, p_to, 'delivery',
    format('Delivery %s → %s', d.delivery_no, p_to), coalesce(p_reason,''),
    'delivery.transition', p_reason, p_metadata);

  PERFORM public.wf_queue_notification(d.id, v_ws);
  PERFORM public.wf_refresh_passenger_view(d.id);
  RETURN d;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wf_transition(uuid, public.delivery_stage, text, jsonb, integer) FROM PUBLIC, anon, authenticated;

-- ---------- Internal: bootstrap a delivery from a case ----------
CREATE OR REPLACE FUNCTION public.wf_open_delivery(p_case uuid)
RETURNS public.deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.baggage_cases%ROWTYPE; d public.deliveries%ROWTYPE; v_attempt integer;
BEGIN
  SELECT * INTO c FROM public.baggage_cases WHERE id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO d FROM public.deliveries
  WHERE case_id = p_case AND stage NOT IN ('Delivered','Delivery Failed','Returned to Airport')
  LIMIT 1;
  IF FOUND THEN RETURN d; END IF;

  SELECT coalesce(max(attempt_no),0) + 1 INTO v_attempt FROM public.deliveries WHERE case_id = p_case;

  INSERT INTO public.deliveries(delivery_no, case_id, station_id, stage, workflow_status,
    priority, delivery_type, passenger_name, mobile, address, dest_lat, dest_lng,
    attempt_no, created_by)
  VALUES (public.next_delivery_no(), c.id, c.station_id, 'Ready for Delivery',
    'READY_FOR_COLLECTION', c.priority, c.delivery_method, c.passenger_name,
    c.contact_mobile, c.full_address, c.dest_lat, c.dest_lng, v_attempt,
    public.current_app_user_id())
  RETURNING * INTO d;

  PERFORM public.wf_journal(c.id, d.id, c.workflow_status, 'READY_FOR_COLLECTION',
    NULL, 'Ready for Delivery', 'delivery',
    format('Delivery %s opened for case %s', d.delivery_no, c.pir_number),
    'Ownership handed over from Lost & Found', 'delivery.open');

  PERFORM public.wf_refresh_passenger_view(d.id);
  RETURN d;
END; $$;
REVOKE EXECUTE ON FUNCTION public.wf_open_delivery(uuid) FROM PUBLIC, anon, authenticated;
