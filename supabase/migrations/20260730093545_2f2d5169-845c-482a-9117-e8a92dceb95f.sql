REVOKE EXECUTE ON FUNCTION public.qm_create_incident(text,text,uuid,uuid,public.incident_severity) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.qm_assign_incident(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.qm_set_state(uuid,public.incident_state,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.qm_resolve_incident(uuid,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.qm_sweep_sla() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_incident_no() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qm_default_severity(text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.report_operational(
  p_from timestamptz,
  p_to timestamptz,
  p_grain text DEFAULT 'day'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  g text := CASE lower(coalesce(p_grain,'day')) WHEN 'week' THEN 'week' WHEN 'month' THEN 'month' ELSE 'day' END;
  v_cases int; v_delivered int; v_deliveries int; v_returns int;
  v_breached int; v_csat numeric; v_open_inc int;
  v_avg_hours numeric; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_cases FROM public.baggage_cases c
   WHERE c.created_at >= p_from AND c.created_at < p_to;

  SELECT count(*) INTO v_deliveries FROM public.deliveries d
   WHERE d.created_at >= p_from AND d.created_at < p_to;

  SELECT count(*), avg(extract(epoch FROM (d.delivered_at - d.created_at))/3600)
    INTO v_delivered, v_avg_hours
  FROM public.deliveries d
   WHERE d.delivered_at >= p_from AND d.delivered_at < p_to;

  SELECT count(*) INTO v_returns FROM public.deliveries d
   WHERE d.returned_at >= p_from AND d.returned_at < p_to;

  SELECT count(DISTINCT i.delivery_id) INTO v_breached
    FROM public.quality_incidents i
   WHERE i.source = 'sla' AND i.created_at >= p_from AND i.created_at < p_to;

  SELECT round(avg(f.rating)::numeric, 2) INTO v_csat
    FROM public.passenger_feedback f
   WHERE f.submitted_at >= p_from AND f.submitted_at < p_to;

  SELECT count(*) INTO v_open_inc FROM public.quality_incidents i
   WHERE i.state::text <> 'Resolved';

  v_result := jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'grain', g),

    'executive', jsonb_build_object(
      'cases', v_cases,
      'deliveries', v_deliveries,
      'delivered', v_delivered,
      'returns', v_returns,
      'deliverySuccessPct', CASE WHEN v_delivered + v_returns > 0
        THEN round(100.0 * v_delivered / (v_delivered + v_returns)) ELSE 0 END,
      'slaCompliancePct', CASE WHEN v_deliveries > 0
        THEN greatest(0, round(100.0 * (v_deliveries - v_breached) / v_deliveries)) ELSE 100 END,
      'csat', coalesce(v_csat, 0),
      'openIncidents', v_open_inc,
      'avgHoursToDeliver', round(coalesce(v_avg_hours, 0)::numeric, 1)),

    'delivery', jsonb_build_object(
      'byStage', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT d.stage::text AS stage, count(*)::int AS count
          FROM public.deliveries d GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'firstAttemptPct', coalesce((
          SELECT round(100.0 * count(*) FILTER (WHERE d.attempt_no = 1) / nullif(count(*),0))
          FROM public.deliveries d WHERE d.delivered_at >= p_from AND d.delivered_at < p_to), 0),
      'returnReasons', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT coalesce(fr.label_en, 'Not specified') AS reason, count(*)::int AS count
          FROM public.deliveries d
          LEFT JOIN public.failure_reasons fr ON fr.id = d.failure_reason_id
          WHERE d.returned_at >= p_from AND d.returned_at < p_to
          GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'avgStageMinutes', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT s.from_stage::text AS stage,
                 round(avg(extract(epoch FROM (s.occurred_at - s.prev_at))/60)::numeric, 1) AS minutes
          FROM (
            SELECT w.from_stage, w.occurred_at,
                   lag(w.occurred_at) OVER (PARTITION BY w.delivery_id ORDER BY w.occurred_at) AS prev_at
            FROM public.workflow_events w
            WHERE w.delivery_id IS NOT NULL AND w.occurred_at >= p_from AND w.occurred_at < p_to
          ) s
          WHERE s.prev_at IS NOT NULL AND s.from_stage IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'onTime', greatest(0, v_deliveries - v_breached),
      'breached', v_breached),

    'lostFound', jsonb_build_object(
      'intake', v_cases,
      'byStatus', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT c.lf_status::text AS status, count(*)::int AS count
          FROM public.baggage_cases c GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'incompletePct', coalesce((
          SELECT round(100.0 * count(*) FILTER (WHERE c.incomplete) / nullif(count(*),0))
          FROM public.baggage_cases c WHERE c.created_at >= p_from AND c.created_at < p_to), 0),
      'vipPct', coalesce((
          SELECT round(100.0 * count(*) FILTER (WHERE c.priority = 'VIP') / nullif(count(*),0))
          FROM public.baggage_cases c WHERE c.created_at >= p_from AND c.created_at < p_to), 0),
      'avgHoursToReady', coalesce((
          SELECT round(avg(extract(epoch FROM (d.created_at - c.created_at))/3600)::numeric, 1)
          FROM public.deliveries d JOIN public.baggage_cases c ON c.id = d.case_id
          WHERE d.created_at >= p_from AND d.created_at < p_to AND d.attempt_no = 1), 0)),

    'experience', jsonb_build_object(
      'csat', coalesce(v_csat, 0),
      'responses', coalesce((SELECT count(*)::int FROM public.passenger_feedback f
          WHERE f.submitted_at >= p_from AND f.submitted_at < p_to), 0),
      'responseRatePct', CASE WHEN v_delivered > 0 THEN round(100.0 * (
          SELECT count(*) FROM public.passenger_feedback f
           WHERE f.submitted_at >= p_from AND f.submitted_at < p_to) / v_delivered) ELSE 0 END,
      'resolvedPct', coalesce((
          SELECT round(100.0 * count(*) FILTER (WHERE f.resolved) / nullif(count(*),0))
          FROM public.passenger_feedback f
          WHERE f.submitted_at >= p_from AND f.submitted_at < p_to), 0),
      'ratings', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT r AS rating, coalesce((SELECT count(*)::int FROM public.passenger_feedback f
              WHERE f.rating = r AND f.submitted_at >= p_from AND f.submitted_at < p_to), 0) AS count
          FROM generate_series(1,5) r ORDER BY r) x), '[]'::jsonb),
      'linkViewRatePct', coalesce((
          SELECT round(100.0 * count(*) FILTER (WHERE l.view_count > 0) / nullif(count(*),0))
          FROM public.passenger_links l
          WHERE l.issued_at >= p_from AND l.issued_at < p_to), 0),
      'notifications', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT n.channel::text AS channel,
                 count(*) FILTER (WHERE n.state = 'sent')::int AS sent,
                 count(*) FILTER (WHERE n.state = 'failed')::int AS failed,
                 count(*) FILTER (WHERE n.state IN ('queued','sending'))::int AS pending
          FROM public.notification_events n
          WHERE n.created_at >= p_from AND n.created_at < p_to
          GROUP BY 1 ORDER BY 1) x), '[]'::jsonb)),

    'quality', jsonb_build_object(
      'raised', coalesce((SELECT count(*)::int FROM public.quality_incidents i
          WHERE i.created_at >= p_from AND i.created_at < p_to), 0),
      'open', v_open_inc,
      'resolved', coalesce((SELECT count(*)::int FROM public.quality_incidents i
          WHERE i.resolved_at >= p_from AND i.resolved_at < p_to), 0),
      'avgResolveHours', coalesce((
          SELECT round(avg(extract(epoch FROM (i.resolved_at - i.created_at))/3600)::numeric, 1)
          FROM public.quality_incidents i
          WHERE i.resolved_at >= p_from AND i.resolved_at < p_to), 0),
      'byCategory', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT i.category AS label, count(*)::int AS count FROM public.quality_incidents i
          WHERE i.created_at >= p_from AND i.created_at < p_to GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'bySeverity', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT i.severity::text AS label, count(*)::int AS count FROM public.quality_incidents i
          WHERE i.created_at >= p_from AND i.created_at < p_to GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'bySource', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT i.source AS label, count(*)::int AS count FROM public.quality_incidents i
          WHERE i.created_at >= p_from AND i.created_at < p_to GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'byState', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT i.state::text AS label, count(*)::int AS count FROM public.quality_incidents i
          GROUP BY 1 ORDER BY 2 DESC) x), '[]'::jsonb),
      'incidents', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT i.id, i.incident_no, i.category, i.severity::text AS severity,
                 i.state::text AS state, i.source, i.description, i.created_at,
                 i.resolved_at, i.due_at, i.airline,
                 coalesce(nullif(c.pir_number,''), c.case_no, '') AS reference,
                 coalesce(d.delivery_no, '') AS delivery_no,
                 coalesce(ag.full_name, '') AS agent,
                 coalesce(au.full_name, '') AS assignee
          FROM public.quality_incidents i
          LEFT JOIN public.baggage_cases c ON c.id = i.case_id
          LEFT JOIN public.deliveries d ON d.id = i.delivery_id
          LEFT JOIN public.app_users ag ON ag.id = i.agent_id
          LEFT JOIN public.app_users au ON au.id = i.assigned_to
          ORDER BY i.created_at DESC LIMIT 200) x), '[]'::jsonb)),

    'performance', jsonb_build_object(
      'agents', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT u.full_name AS name,
                 count(*) FILTER (WHERE d.delivered_at >= p_from AND d.delivered_at < p_to)::int AS delivered,
                 count(*) FILTER (WHERE d.returned_at >= p_from AND d.returned_at < p_to)::int AS returned,
                 coalesce(round(avg(f.rating)::numeric, 2), 0) AS csat,
                 coalesce((SELECT count(*)::int FROM public.quality_incidents i
                    WHERE i.agent_id = u.id AND i.created_at >= p_from AND i.created_at < p_to), 0) AS incidents
          FROM public.app_users u
          JOIN public.deliveries d ON d.assigned_agent_id = u.id
          LEFT JOIN public.passenger_feedback f ON f.delivery_id = d.id
          GROUP BY u.id, u.full_name
          ORDER BY 2 DESC) x), '[]'::jsonb),
      'officers', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT u.full_name AS name, count(*)::int AS cases,
                 count(*) FILTER (WHERE c.lf_status::text <> 'Open')::int AS progressed,
                 coalesce(round(avg(extract(epoch FROM (c.updated_at - c.created_at))/3600)::numeric, 1), 0) AS avg_hours
          FROM public.baggage_cases c
          JOIN public.app_users u ON u.id = c.assigned_officer_id
          WHERE c.created_at >= p_from AND c.created_at < p_to
          GROUP BY u.id, u.full_name ORDER BY 2 DESC) x), '[]'::jsonb),
      'airlines', coalesce((SELECT jsonb_agg(x) FROM (
          SELECT coalesce(nullif(c.airline,''), 'Unknown') AS name,
                 count(DISTINCT c.id)::int AS cases,
                 count(DISTINCT d.id) FILTER (WHERE d.delivered_at IS NOT NULL)::int AS delivered,
                 coalesce(round(avg(f.rating)::numeric, 2), 0) AS csat,
                 coalesce((SELECT count(*)::int FROM public.quality_incidents i
                    WHERE i.airline = c.airline AND i.created_at >= p_from AND i.created_at < p_to), 0) AS incidents
          FROM public.baggage_cases c
          LEFT JOIN public.deliveries d ON d.case_id = c.id
          LEFT JOIN public.passenger_feedback f ON f.case_id = c.id
          WHERE c.created_at >= p_from AND c.created_at < p_to
          GROUP BY c.airline ORDER BY 2 DESC) x), '[]'::jsonb)),

    'trends', coalesce((SELECT jsonb_agg(x ORDER BY x.bucket) FROM (
        SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket,
          (SELECT count(*)::int FROM public.baggage_cases c
            WHERE date_trunc(g, c.created_at) = b.bucket) AS cases,
          (SELECT count(*)::int FROM public.deliveries d
            WHERE date_trunc(g, d.delivered_at) = b.bucket) AS delivered,
          (SELECT count(*)::int FROM public.deliveries d
            WHERE date_trunc(g, d.returned_at) = b.bucket) AS returned,
          (SELECT count(*)::int FROM public.quality_incidents i
            WHERE date_trunc(g, i.created_at) = b.bucket) AS incidents,
          coalesce((SELECT round(avg(f.rating)::numeric, 2) FROM public.passenger_feedback f
            WHERE date_trunc(g, f.submitted_at) = b.bucket), 0) AS csat
        FROM (SELECT generate_series(date_trunc(g, p_from), date_trunc(g, p_to), ('1 ' || g)::interval) AS bucket) b
      ) x), '[]'::jsonb)
  );

  RETURN v_result;
END; $$;

REVOKE EXECUTE ON FUNCTION public.report_operational(timestamptz,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_operational(timestamptz,timestamptz,text) TO authenticated;