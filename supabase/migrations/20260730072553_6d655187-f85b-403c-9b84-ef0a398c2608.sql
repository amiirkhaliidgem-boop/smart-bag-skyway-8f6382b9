-- 1) Stage transition matrix: retire "Delivery Failed", allow return-to-airport
CREATE OR REPLACE FUNCTION public.wf_stage_allowed(p_from delivery_stage, p_to delivery_stage)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  SELECT CASE p_from
    WHEN 'Ready for Delivery'   THEN p_to IN ('Scheduled','Assigned')
    WHEN 'Scheduled'            THEN p_to IN ('Assigned','Ready for Delivery','Returned to Airport')
    WHEN 'Assigned'             THEN p_to IN ('Driver Accepted','Scheduled','Assigned','Returned to Airport')
    WHEN 'Driver Accepted'      THEN p_to IN ('Collected Bag','Returned to Airport')
    WHEN 'Collected Bag'        THEN p_to IN ('Out for Delivery','Returned to Airport')
    WHEN 'Out for Delivery'     THEN p_to IN ('Delivered','Returned to Airport')
    WHEN 'Delivery Failed'      THEN p_to IN ('Returned to Airport','Scheduled')
    WHEN 'Returned to Airport'  THEN p_to IN ('Ready for Delivery','Scheduled','Assigned')
    WHEN 'Delivered'            THEN false
    ELSE false
  END
$function$;

-- 2) Returned to Airport re-enters the Ready for Delivery workflow state
CREATE OR REPLACE FUNCTION public.wf_stage_workflow(p delivery_stage)
RETURNS workflow_status LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $function$
  SELECT CASE p
    WHEN 'Ready for Delivery' THEN 'READY_FOR_COLLECTION'
    WHEN 'Scheduled' THEN 'DELIVERY_APPROVED'
    WHEN 'Assigned' THEN 'DRIVER_ASSIGNED'
    WHEN 'Driver Accepted' THEN 'DRIVER_ASSIGNED'
    WHEN 'Collected Bag' THEN 'CLAIMED_ON_HAND'
    WHEN 'Out for Delivery' THEN 'OUT_FOR_DELIVERY'
    WHEN 'Delivered' THEN 'DELIVERED'
    WHEN 'Delivery Failed' THEN 'OUT_FOR_DELIVERY'
    WHEN 'Returned to Airport' THEN 'READY_FOR_COLLECTION'
  END::public.workflow_status
$function$;

-- 3) Real "Return to Airport" workflow action
DROP FUNCTION IF EXISTS public.dm_mark_returned(uuid, integer);

CREATE OR REPLACE FUNCTION public.dm_mark_returned(
  p_delivery uuid,
  p_reason_code text DEFAULT NULL,
  p_note text DEFAULT ''::text,
  p_expected_version integer DEFAULT NULL::integer
) RETURNS deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d public.deliveries%ROWTYPE; v_reason uuid; v_agent uuid;
BEGIN
  PERFORM public.wf_require(ARRAY['coordinator','driver']);
  PERFORM public.wf_assert_version(p_delivery, p_expected_version);

  IF p_reason_code IS NOT NULL AND p_reason_code <> '' THEN
    SELECT id INTO v_reason FROM public.failure_reasons WHERE code = p_reason_code AND active;
  END IF;

  SELECT assigned_agent_id INTO v_agent FROM public.deliveries WHERE id = p_delivery;

  UPDATE public.deliveries
     SET failure_reason_id = coalesce(v_reason, failure_reason_id),
         failure_note = coalesce(p_note, '')
   WHERE id = p_delivery;

  -- Step 1: operational return
  d := public.wf_transition(p_delivery, 'Returned to Airport',
        coalesce(p_note, 'Baggage returned to airport'),
        jsonb_build_object('reason', coalesce(p_reason_code, ''), 'previous_agent', v_agent), NULL);

  -- Step 2: clear the assignment and any live one-time code
  UPDATE public.otp_challenges SET state = 'Expired'
   WHERE delivery_id = p_delivery AND state IN ('Pending','Sent');

  UPDATE public.deliveries
     SET assigned_agent_id = NULL, assigned_at = NULL,
         accepted_at = NULL, collected_at = NULL, started_at = NULL
   WHERE id = p_delivery;

  -- Step 3: back to the Ready for Delivery queue across every module
  d := public.wf_transition(p_delivery, 'Ready for Delivery',
        'Returned to airport — re-queued for dispatch', '{}'::jsonb, NULL);

  -- Step 4: drop the stop from the agent's optimized route immediately
  IF v_agent IS NOT NULL THEN
    PERFORM public.wf_recompute_route(v_agent);
  END IF;

  RETURN d;
END; $function$;

-- 4) Retire dm_mark_failed: keep the entry point, route it to the return flow
CREATE OR REPLACE FUNCTION public.dm_mark_failed(
  p_delivery uuid,
  p_reason_code text,
  p_note text DEFAULT ''::text,
  p_expected_version integer DEFAULT NULL::integer
) RETURNS deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN public.dm_mark_returned(p_delivery, p_reason_code, p_note, p_expected_version);
END; $function$;

REVOKE ALL ON FUNCTION public.dm_mark_returned(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dm_mark_returned(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dm_mark_returned(uuid, text, text, integer) TO service_role;