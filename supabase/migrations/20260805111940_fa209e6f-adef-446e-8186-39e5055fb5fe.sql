DO $$
DECLARE qa_cases uuid[]; qa_dels uuid[];
BEGIN
  SELECT array_agg(id) INTO qa_cases FROM public.baggage_cases
   WHERE passenger_name LIKE 'Stress %' OR passenger_name LIKE 'QA %' OR pir_number LIKE 'QA%';
  IF qa_cases IS NULL THEN RETURN; END IF;
  SELECT coalesce(array_agg(id), '{}') INTO qa_dels FROM public.deliveries WHERE case_id = ANY(qa_cases);

  ALTER TABLE public.timeline_events DISABLE TRIGGER USER;
  ALTER TABLE public.workflow_events DISABLE TRIGGER USER;
  ALTER TABLE public.audit_events DISABLE TRIGGER USER;
  ALTER TABLE public.notification_events DISABLE TRIGGER USER;
  ALTER TABLE public.notification_attempts DISABLE TRIGGER USER;
  ALTER TABLE public.passenger_feedback DISABLE TRIGGER USER;
  ALTER TABLE public.passenger_links DISABLE TRIGGER USER;
  ALTER TABLE public.passenger_view DISABLE TRIGGER USER;
  ALTER TABLE public.otp_challenges DISABLE TRIGGER USER;
  ALTER TABLE public.delivery_notes DISABLE TRIGGER USER;
  ALTER TABLE public.quality_incidents DISABLE TRIGGER USER;
  ALTER TABLE public.case_bags DISABLE TRIGGER USER;
  ALTER TABLE public.deliveries DISABLE TRIGGER USER;
  ALTER TABLE public.baggage_cases DISABLE TRIGGER USER;
  ALTER TABLE public.agent_route_stops DISABLE TRIGGER USER;

  DELETE FROM public.notification_attempts WHERE notification_id IN
    (SELECT id FROM public.notification_events WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels));
  DELETE FROM public.notification_events WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.passenger_feedback WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.passenger_view WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.passenger_links WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.otp_challenges WHERE delivery_id = ANY(qa_dels);
  DELETE FROM public.delivery_notes WHERE delivery_id = ANY(qa_dels);
  DELETE FROM public.agent_route_stops WHERE delivery_id = ANY(qa_dels);
  DELETE FROM public.quality_incidents WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.timeline_events WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.workflow_events WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.audit_events WHERE case_id = ANY(qa_cases) OR delivery_id = ANY(qa_dels);
  DELETE FROM public.case_bags WHERE case_id = ANY(qa_cases);
  DELETE FROM public.deliveries WHERE id = ANY(qa_dels);
  DELETE FROM public.baggage_cases WHERE id = ANY(qa_cases);

  ALTER TABLE public.timeline_events ENABLE TRIGGER USER;
  ALTER TABLE public.workflow_events ENABLE TRIGGER USER;
  ALTER TABLE public.audit_events ENABLE TRIGGER USER;
  ALTER TABLE public.notification_events ENABLE TRIGGER USER;
  ALTER TABLE public.notification_attempts ENABLE TRIGGER USER;
  ALTER TABLE public.passenger_feedback ENABLE TRIGGER USER;
  ALTER TABLE public.passenger_links ENABLE TRIGGER USER;
  ALTER TABLE public.passenger_view ENABLE TRIGGER USER;
  ALTER TABLE public.otp_challenges ENABLE TRIGGER USER;
  ALTER TABLE public.delivery_notes ENABLE TRIGGER USER;
  ALTER TABLE public.quality_incidents ENABLE TRIGGER USER;
  ALTER TABLE public.case_bags ENABLE TRIGGER USER;
  ALTER TABLE public.deliveries ENABLE TRIGGER USER;
  ALTER TABLE public.baggage_cases ENABLE TRIGGER USER;
  ALTER TABLE public.agent_route_stops ENABLE TRIGGER USER;
END $$;