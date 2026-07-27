DROP POLICY IF EXISTS "read own or agent records" ON public.app_users;

CREATE POLICY "read own record or admin"
ON public.app_users FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.list_delivery_agents()
RETURNS TABLE(id uuid, full_name text, employee_id text, station text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.id, u.full_name, u.employee_id, u.station
  FROM public.app_users u
  WHERE u.user_type = 'driver' AND u.status = 'Active'
  ORDER BY u.full_name
$$;

REVOKE EXECUTE ON FUNCTION public.list_delivery_agents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_delivery_agents() TO authenticated;