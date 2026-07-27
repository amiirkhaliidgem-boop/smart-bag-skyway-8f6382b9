CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_key ON public.app_users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS app_users_employee_id_key ON public.app_users (lower(employee_id));

CREATE OR REPLACE FUNCTION public.login_identity_for_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM public.app_users u
  WHERE u.user_type = 'staff'
    AND u.status = 'Active'
    AND lower(u.username) = lower(trim(_username))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.login_identity_for_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_identity_for_username(text) TO anon, authenticated, service_role;