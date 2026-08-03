CREATE OR REPLACE FUNCTION public.wf_case_status()
RETURNS TABLE(case_id uuid, status text, journey text, created_at timestamptz, completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id,
         CASE
           WHEN d.stage::text = 'Returned to Airport' THEN 'Returned to Airport'
           WHEN c.lf_status::text = 'Assigned Driver' THEN 'Out for Delivery'
           WHEN c.lf_status::text = 'Closed' THEN 'Delivered'
           ELSE c.lf_status::text
         END AS status,
         c.delivery_method::text AS journey,
         c.created_at,
         coalesce(d.delivered_at, c.resolved_at) AS completed_at
    FROM public.baggage_cases c
    LEFT JOIN LATERAL (
      SELECT dd.stage, dd.delivered_at
        FROM public.deliveries dd
       WHERE dd.case_id = c.id
       ORDER BY dd.created_at DESC
       LIMIT 1
    ) d ON true
$$;

REVOKE EXECUTE ON FUNCTION public.wf_case_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wf_case_status() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_executive(
  p_from timestamptz, p_to timestamptz, p_grain text DEFAULT 'day')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  g text := CASE lower(coalesce(p_grain,'day')) WHEN 'week' THEN 'week' WHEN 'month' THEN 'month' ELSE 'day' END;
  span interval := (p_to - p_from);
  prev_from timestamptz := p_from - (p_to - p_from);
  prev_to timestamptz := p_from;

  k_total int; k_open int; k_located int; k_arrived int; k_customs int;
  k_ready int; k_out int; k_returned int; k_ready_pickup int;
  k_picked int; k_delivered int;
  k_open_inc int; k_avg_hours numeric; k_csat numeric;
  k_del_success numeric; k_pick_success numeric;

  c_cases int; p_cases int;
  c_delivered int; p_delivered int;
  c_picked int; p_picked int;
  c_ready int; p_ready int;
  c_inc int; p_inc int;
  c_csat numeric; p_csat numeric;
  c_hours numeric; p_hours numeric;

  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO k_total FROM public.wf_case_status();

  SELECT count(*) FILTER (WHERE s.status = 'Located'),
         count(*) FILTER (WHERE s.status = 'Arrived at Airport'),
         count(*) FILTER (WHERE s.status = 'Waiting Customs Clearance'),
         count(*) FILTER (WHERE s.status = 'Ready for Delivery'),
         count(*) FILTER (WHERE s.status = 'Out for Delivery'),
         count(*) FILTER (WHERE s.status = 'Returned to Airport'),
         count(*) FILTER (WHERE s.status = 'Ready for Airport Pickup'),
         count(*) FILTER (WHERE s.status = 'Passenger Picked Up'),
         count(*) FILTER (WHERE s.status = 'Delivered'),
         count(*) FILTER (WHERE s.status NOT IN ('Delivered','Passenger Picked Up'))
    INTO k_located, k_arrived, k_customs, k_ready, k_out,
         k_returned, k_ready_pickup, k_picked, k_delivered, k_open
    FROM public.wf_case_status() s;

  SELECT count(*) INTO k_open_inc FROM public.quality_incidents i
   WHERE i.state::text <> 'Resolved';

  SELECT round(avg(extract(epoch FROM (c.resolved_at - c.created_at))/3600)::numeric, 1)
    INTO k_avg_hours FROM public.baggage_cases c WHERE c.resolved_at IS NOT NULL;

  SELECT round(avg(f.rating)::numeric, 2) INTO k_csat FROM public.passenger_feedback f;

  SELECT CASE WHEN count(*) FILTER (WHERE s.status IN ('Delivered','Returned to Airport')) = 0 THEN 0
              ELSE round(100.0 * count(*) FILTER (WHERE s.status = 'Delivered')
                   / count(*) FILTER (WHERE s.status IN ('Delivered','Returned to Airport')), 1) END
    INTO k_del_success
    FROM public.wf_case_status() s WHERE s.journey = 'Home Delivery';

  SELECT CASE WHEN count(*) = 0 THEN 0
              ELSE round(100.0 * count(*) FILTER (WHERE s.status = 'Passenger Picked Up') / count(*), 1) END
    INTO k_pick_success
    FROM public.wf_case_status() s WHERE s.journey = 'Airport Pickup';

  SELECT count(*) INTO c_cases FROM public.baggage_cases c
   WHERE c.created_at >= p_from AND c.created_at < p_to;
  SELECT count(*) INTO p_cases FROM public.baggage_cases c
   WHERE c.created_at >= prev_from AND c.created_at < prev_to;

  SELECT count(*) INTO c_delivered FROM public.workflow_events w
   WHERE w.to_status = 'DELIVERED' AND w.occurred_at >= p_from AND w.occurred_at < p_to;
  SELECT count(*) INTO p_delivered FROM public.workflow_events w
   WHERE w.to_status = 'DELIVERED' AND w.occurred_at >= prev_from AND w.occurred_at < prev_to;

  SELECT count(*) INTO c_picked FROM public.workflow_events w
   WHERE w.to_status = 'PASSENGER_PICKED_UP' AND w.occurred_at >= p_from AND w.occurred_at < p_to;
  SELECT count(*) INTO p_picked FROM public.workflow_events w
   WHERE w.to_status = 'PASSENGER_PICKED_UP' AND w.occurred_at >= prev_from AND w.occurred_at < prev_to;

  SELECT count(DISTINCT w.case_id) INTO c_ready FROM public.workflow_events w
   WHERE w.to_status::text IN ('READY_FOR_COLLECTION','READY_FOR_AIRPORT_PICKUP')
     AND w.occurred_at >= p_from AND w.occurred_at < p_to;
  SELECT count(DISTINCT w.case_id) INTO p_ready FROM public.workflow_events w
   WHERE w.to_status::text IN ('READY_FOR_COLLECTION','READY_FOR_AIRPORT_PICKUP')
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

  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'grain', g, 'span_days',
                                round(extract(epoch FROM span)/86400)),
    'kpis', jsonb_build_object(
      'totalCases',       jsonb_build_object('value', k_total,    'delta', public.dash_delta(c_cases, p_cases)),
      'openCases',        jsonb_build_object('value', k_open,     'delta', NULL),
      'locatedBags',      jsonb_build_object('value', k_located,  'delta', NULL),
      'arrivedAtAirport', jsonb_build_object('value', k_arrived,  'delta', NULL),
      'waitingCustoms',   jsonb_build_object('value', k_customs,  'delta', NULL),
      'readyForDelivery', jsonb_build_object('value', k_ready,    'delta', public.dash_delta(c_ready, p_ready)),
      'outForDelivery',   jsonb_build_object('value', k_out,      'delta', NULL),
      'returnedToAirport',jsonb_build_object('value', k_returned, 'delta', NULL),
      'readyForPickup',   jsonb_build_object('value', k_ready_pickup, 'delta', NULL),
      'passengerPickedUp',jsonb_build_object('value', k_picked,   'delta', public.dash_delta(c_picked, p_picked)),
      'deliveredBags',    jsonb_build_object('value', k_delivered,'delta', public.dash_delta(c_delivered, p_delivered)),
      'deliverySuccess',  jsonb_build_object('value', coalesce(k_del_success,0),  'delta', NULL),
      'pickupSuccess',    jsonb_build_object('value', coalesce(k_pick_success,0), 'delta', NULL),
      'openIncidents',    jsonb_build_object('value', k_open_inc, 'delta', public.dash_delta(c_inc, p_inc)),
      'avgResolution',    jsonb_build_object('value', coalesce(k_avg_hours,0), 'delta', public.dash_delta_num(c_hours, p_hours)),
      'csat',             jsonb_build_object('value', coalesce(k_csat,0), 'delta', public.dash_delta_num(c_csat, p_csat))
    ),
    'byStatus', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', l.status, 'count', x.n) ORDER BY l.ord)
      FROM public.wf_status_ladder() l
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS n FROM public.wf_case_status() s WHERE s.status = l.status
      ) x), '[]'::jsonb),
    'byCarrier', coalesce((
      SELECT jsonb_agg(jsonb_build_object('airline', a.airline, 'count', a.n) ORDER BY a.n DESC, a.airline)
      FROM (SELECT coalesce(nullif(btrim(c.airline),''),'Unknown') AS airline, count(*) AS n
              FROM public.baggage_cases c GROUP BY 1 ORDER BY 2 DESC LIMIT 12) a), '[]'::jsonb),
    'funnel', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', l.status, 'count', x.n) ORDER BY l.ord)
      FROM public.wf_status_ladder() l
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS n FROM public.wf_case_status() s WHERE s.status = l.status
      ) x), '[]'::jsonb),
    'trends', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'bucket', to_char(b.bucket, 'YYYY-MM-DD'),
               'opened', b.opened, 'resolved', b.resolved,
               'delivered', b.delivered, 'pickedUp', b.picked_up,
               'completed', b.delivered + b.picked_up,
               'incidents', b.incidents, 'csat', b.csat, 'successPct', b.success_pct) ORDER BY b.bucket)
      FROM (
        SELECT d.bucket,
          (SELECT count(*) FROM public.baggage_cases c
            WHERE date_trunc(g, c.created_at) = d.bucket) AS opened,
          (SELECT count(*) FROM public.baggage_cases c
            WHERE c.resolved_at IS NOT NULL AND date_trunc(g, c.resolved_at) = d.bucket) AS resolved,
          (SELECT count(*) FROM public.workflow_events w
            WHERE w.to_status = 'DELIVERED' AND date_trunc(g, w.occurred_at) = d.bucket) AS delivered,
          (SELECT count(*) FROM public.workflow_events w
            WHERE w.to_status = 'PASSENGER_PICKED_UP' AND date_trunc(g, w.occurred_at) = d.bucket) AS picked_up,
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
END; $function$;

REVOKE EXECUTE ON FUNCTION public.dashboard_executive(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_executive(timestamptz, timestamptz, text) TO authenticated, service_role;