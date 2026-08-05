-- Fan-in snapshot readers: one DB round trip (one pooled PostgREST connection)
-- per snapshot tier instead of 10 / 6 / 9 separate PostgREST requests.
-- SECURITY INVOKER: RLS applies exactly as it does to the direct table reads.

CREATE OR REPLACE FUNCTION public.ops_core_rows(
  p_cases integer DEFAULT 500,
  p_deliveries integer DEFAULT 500,
  p_notes integer DEFAULT 900,
  p_otps integer DEFAULT 900,
  p_wf integer DEFAULT 900
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'stations', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                 FROM (SELECT * FROM stations ORDER BY is_default DESC) t),
    'cases', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
              FROM (SELECT * FROM baggage_cases ORDER BY created_at DESC LIMIT p_cases) t),
    'bags', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
             FROM (SELECT * FROM case_bags LIMIT p_cases * 2) t),
    'deliveries', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                   FROM (SELECT * FROM deliveries ORDER BY created_at DESC LIMIT p_deliveries) t),
    'notes', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
              FROM (SELECT * FROM delivery_notes ORDER BY created_at DESC LIMIT p_notes) t),
    'otps', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
             FROM (SELECT * FROM otp_challenges ORDER BY issued_at DESC LIMIT p_otps) t),
    'links', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
              FROM (SELECT * FROM passenger_links WHERE revoked_at IS NULL) t),
    'wf_events', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                  FROM (SELECT * FROM workflow_events ORDER BY occurred_at DESC LIMIT p_wf) t),
    'users', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
              FROM (SELECT id, full_name, employee_id, user_type, status FROM app_users) t),
    'failure_reasons', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                        FROM (SELECT * FROM failure_reasons) t)
  );
$$;

CREATE OR REPLACE FUNCTION public.ops_activity_rows(
  p_cases integer DEFAULT 500,
  p_deliveries integer DEFAULT 500,
  p_audit integer DEFAULT 500,
  p_notifications integer DEFAULT 500,
  p_timeline integer DEFAULT 800
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ref_cases', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                  FROM (SELECT id, case_no, pir_number, passenger_name
                        FROM baggage_cases LIMIT p_cases) t),
    'ref_deliveries', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                       FROM (SELECT id, delivery_no, passenger_name, assigned_agent_id
                             FROM deliveries LIMIT p_deliveries) t),
    'ref_users', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                  FROM (SELECT id, full_name FROM app_users) t),
    'audit', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
              FROM (SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT p_audit) t),
    'notifications', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                      FROM (SELECT * FROM notification_events ORDER BY created_at DESC LIMIT p_notifications) t),
    'timeline', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                 FROM (SELECT * FROM timeline_events ORDER BY occurred_at DESC LIMIT p_timeline) t)
  );
$$;

CREATE OR REPLACE FUNCTION public.ops_secondary_rows(
  p_cases integer DEFAULT 500,
  p_deliveries integer DEFAULT 500,
  p_feedback integer DEFAULT 500,
  p_incidents integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ref_cases', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                  FROM (SELECT id, case_no, pir_number, passenger_name
                        FROM baggage_cases LIMIT p_cases) t),
    'ref_deliveries', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                       FROM (SELECT id, delivery_no, passenger_name, assigned_agent_id
                             FROM deliveries LIMIT p_deliveries) t),
    'ref_users', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                  FROM (SELECT id, full_name FROM app_users) t),
    'feedback', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                 FROM (SELECT * FROM passenger_feedback ORDER BY submitted_at DESC LIMIT p_feedback) t),
    'incidents', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                  FROM (SELECT * FROM quality_incidents ORDER BY created_at DESC LIMIT p_incidents) t),
    'positions', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                  FROM (SELECT * FROM agent_positions) t),
    'routes', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
               FROM (SELECT * FROM agent_routes) t),
    'route_stops', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                    FROM (SELECT * FROM agent_route_stops ORDER BY seq) t)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.ops_core_rows(integer,integer,integer,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ops_activity_rows(integer,integer,integer,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ops_secondary_rows(integer,integer,integer,integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ops_core_rows(integer,integer,integer,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ops_activity_rows(integer,integer,integer,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ops_secondary_rows(integer,integer,integer,integer) TO authenticated, service_role;