CREATE OR REPLACE FUNCTION public.dashboard_executive(
  p_from timestamptz,
  p_to timestamptz,
  p_grain text DEFAULT 'day'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  g text := CASE lower(coalesce(p_grain,'day')) WHEN 'week' THEN 'week' WHEN 'month' THEN 'month' ELSE 'day' END;
  span interval := (p_to - p_from);
  prev_from timestamptz := p_from - (p_to - p_from);
  prev_to timestamptz := p_from;

  -- current-state KPIs
  k_total int; k_open int; k_located int; k_ready int; k_delivered int;
  k_open_inc int; k_avg_hours numeric; k_csat numeric; k_success numeric;

  -- window / previous-window activity used for the delta badges
  c_cases int; p_cases int;
  c_delivered int; p_delivered int;
  c_deliveries int; p_deliveries int;
  c_located int; p_located int;
  c_ready int; p_ready int;
  c_inc int; p_inc int;
  c_csat numeric; p_csat numeric;
  c_hours numeric; p_hours numeric;
  c_success numeric; p_success numeric;

  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------- state
  SELECT count(*) INTO k_total FROM public.baggage_cases;

  SELECT count(*) INTO k_open FROM public.baggage_cases c
   WHERE c.lf_status::text NOT IN ('Delivered','Closed');

  SELECT count(*) INTO k_located FROM public.baggage_cases c
   WHERE c.lf_status::text IN ('Located','Arrived at Airport','Waiting Customs Clearance',
                               'Ready for Delivery','Assigned Driver','Out for Delivery',
                               'Delivered','Closed');

  SELECT count(*) INTO k_ready FROM public.baggage_cases c
   WHERE c.lf_status::text = 'Ready for Delivery';

  SELECT count(*) INTO k_delivered FROM public.baggage_cases c
   WHERE c.lf_status::text IN ('Delivered','Closed');

  SELECT count(*) INTO k_open_inc FROM public.quality_incidents i
   WHERE i.state::text <> 'Resolved';

  SELECT round(avg(extract(epoch FROM (c.resolved_at - c.created_at))/3600)::numeric, 1)
    INTO k_avg_hours FROM public.baggage_cases c WHERE c.resolved_at IS NOT NULL;

  SELECT round(avg(f.rating)::numeric, 2) INTO k_csat FROM public.passenger_feedback f;

  SELECT CASE WHEN count(*) = 0 THEN 0
              ELSE round(100.0 * count(*) FILTER (WHERE d.delivered_at IS NOT NULL) / count(*), 1)
         END INTO k_success FROM public.deliveries d;

  -- --------------------------------------------------------------- deltas
  SELECT count(*) INTO c_cases FROM public.baggage_cases c
   WHERE c.created_at >= p_from AND c.created_at < p_to;
  SELECT count(*) INTO p_cases FROM public.baggage_cases c
   WHERE c.created_at >= prev_from AND c.created_at < prev_to;

  SELECT count(*) INTO c_delivered FROM public.deliveries d
   WHERE d.delivered_at >= p_from AND d.delivered_at < p_to;
  SELECT count(*) INTO p_delivered FROM public.deliveries d
   WHERE d.delivered_at >= prev_from AND d.delivered_at < prev_to;

  SELECT count(*) INTO c_deliveries FROM public.deliveries d
   WHERE d.created_at >= p_from AND d.created_at < p_to;
  SELECT count(*) INTO p_deliveries FROM public.deliveries d
   WHERE d.created_at >= prev_from AND d.created_at < prev_to;

  SELECT count(DISTINCT w.case_id) INTO c_located FROM public.workflow_events w
   WHERE w.to_status::text IN ('HOME_DELIVERY_REQUESTED','DELIVERY_APPROVED')
     AND w.occurred_at >= p_from AND w.occurred_at < p_to;
  SELECT count(DISTINCT w.case_id) INTO p_located FROM public.workflow_events w
   WHERE w.to_status::text IN ('HOME_DELIVERY_REQUESTED','DELIVERY_APPROVED')
     AND w.occurred_at >= prev_from AND w.occurred_at < prev_to;

  SELECT count(DISTINCT w.case_id) INTO c_ready FROM public.workflow_events w
   WHERE w.to_status::text = 'READY_FOR_COLLECTION'
     AND w.occurred_at >= p_from AND w.occurred_at < p_to;
  SELECT count(DISTINCT w.case_id) INTO p_ready FROM public.workflow_events w
   WHERE w.to_status::text = 'READY_FOR_COLLECTION'
     AND w.occurred_at >= prev_from AND w.occurred_at < prev_to;

  SELECT count(*) INTO c_inc FROM public.quality_incidents i
   WHERE i.created_at >= p_from AND i.created_at < p_to;
  SELECT count(*) INTO p_inc FROM public.quality_incidents i
   WHERE i.created_at >= prev_from AND i.created_at < prev_to;

  SELECT round(avg(f.rating)::numeric, 2) INTO c_csat FROM public.passenger_feedback f
   WHERE f.submitted_at >= p_from AND f.submitted_at < p_to;
  SELECT round(avg(f.rating)::numeric, 2) INTO p_csat FROM public.passenger_feedback f
   WHERE f.submitted_at >= prev_from AND f.submitted_at < prev_to;

  SELECT round(avg(extract(epoch FROM (c.resolved_at - c.created_at))/3600)::numeric, 1)
    INTO c_hours FROM public.baggage_cases c
   WHERE c.resolved_at >= p_from AND c.resolved_at < p_to;
  SELECT round(avg(extract(epoch FROM (c.resolved_at - c.created_at))/3600)::numeric, 1)
    INTO p_hours FROM public.baggage_cases c
   WHERE c.resolved_at >= prev_from AND c.resolved_at < prev_to;

  c_success := CASE WHEN c_deliveries = 0 THEN NULL
                    ELSE round(100.0 * c_delivered / c_deliveries, 1) END;
  p_success := CASE WHEN p_deliveries = 0 THEN NULL
                    ELSE round(100.0 * p_delivered / p_deliveries, 1) END;

  -- --------------------------------------------------------------- payload
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'grain', g, 'span_days',
                                round(extract(epoch FROM span)/86400)),
    'kpis', jsonb_build_object(
      'totalCases',      jsonb_build_object('value', k_total,      'delta', public.dash_delta(c_cases, p_cases)),
      'openCases',       jsonb_build_object('value', k_open,       'delta', NULL),
      'locatedBags',     jsonb_build_object('value', k_located,    'delta', public.dash_delta(c_located, p_located)),
      'readyForDelivery',jsonb_build_object('value', k_ready,      'delta', public.dash_delta(c_ready, p_ready)),
      'deliveredBags',   jsonb_build_object('value', k_delivered,  'delta', public.dash_delta(c_delivered, p_delivered)),
      'avgResolution',   jsonb_build_object('value', coalesce(k_avg_hours,0), 'delta', public.dash_delta_num(c_hours, p_hours)),
      'csat',            jsonb_build_object('value', coalesce(k_csat,0),      'delta', public.dash_delta_num(c_csat, p_csat)),
      'deliverySuccess', jsonb_build_object('value', coalesce(k_success,0),   'delta', public.dash_delta_num(c_success, p_success)),
      'openIncidents',   jsonb_build_object('value', k_open_inc,   'delta', public.dash_delta(c_inc, p_inc))
    ),
    'byStatus', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', s.status, 'count', s.n) ORDER BY s.n DESC)
      FROM (SELECT c.lf_status::text AS status, count(*) AS n
              FROM public.baggage_cases c GROUP BY 1) s), '[]'::jsonb),
    'byCarrier', coalesce((
      SELECT jsonb_agg(jsonb_build_object('airline', a.airline, 'count', a.n) ORDER BY a.n DESC, a.airline)
      FROM (SELECT coalesce(nullif(btrim(c.airline),''),'Unknown') AS airline, count(*) AS n
              FROM public.baggage_cases c GROUP BY 1 ORDER BY 2 DESC LIMIT 12) a), '[]'::jsonb),
    'funnel', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', f.status, 'count', f.n))
      FROM (SELECT s.status,
                   (SELECT count(*) FROM public.baggage_cases c WHERE c.workflow_status::text = s.status) AS n,
                   s.ord
            FROM (SELECT unnest(enum_range(NULL::public.workflow_status))::text AS status,
                         generate_series(1, array_length(enum_range(NULL::public.workflow_status),1)) AS ord) s
            ORDER BY s.ord) f), '[]'::jsonb),
    'trends', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'bucket', to_char(b.bucket, 'YYYY-MM-DD'),
               'opened', b.opened, 'resolved', b.resolved, 'delivered', b.delivered,
               'incidents', b.incidents, 'csat', b.csat, 'successPct', b.success_pct) ORDER BY b.bucket)
      FROM (
        SELECT d.bucket,
          (SELECT count(*) FROM public.baggage_cases c
            WHERE date_trunc(g, c.created_at) = d.bucket) AS opened,
          (SELECT count(*) FROM public.baggage_cases c
            WHERE c.resolved_at IS NOT NULL AND date_trunc(g, c.resolved_at) = d.bucket) AS resolved,
          (SELECT count(*) FROM public.deliveries dl
            WHERE dl.delivered_at IS NOT NULL AND date_trunc(g, dl.delivered_at) = d.bucket) AS delivered,
          (SELECT count(*) FROM public.quality_incidents i
            WHERE date_trunc(g, i.created_at) = d.bucket) AS incidents,
          coalesce((SELECT round(avg(f.rating)::numeric,2) FROM public.passenger_feedback f
            WHERE date_trunc(g, f.submitted_at) = d.bucket), 0) AS csat,
          coalesce((SELECT CASE WHEN count(*) = 0 THEN 0
                                ELSE round(100.0 * count(*) FILTER (WHERE dl.delivered_at IS NOT NULL) / count(*), 1) END
                      FROM public.deliveries dl
                     WHERE date_trunc(g, dl.created_at) = d.bucket), 0) AS success_pct
        FROM (SELECT generate_series(date_trunc(g, p_from), date_trunc(g, p_to - interval '1 microsecond'),
                                     ('1 ' || g)::interval) AS bucket) d
      ) b), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.dash_delta(cur int, prev int)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN prev IS NULL OR prev = 0 THEN NULL
              ELSE round(100.0 * (cur - prev) / prev, 1) END
$$;

CREATE OR REPLACE FUNCTION public.dash_delta_num(cur numeric, prev numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN prev IS NULL OR prev = 0 OR cur IS NULL THEN NULL
              ELSE round(100.0 * (cur - prev) / prev, 1) END
$$;

REVOKE EXECUTE ON FUNCTION public.dashboard_executive(timestamptz,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_executive(timestamptz,timestamptz,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dash_delta(int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dash_delta(int,int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dash_delta_num(numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dash_delta_num(numeric,numeric) TO authenticated;