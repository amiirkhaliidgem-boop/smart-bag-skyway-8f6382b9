DO $$
DECLARE v_case uuid; v_del uuid;
BEGIN
  SELECT id INTO v_case FROM public.baggage_cases WHERE pir_number='WFTEST-E2E';
  IF v_case IS NULL THEN RETURN; END IF;
  SELECT id INTO v_del FROM public.deliveries WHERE case_id = v_case;

  ALTER TABLE public.passenger_feedback DISABLE TRIGGER USER;
  ALTER TABLE public.notification_attempts DISABLE TRIGGER USER;
  ALTER TABLE public.notification_events DISABLE TRIGGER USER;
  ALTER TABLE public.otp_challenges DISABLE TRIGGER USER;
  ALTER TABLE public.passenger_view DISABLE TRIGGER USER;
  ALTER TABLE public.passenger_links DISABLE TRIGGER USER;
  ALTER TABLE public.timeline_events DISABLE TRIGGER USER;
  ALTER TABLE public.workflow_events DISABLE TRIGGER USER;
  ALTER TABLE public.audit_events DISABLE TRIGGER USER;
  ALTER TABLE public.deliveries DISABLE TRIGGER USER;
  ALTER TABLE public.case_bags DISABLE TRIGGER USER;
  ALTER TABLE public.baggage_cases DISABLE TRIGGER USER;

  DELETE FROM public.passenger_feedback WHERE case_id = v_case;
  DELETE FROM public.notification_attempts WHERE notification_id IN
    (SELECT id FROM public.notification_events WHERE case_id = v_case);
  DELETE FROM public.notification_events WHERE case_id = v_case;
  DELETE FROM public.otp_challenges WHERE delivery_id = v_del;
  DELETE FROM public.passenger_view WHERE case_id = v_case;
  DELETE FROM public.passenger_links WHERE case_id = v_case;
  DELETE FROM public.agent_route_stops WHERE delivery_id = v_del;
  DELETE FROM public.timeline_events WHERE case_id = v_case;
  DELETE FROM public.workflow_events WHERE case_id = v_case;
  DELETE FROM public.audit_events WHERE case_id = v_case;
  DELETE FROM public.deliveries WHERE id = v_del;
  DELETE FROM public.case_bags WHERE case_id = v_case;
  DELETE FROM public.baggage_cases WHERE id = v_case;

  ALTER TABLE public.passenger_feedback ENABLE TRIGGER USER;
  ALTER TABLE public.notification_attempts ENABLE TRIGGER USER;
  ALTER TABLE public.notification_events ENABLE TRIGGER USER;
  ALTER TABLE public.otp_challenges ENABLE TRIGGER USER;
  ALTER TABLE public.passenger_view ENABLE TRIGGER USER;
  ALTER TABLE public.passenger_links ENABLE TRIGGER USER;
  ALTER TABLE public.timeline_events ENABLE TRIGGER USER;
  ALTER TABLE public.workflow_events ENABLE TRIGGER USER;
  ALTER TABLE public.audit_events ENABLE TRIGGER USER;
  ALTER TABLE public.deliveries ENABLE TRIGGER USER;
  ALTER TABLE public.case_bags ENABLE TRIGGER USER;
  ALTER TABLE public.baggage_cases ENABLE TRIGGER USER;
END $$;