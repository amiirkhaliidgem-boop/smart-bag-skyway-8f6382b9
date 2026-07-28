-- 1. Revoke anon EXECUTE on staff-only SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.lf_create_case(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lf_update_case(uuid, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lf_set_status(uuid, public.lf_status, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lf_bulk_set_status(uuid[], public.lf_status) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_schedule(uuid, timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_assign_agent(uuid, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_resend_otp(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_add_note(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_mark_failed(uuid, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_mark_returned(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dm_close(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.agent_advance(uuid, public.delivery_stage, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.agent_complete_delivery(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.agent_report_position(double precision, double precision, double precision) FROM anon;
REVOKE EXECUTE ON FUNCTION public.agent_owns(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_ops_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notif_claim_batch(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notif_record_result(uuid, boolean, text, text, text) FROM anon;

-- 2. Passenger link view accounting (function becomes VOLATILE so it can write).
CREATE OR REPLACE FUNCTION public.passenger_get_view(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE l public.passenger_links%ROWTYPE; v public.passenger_view%ROWTYPE; expose boolean;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN NULL; END IF;
  SELECT * INTO l FROM public.passenger_links WHERE token = p_token;
  IF NOT FOUND OR l.revoked_at IS NOT NULL
     OR (l.expires_at IS NOT NULL AND l.expires_at < now()) THEN RETURN NULL; END IF;
  SELECT * INTO v FROM public.passenger_view WHERE delivery_id = l.delivery_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.passenger_links
     SET view_count = view_count + 1, last_viewed_at = now()
   WHERE id = l.id;

  expose := v.stage IN ('Out for Delivery');
  RETURN jsonb_build_object(
    'passenger_name', v.passenger_name,
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

-- 3. Covering indexes for foreign keys that had none.
CREATE INDEX IF NOT EXISTS agent_route_stops_delivery_idx ON public.agent_route_stops (delivery_id);
CREATE INDEX IF NOT EXISTS audit_events_case_idx ON public.audit_events (case_id);
CREATE INDEX IF NOT EXISTS audit_events_delivery_idx ON public.audit_events (delivery_id);
CREATE INDEX IF NOT EXISTS baggage_cases_created_by_idx ON public.baggage_cases (created_by);
CREATE INDEX IF NOT EXISTS baggage_cases_station_idx ON public.baggage_cases (station_id);
CREATE INDEX IF NOT EXISTS deliveries_created_by_idx ON public.deliveries (created_by);
CREATE INDEX IF NOT EXISTS deliveries_failure_reason_idx ON public.deliveries (failure_reason_id);
CREATE INDEX IF NOT EXISTS deliveries_station_idx ON public.deliveries (station_id);
CREATE INDEX IF NOT EXISTS notification_events_case_idx ON public.notification_events (case_id);
CREATE INDEX IF NOT EXISTS passenger_feedback_case_idx ON public.passenger_feedback (case_id);
CREATE INDEX IF NOT EXISTS passenger_feedback_link_idx ON public.passenger_feedback (link_id);
CREATE INDEX IF NOT EXISTS passenger_view_case_idx ON public.passenger_view (case_id);
CREATE INDEX IF NOT EXISTS quality_incidents_case_idx ON public.quality_incidents (case_id);
CREATE INDEX IF NOT EXISTS user_role_assignments_role_idx ON public.user_role_assignments (role_id);

-- 4. Route recompute without a per-call temp table.
CREATE OR REPLACE FUNCTION public.wf_recompute_route(p_agent uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_route uuid; v_lat double precision; v_lng double precision; v_label text;
  cur_lat double precision; cur_lng double precision;
  p_ids uuid[]; p_lat double precision[]; p_lng double precision[]; p_label text[];
  best int; best_d numeric; d numeric; n_lat double precision; n_lng double precision;
  i integer := 0; total numeric := 0; k integer;
BEGIN
  SELECT coalesce(p.lat, s.lat), coalesce(p.lng, s.lng), s.name
    INTO v_lat, v_lng, v_label
  FROM public.stations s
  LEFT JOIN public.agent_positions p ON p.agent_id = p_agent
  WHERE s.is_default LIMIT 1;

  INSERT INTO public.agent_routes(agent_id, origin_lat, origin_lng, origin_label, computed_at)
  VALUES (p_agent, v_lat, v_lng, coalesce(v_label,''), now())
  ON CONFLICT (agent_id) DO UPDATE SET
    origin_lat = EXCLUDED.origin_lat, origin_lng = EXCLUDED.origin_lng,
    origin_label = EXCLUDED.origin_label, computed_at = now()
  RETURNING id INTO v_route;

  DELETE FROM public.agent_route_stops WHERE route_id = v_route;

  SELECT array_agg(d.id), array_agg(d.dest_lat), array_agg(d.dest_lng), array_agg(coalesce(d.address,''))
    INTO p_ids, p_lat, p_lng, p_label
  FROM public.deliveries d
  WHERE d.assigned_agent_id = p_agent
    AND d.stage IN ('Assigned','Driver Accepted','Collected Bag','Out for Delivery');

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    UPDATE public.agent_routes SET total_km = 0 WHERE id = v_route;
    RETURN;
  END IF;

  cur_lat := v_lat; cur_lng := v_lng;

  WHILE array_length(p_ids, 1) > 0 LOOP
    best := NULL; best_d := NULL;
    FOR k IN 1 .. array_length(p_ids, 1) LOOP
      IF p_lat[k] IS NULL OR p_lng[k] IS NULL THEN
        d := 1e9;
      ELSE
        d := sqrt(power(p_lat[k] - cur_lat, 2) + power(p_lng[k] - cur_lng, 2))::numeric;
      END IF;
      IF best_d IS NULL OR d < best_d THEN best_d := d; best := k; END IF;
    END LOOP;

    i := i + 1;
    n_lat := p_lat[best]; n_lng := p_lng[best];
    d := round((111.0 * sqrt(power(coalesce(n_lat, cur_lat) - cur_lat, 2)
                           + power(coalesce(n_lng, cur_lng) - cur_lng, 2)))::numeric, 2);
    INSERT INTO public.agent_route_stops(route_id, delivery_id, seq, lat, lng, label, leg_km)
    VALUES (v_route, p_ids[best], i, n_lat, n_lng, coalesce(p_label[best],''), d);
    total := total + d;
    cur_lat := coalesce(n_lat, cur_lat); cur_lng := coalesce(n_lng, cur_lng);

    p_ids := p_ids[1:best-1] || p_ids[best+1:array_length(p_ids,1)];
    p_lat := p_lat[1:best-1] || p_lat[best+1:array_length(p_lat,1)];
    p_lng := p_lng[1:best-1] || p_lng[best+1:array_length(p_lng,1)];
    p_label := p_label[1:best-1] || p_label[best+1:array_length(p_label,1)];
  END LOOP;

  UPDATE public.agent_routes SET total_km = total WHERE id = v_route;
END; $function$;