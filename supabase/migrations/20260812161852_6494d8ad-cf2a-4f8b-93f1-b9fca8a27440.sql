-- 1. Staff directory readable by any authenticated user, minimal columns only.
CREATE OR REPLACE FUNCTION public.staff_directory()
RETURNS TABLE(id uuid, full_name text, employee_id text, user_type text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.full_name, u.employee_id, u.user_type, u.status
  FROM public.app_users u
$$;

REVOKE EXECUTE ON FUNCTION public.staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_directory() TO authenticated, service_role;

-- 2. ops_core_rows: read the users block through the directory function.
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
              FROM (SELECT * FROM public.staff_directory()) t),
    'failure_reasons', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                        FROM (SELECT * FROM failure_reasons) t)
  );
$$;

-- 3. Security findings: restrict audit trail and API health checks.
DROP POLICY IF EXISTS "authenticated read admin audit" ON public.admin_audit_log;
CREATE POLICY "admins read admin audit"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "staff read api health" ON public.api_health_checks;
CREATE POLICY "admins read api health"
  ON public.api_health_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));