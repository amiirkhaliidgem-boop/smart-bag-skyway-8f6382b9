-- 1. Anonymous-safe journaling helper (staff guard preserved in wf_journal_event)
CREATE OR REPLACE FUNCTION public.wf_journal_public(
  p_module public.timeline_module,
  p_title text,
  p_detail text DEFAULT '',
  p_case uuid DEFAULT NULL,
  p_delivery uuid DEFAULT NULL,
  p_action text DEFAULT 'event',
  p_actor text DEFAULT 'Passenger Portal',
  p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_ref text;
BEGIN
  SELECT coalesce(d.delivery_no, nullif(c.pir_number,''), c.case_no, '')
    INTO v_ref
  FROM (SELECT 1) x
  LEFT JOIN public.baggage_cases c ON c.id = p_case
  LEFT JOIN public.deliveries d ON d.id = p_delivery;

  INSERT INTO public.timeline_events(module, case_id, delivery_id, reference, title,
    detail, status, actor_user_id, actor_name, metadata)
  VALUES (p_module, p_case, p_delivery, coalesce(v_ref,''), p_title, coalesce(p_detail,''),
    '', NULL, coalesce(nullif(p_actor,''),'Passenger Portal'), coalesce(p_metadata,'{}'::jsonb));

  INSERT INTO public.audit_events(actor_user_id, actor_name, actor_role, action,
    entity_type, entity_id, case_id, delivery_id, note, metadata)
  VALUES (NULL, coalesce(nullif(p_actor,''),'Passenger Portal'), NULL, p_action,
    CASE WHEN p_delivery IS NOT NULL THEN 'delivery' ELSE 'case' END,
    coalesce(v_ref,''), p_case, p_delivery, coalesce(p_detail,''), coalesce(p_metadata,'{}'::jsonb));
END; $$;

REVOKE ALL ON FUNCTION public.wf_journal_public(public.timeline_module, text, text, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- 2. Feedback submission: anonymous-safe, idempotent, workflow-advancing
CREATE OR REPLACE FUNCTION public.passenger_submit_feedback(
  p_token text, p_rating integer, p_resolved boolean, p_comments text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE l public.passenger_links%ROWTYPE; v_id uuid; v_prev public.workflow_status;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN false; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL OR l.delivery_id IS NULL THEN RETURN false; END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN RETURN false; END IF;

  INSERT INTO public.passenger_feedback(delivery_id, case_id, link_id, rating, resolved, comments)
  VALUES (l.delivery_id, l.case_id, l.id, p_rating, coalesce(p_resolved, true), coalesce(p_comments, ''))
  ON CONFLICT (delivery_id) DO NOTHING
  RETURNING id INTO v_id;

  -- Already submitted: idempotent success, no duplicate journal/workflow rows.
  IF v_id IS NULL THEN RETURN true; END IF;

  SELECT workflow_status INTO v_prev FROM public.deliveries WHERE id = l.delivery_id;

  UPDATE public.deliveries
     SET workflow_status = 'FEEDBACK_SUBMITTED', updated_at = now()
   WHERE id = l.delivery_id
     AND workflow_status IN ('DELIVERED','OTP_VERIFIED');

  UPDATE public.baggage_cases
     SET workflow_status = 'FEEDBACK_SUBMITTED', updated_at = now()
   WHERE id = l.case_id
     AND workflow_status IN ('DELIVERED','OTP_VERIFIED');

  IF v_prev IN ('DELIVERED','OTP_VERIFIED') THEN
    INSERT INTO public.workflow_events(case_id, delivery_id, from_status, to_status,
      actor_user_id, actor_name, actor_role, reason, metadata)
    VALUES (l.case_id, l.delivery_id, v_prev, 'FEEDBACK_SUBMITTED', NULL,
      'Passenger Portal', NULL, 'Passenger feedback submitted',
      jsonb_build_object('rating', p_rating, 'resolved', coalesce(p_resolved, true)));
  END IF;

  PERFORM public.wf_journal_public('feedback', 'Passenger feedback submitted',
    format('Rating %s / 5', p_rating), l.case_id, l.delivery_id, 'feedback.submit',
    'Passenger Portal',
    jsonb_build_object('rating', p_rating, 'resolved', coalesce(p_resolved, true)));

  PERFORM public.wf_refresh_passenger_view(l.delivery_id);
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.passenger_submit_feedback(text, integer, boolean, text) TO anon, authenticated;