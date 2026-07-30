CREATE OR REPLACE FUNCTION public.list_delivery_agents()
RETURNS TABLE(id uuid, full_name text, employee_id text, station text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u.id, u.full_name, u.employee_id, u.station
  FROM public.app_users u
  WHERE u.status = 'Active'
    AND (
      u.user_type = 'driver'
      OR EXISTS (
        SELECT 1
        FROM public.user_role_assignments a
        JOIN public.app_roles r ON r.id = a.role_id
        WHERE a.app_user_id = u.id
          AND r.key = 'delivery_agent'
      )
    )
  ORDER BY u.full_name
$$;