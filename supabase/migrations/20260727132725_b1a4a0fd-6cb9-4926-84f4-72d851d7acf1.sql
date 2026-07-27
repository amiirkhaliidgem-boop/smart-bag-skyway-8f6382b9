CREATE OR REPLACE FUNCTION public.login_identity_for_username(_username text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
           nullif(trim(u.email), ''),
           lower(u.username) || CASE WHEN u.user_type = 'driver' THEN '@agent.local' ELSE '@staff.local' END
         )
  FROM public.app_users u
  WHERE lower(u.username) = lower(trim(_username))
     OR lower(u.employee_id) = lower(trim(_username))
  ORDER BY (lower(u.username) = lower(trim(_username))) DESC
  LIMIT 1
$function$;

REVOKE EXECUTE ON FUNCTION public.login_identity_for_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_identity_for_username(text) TO anon, authenticated;