-- 1. Allow the failed branch out of "Out for Delivery".
CREATE OR REPLACE FUNCTION public.wf_stage_allowed(p_from delivery_stage, p_to delivery_stage)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  SELECT CASE p_from
    WHEN 'Ready for Delivery'   THEN p_to IN ('Scheduled','Assigned')
    WHEN 'Scheduled'            THEN p_to IN ('Assigned','Ready for Delivery','Returned to Airport')
    WHEN 'Assigned'             THEN p_to IN ('Driver Accepted','Scheduled','Assigned','Returned to Airport')
    WHEN 'Driver Accepted'      THEN p_to IN ('Collected Bag','Returned to Airport')
    WHEN 'Collected Bag'        THEN p_to IN ('Out for Delivery','Returned to Airport')
    WHEN 'Out for Delivery'     THEN p_to IN ('Delivered','Delivery Failed','Returned to Airport')
    WHEN 'Delivery Failed'      THEN p_to IN ('Returned to Airport','Scheduled','Assigned')
    WHEN 'Returned to Airport'  THEN p_to IN ('Ready for Delivery','Scheduled','Assigned')
    WHEN 'Delivered'            THEN false
    ELSE false
  END
$function$;

-- 2. Real failed-attempt handling (no longer an alias of dm_mark_returned).
CREATE OR REPLACE FUNCTION public.dm_mark_failed(p_delivery uuid, p_reason_code text, p_note text DEFAULT ''::text, p_expected_version integer DEFAULT NULL::integer)
RETURNS deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d public.deliveries%ROWTYPE; v_reason uuid; v_label text; v_no text;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','driver']);
  PERFORM public.wf_assert_version(p_delivery, p_expected_version);

  IF p_reason_code IS NOT NULL AND p_reason_code <> '' THEN
    SELECT id, label_en INTO v_reason, v_label FROM public.failure_reasons WHERE code = p_reason_code AND active;
  END IF;

  SELECT delivery_no INTO v_no FROM public.deliveries WHERE id = p_delivery;

  UPDATE public.deliveries
     SET failure_reason_id = coalesce(v_reason, failure_reason_id),
         failure_note = coalesce(p_note, ''),
         attempt_no = attempt_no + 1
   WHERE id = p_delivery;

  d := public.wf_transition(p_delivery, 'Delivery Failed',
        coalesce(nullif(p_note, ''), 'Delivery attempt failed'),
        jsonb_build_object('reason', coalesce(p_reason_code, '')), NULL);

  UPDATE public.otp_challenges SET state = 'Expired'
   WHERE delivery_id = p_delivery AND state IN ('Pending','Sent');

  PERFORM public.qm_raise_incident('failed_delivery', 'Delivery Attempt Failed',
    format('Delivery %s failed. Reason: %s. %s',
           v_no, coalesce(nullif(v_label,''), nullif(p_reason_code,''), 'Not specified'), coalesce(p_note,'')),
    d.case_id, p_delivery,
    format('failed:%s:%s', p_delivery, d.attempt_no), NULL, 'Workflow Engine');

  PERFORM public.wf_queue_notification_key(p_delivery, 'STAGE_DELIVERY_FAILED');

  RETURN d;
END; $function$;