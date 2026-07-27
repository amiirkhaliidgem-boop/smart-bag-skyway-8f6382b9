-- ============ ROLES ============
CREATE TABLE public.app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  legacy_role public.app_role,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read app_roles" ON public.app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage app_roles" ON public.app_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ USERS ============
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  employee_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  username text NOT NULL UNIQUE,
  email text,
  mobile text,
  department text NOT NULL DEFAULT '',
  station text NOT NULL DEFAULT 'Airport',
  team text NOT NULL DEFAULT '',
  position text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  user_type text NOT NULL DEFAULT 'staff',
  driver_pin_hash text,
  driver_pin_salt text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_users TO authenticated;
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own or agent records" ON public.app_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_type = 'driver' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage app_users" ON public.app_users FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER app_users_updated_at BEFORE UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER app_roles_updated_at BEFORE UPDATE ON public.app_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PERMISSION MATRIX ============
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.app_roles(id) ON DELETE CASCADE,
  module text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, module, action)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read role_permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage role_permissions" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ROLE ASSIGNMENT (one primary role per person) ============
CREATE TABLE public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.app_roles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_role_assignments TO authenticated;
GRANT ALL ON public.user_role_assignments TO service_role;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read role assignments" ON public.user_role_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage role assignments" ON public.user_role_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ADMIN AUDIT LOG ============
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text,
  action text NOT NULL,
  target text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read admin audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (true);

-- ============ PERMISSION HELPERS ============
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users u
    JOIN public.user_role_assignments a ON a.app_user_id = u.id
    JOIN public.role_permissions p ON p.role_id = a.role_id
    WHERE u.user_id = _user_id
      AND u.status = 'Active'
      AND p.module = _module
      AND p.action = _action
      AND p.allowed
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_permissions()
RETURNS TABLE (module text, action text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.module, p.action
  FROM public.app_users u
  JOIN public.user_role_assignments a ON a.app_user_id = u.id
  JOIN public.role_permissions p ON p.role_id = a.role_id
  WHERE u.user_id = auth.uid() AND u.status = 'Active' AND p.allowed
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_permissions() TO authenticated, service_role;

-- ============ SEED ROLES ============
INSERT INTO public.app_roles (key, name, description, is_system, legacy_role) VALUES
  ('administrator','Airport Administrator','Full access to every module and to Administration.',true,'admin'),
  ('lf_officer','Lost & Found Officer','Baggage case handling, warehouse, tracking, feedback and reporting.',true,'agent'),
  ('delivery_coordinator','Delivery Coordinator','Dispatch Center, delivery lifecycle and agent assignment.',true,'coordinator'),
  ('delivery_agent','Delivery Agent','Delivery Agent Portal only.',true,'driver');

-- Full matrix, denied by default.
INSERT INTO public.role_permissions (role_id, module, action, allowed)
SELECT r.id, m.module, a.action, false
FROM public.app_roles r
CROSS JOIN (VALUES
  ('Executive Dashboard'),('Lost & Found'),('Baggage Tracking'),('Customer Feedback'),
  ('Delivery Management'),('Driver Portal'),('Warehouse'),('QR'),('Workflow Monitor'),
  ('Notification Center'),('Timeline'),('Reports'),('Import / Export'),('Administration')
) AS m(module)
CROSS JOIN (VALUES
  ('View'),('Create'),('Edit'),('Delete'),('Assign'),('Approve'),('Export'),('Print'),('Manage')
) AS a(action);

-- Administrator: everything.
UPDATE public.role_permissions SET allowed = true
WHERE role_id = (SELECT id FROM public.app_roles WHERE key='administrator');

-- Lost & Found Officer.
UPDATE public.role_permissions SET allowed = true
WHERE role_id = (SELECT id FROM public.app_roles WHERE key='lf_officer')
  AND module IN ('Executive Dashboard','Lost & Found','Baggage Tracking','Customer Feedback','Warehouse','QR','Reports','Import / Export')
  AND action IN ('View','Create','Edit','Assign','Export','Print');

-- Delivery Coordinator.
UPDATE public.role_permissions SET allowed = true
WHERE role_id = (SELECT id FROM public.app_roles WHERE key='delivery_coordinator')
  AND module IN ('Executive Dashboard','Delivery Management','Baggage Tracking')
  AND action IN ('View','Create','Edit','Assign','Approve','Export','Print');

-- Delivery Agent.
UPDATE public.role_permissions SET allowed = true
WHERE role_id = (SELECT id FROM public.app_roles WHERE key='delivery_agent')
  AND module = 'Driver Portal'
  AND action IN ('View','Edit');

-- ============ BACKFILL EXISTING SIGN-IN ACCOUNTS ============
INSERT INTO public.app_users (user_id, employee_id, full_name, username, email, status, user_type, last_login_at, created_at)
SELECT
  u.id,
  'EMP-' || upper(substr(replace(u.id::text,'-',''),1,6)),
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), split_part(u.email,'@',1)),
  split_part(u.email,'@',1),
  u.email,
  'Active',
  'staff',
  u.last_sign_in_at,
  u.created_at
FROM auth.users u
WHERE u.email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Map existing legacy roles onto the new assignment table.
INSERT INTO public.user_role_assignments (app_user_id, role_id)
SELECT DISTINCT ON (au.id) au.id, r.id
FROM public.app_users au
JOIN public.user_roles ur ON ur.user_id = au.user_id
JOIN public.app_roles r ON r.legacy_role = ur.role
ORDER BY au.id, (r.key = 'administrator') DESC
ON CONFLICT (app_user_id) DO NOTHING;

-- ============ SEED TEST DELIVERY AGENT ============
INSERT INTO public.app_users (employee_id, full_name, username, mobile, station, position, status, user_type, department)
VALUES ('EMP-DA001','Ahmed Mostafa','ahmed.mostafa','+20 100 000 0001','Airport','Delivery Agent','Active','driver','Delivery Operations')
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO public.user_role_assignments (app_user_id, role_id)
SELECT au.id, r.id FROM public.app_users au, public.app_roles r
WHERE au.employee_id = 'EMP-DA001' AND r.key = 'delivery_agent'
ON CONFLICT (app_user_id) DO NOTHING;