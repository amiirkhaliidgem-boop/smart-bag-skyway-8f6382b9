-- ============================================================
-- Production Architecture Phase 1 · Migration 1 — Foundation
-- ============================================================

-- ---------- Canonical enums ----------
CREATE TYPE public.lf_status AS ENUM (
  'Open','Tracing','Located','Arrived at Airport','Waiting Customs Clearance',
  'Ready for Delivery','Assigned Driver','Out for Delivery','Delivered','Closed'
);

CREATE TYPE public.delivery_stage AS ENUM (
  'Ready for Delivery','Scheduled','Assigned','Driver Accepted','Collected Bag',
  'Out for Delivery','Delivered','Delivery Failed','Returned to Airport'
);

CREATE TYPE public.workflow_status AS ENUM (
  'PIR_CREATED','HOME_DELIVERY_REQUESTED','DELIVERY_APPROVED','DRIVER_ASSIGNED',
  'READY_FOR_COLLECTION','CLAIMED_ON_HAND','OUT_FOR_DELIVERY','DRIVER_ARRIVED',
  'OTP_VERIFIED','DELIVERED','FEEDBACK_SUBMITTED','CLOSED'
);

CREATE TYPE public.otp_state AS ENUM ('Pending','Sent','Verified','Failed','Expired');
CREATE TYPE public.case_priority AS ENUM ('Normal','VIP');
CREATE TYPE public.delivery_method AS ENUM ('Home Delivery','Airport Pickup');
CREATE TYPE public.notification_channel AS ENUM ('sms','whatsapp','email','push');
CREATE TYPE public.notification_state AS ENUM ('queued','sending','sent','failed','cancelled');
CREATE TYPE public.incident_severity AS ENUM ('High','Medium','Low');
CREATE TYPE public.incident_state AS ENUM ('Open','Under Review','Resolved');
CREATE TYPE public.timeline_module AS ENUM (
  'lost_found','delivery','agent_portal','passenger_portal','workflow',
  'notification','otp','feedback','quality','admin','system'
);

-- ---------- Shared trigger helpers ----------
CREATE OR REPLACE FUNCTION public.bump_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

-- ---------- Station configuration (single station) ----------
CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX stations_single_default_idx ON public.stations (is_default) WHERE is_default;

GRANT SELECT ON public.stations TO authenticated;
GRANT ALL ON public.stations TO service_role;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read stations" ON public.stations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage stations" ON public.stations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER stations_bump BEFORE UPDATE ON public.stations
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

INSERT INTO public.stations (code, name, lat, lng, timezone)
VALUES ('CAI', 'Cairo International Airport', 30.1219, 31.4056, 'Africa/Cairo');

-- ---------- SLA policy (data-driven on-time targets) ----------
CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage public.delivery_stage NOT NULL UNIQUE,
  target_minutes integer NOT NULL CHECK (target_minutes > 0),
  warn_at_pct integer NOT NULL DEFAULT 80 CHECK (warn_at_pct BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.sla_policies TO authenticated;
GRANT ALL ON public.sla_policies TO service_role;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read sla" ON public.sla_policies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage sla" ON public.sla_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER sla_policies_bump BEFORE UPDATE ON public.sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

INSERT INTO public.sla_policies (stage, target_minutes) VALUES
  ('Ready for Delivery', 120),
  ('Scheduled', 120),
  ('Assigned', 30),
  ('Driver Accepted', 30),
  ('Collected Bag', 60),
  ('Out for Delivery', 240);

-- ---------- Approved failure reasons ----------
CREATE TABLE public.failure_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label_en text NOT NULL,
  label_ar text NOT NULL DEFAULT '',
  allows_retry boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.failure_reasons TO authenticated;
GRANT ALL ON public.failure_reasons TO service_role;
ALTER TABLE public.failure_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read failure reasons" ON public.failure_reasons
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage failure reasons" ON public.failure_reasons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER failure_reasons_bump BEFORE UPDATE ON public.failure_reasons
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

INSERT INTO public.failure_reasons (code, label_en, allows_retry, sort_order) VALUES
  ('passenger_not_available','Passenger Not Available',true,1),
  ('passenger_requested_reschedule','Passenger Requested Reschedule',true,2),
  ('wrong_address','Wrong Address',true,3),
  ('phone_not_reachable','Phone Not Reachable',true,4),
  ('passenger_refused','Passenger Refused',false,5),
  ('security_issue','Security Issue',false,6),
  ('agent_issue','Delivery Agent Issue',true,7),
  ('weather','Weather',true,8),
  ('other','Other',true,9);

-- ---------- Human-readable delivery numbers ----------
CREATE SEQUENCE public.delivery_no_seq START 1;
GRANT USAGE ON SEQUENCE public.delivery_no_seq TO service_role;

CREATE OR REPLACE FUNCTION public.next_delivery_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'DEL-' || lpad(nextval('public.delivery_no_seq')::text, 6, '0')
$$;
REVOKE EXECUTE ON FUNCTION public.next_delivery_no() FROM PUBLIC, anon, authenticated;

CREATE SEQUENCE public.pir_no_seq START 1;
GRANT USAGE ON SEQUENCE public.pir_no_seq TO service_role;

CREATE OR REPLACE FUNCTION public.next_case_no()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'BAG-' || lpad(nextval('public.pir_no_seq')::text, 6, '0')
$$;
REVOKE EXECUTE ON FUNCTION public.next_case_no() FROM PUBLIC, anon, authenticated;
