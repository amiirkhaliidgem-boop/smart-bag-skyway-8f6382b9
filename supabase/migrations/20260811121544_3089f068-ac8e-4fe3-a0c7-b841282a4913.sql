CREATE OR REPLACE FUNCTION public.ops_core_rows(
  p_cases integer DEFAULT 500,
  p_deliveries integer DEFAULT 500,
  p_notes integer DEFAULT 900,
  p_otps integer DEFAULT 900,
  p_wf integer DEFAULT 900
) RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'stations', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                 FROM (SELECT * FROM stations ORDER BY is_default DESC) t),
    'cases', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
              FROM (SELECT * FROM baggage_cases ORDER BY created_at DESC LIMIT p_cases) t),
    'bags', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
             FROM (SELECT * FROM case_bags LIMIT p_cases * 2) t),
    'deliveries', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                   FROM (
                     SELECT d.*,
                            r.name AS region_name,
                            public.sla_delivery_hours(d.case_id) AS sla_hours,
                            d.created_at AS sla_started_at,
                            d.created_at
                              + make_interval(hours => public.sla_delivery_hours(d.case_id))
                              AS sla_due_at
                     FROM deliveries d
                     LEFT JOIN baggage_cases c ON c.id = d.case_id
                     LEFT JOIN sla_regions r ON r.id = c.region_id
                     ORDER BY d.created_at DESC
                     LIMIT p_deliveries
                   ) t),
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
$fn$;