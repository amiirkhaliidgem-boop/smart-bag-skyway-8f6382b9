CREATE OR REPLACE FUNCTION public.login_identity_for_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(nullif(trim(u.email), ''), lower(u.username) || '@staff.local')
  FROM public.app_users u
  WHERE u.user_type = 'staff'
    AND lower(u.username) = lower(trim(_username))
  LIMIT 1
$$;