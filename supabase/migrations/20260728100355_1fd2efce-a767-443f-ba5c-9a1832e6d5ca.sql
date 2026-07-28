-- ============================================================
-- Phase 1 · Migration 3 — Engine support tables
-- ============================================================

-- Retire the legacy passenger projection + RPCs (demo data discarded).
DROP FUNCTION IF EXISTS public.passenger_confirm_delivery(text);
DROP FUNCTION IF EXISTS public.passenger_report_misconduct(text);
DROP FUNCTION IF EXISTS public.passenger_submit_feedback(text, integer, boolean, text);
DROP FUNCTION IF EXISTS public._passenger_apply_action(text, text);
DROP FUNCTION IF EXISTS public.get_passenger_view(text);
DROP TRIGGER IF EXISTS trg_sync_passenger_public ON public.app_state;
DROP FUNCTION IF EXISTS public.sync_passenger_public_from_app_state() CASCADE;
DROP TABLE IF EXISTS public.passenger_feedback CASCADE;
DROP TABLE IF EXISTS public.passenger_links CASCADE;
DROP TABLE IF EXISTS public.delivery_public_view CASCADE;

-- ---------- OTP challenges ----------
CREATE TABLE public.otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[0-9]{6}$'),
  state public.otp_state NOT NULL DEFAULT 'Pending',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  locked_at timestamptz,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX otp_one_active_per_delivery_idx
  ON public.otp_challenges (delivery_id)
  WHERE state IN ('Pending','Sent');
CREATE INDEX otp_delivery_idx ON public.otp_challenges (delivery_id, issued_at DESC);
CREATE TRIGGER otp_bump BEFORE UPDATE ON public.otp_challenges
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

CREATE OR REPLACE FUNCTION public.otp_validate_expiry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expires_at <= NEW.issued_at THEN
    RAISE EXCEPTION 'OTP expiry must be after issue time';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER otp_expiry_check BEFORE INSERT OR UPDATE ON public.otp_challenges
  FOR EACH ROW EXECUTE FUNCTION public.otp_validate_expiry();

-- Only administrators may read raw OTP codes; agents must never see them.
GRANT SELECT ON public.otp_challenges TO authenticated;
GRANT ALL ON public.otp_challenges TO service_role;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read otp" ON public.otp_challenges
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------- Passenger links ----------
CREATE TABLE public.passenger_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (length(token) >= 16),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'staff_preview',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX passenger_links_active_per_delivery_idx
  ON public.passenger_links (delivery_id) WHERE revoked_at IS NULL;
CREATE INDEX passenger_links_case_idx ON public.passenger_links (case_id);
CREATE TRIGGER passenger_links_bump BEFORE UPDATE ON public.passenger_links
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

GRANT SELECT ON public.passenger_links TO authenticated;
GRANT ALL ON public.passenger_links TO service_role;
ALTER TABLE public.passenger_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read passenger links" ON public.passenger_links
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Passenger feedback ----------
CREATE TABLE public.passenger_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.passenger_links(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  resolved boolean NOT NULL DEFAULT true,
  comments text NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX passenger_feedback_one_per_delivery_idx
  ON public.passenger_feedback (delivery_id);
CREATE INDEX passenger_feedback_submitted_idx ON public.passenger_feedback (submitted_at DESC);
CREATE TRIGGER passenger_feedback_immutable
  BEFORE UPDATE OR DELETE ON public.passenger_feedback
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

GRANT SELECT ON public.passenger_feedback TO authenticated;
GRANT ALL ON public.passenger_feedback TO service_role;
ALTER TABLE public.passenger_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read feedback" ON public.passenger_feedback
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Public passenger projection ----------
CREATE TABLE public.passenger_view (
  delivery_id uuid PRIMARY KEY REFERENCES public.deliveries(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  passenger_name text NOT NULL DEFAULT '',
  stage public.delivery_stage NOT NULL,
  workflow_status public.workflow_status NOT NULL,
  pir_number text NOT NULL DEFAULT '',
  bag_tag text,
  airline text,
  flight_no text,
  flight_date date,
  otp_code text,
  otp_state public.otp_state,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.passenger_view TO authenticated;
GRANT ALL ON public.passenger_view TO service_role;
ALTER TABLE public.passenger_view ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read passenger view" ON public.passenger_view
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Notifications ----------
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  trigger_status public.workflow_status NOT NULL,
  channel public.notification_channel NOT NULL,
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en','ar')),
  recipient text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  state public.notification_state NOT NULL DEFAULT 'queued',
  provider text,
  provider_message_id text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  failure_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);
CREATE INDEX notification_events_state_idx ON public.notification_events (state, next_attempt_at);
CREATE INDEX notification_events_delivery_idx ON public.notification_events (delivery_id, created_at DESC);
CREATE INDEX notification_events_created_idx ON public.notification_events (created_at DESC);
CREATE TRIGGER notification_events_bump BEFORE UPDATE ON public.notification_events
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

GRANT SELECT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read notifications" ON public.notification_events
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

CREATE TABLE public.notification_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL,
  provider text NOT NULL DEFAULT 'simulated',
  succeeded boolean NOT NULL DEFAULT false,
  provider_message_id text,
  error text NOT NULL DEFAULT '',
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_attempts_notification_idx
  ON public.notification_attempts (notification_id, attempted_at DESC);
CREATE TRIGGER notification_attempts_immutable
  BEFORE UPDATE OR DELETE ON public.notification_attempts
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

GRANT SELECT ON public.notification_attempts TO authenticated;
GRANT ALL ON public.notification_attempts TO service_role;
ALTER TABLE public.notification_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read notification attempts" ON public.notification_attempts
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Quality incidents ----------
CREATE TABLE public.quality_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity public.incident_severity NOT NULL DEFAULT 'Medium',
  state public.incident_state NOT NULL DEFAULT 'Open',
  description text NOT NULL DEFAULT '',
  reported_by text NOT NULL DEFAULT 'System',
  resolved_at timestamptz,
  resolution_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);
CREATE INDEX quality_incidents_state_idx ON public.quality_incidents (state, created_at DESC);
CREATE INDEX quality_incidents_delivery_idx ON public.quality_incidents (delivery_id);
CREATE TRIGGER quality_incidents_bump BEFORE UPDATE ON public.quality_incidents
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

GRANT SELECT ON public.quality_incidents TO authenticated;
GRANT ALL ON public.quality_incidents TO service_role;
ALTER TABLE public.quality_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read incidents" ON public.quality_incidents
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Agent positions & optimised routes ----------
CREATE TABLE public.agent_positions (
  agent_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  reported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);
CREATE TRIGGER agent_positions_bump BEFORE UPDATE ON public.agent_positions
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

GRANT SELECT ON public.agent_positions TO authenticated;
GRANT ALL ON public.agent_positions TO service_role;
ALTER TABLE public.agent_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read agent positions" ON public.agent_positions
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));
CREATE POLICY "agents read own position" ON public.agent_positions
  FOR SELECT TO authenticated USING (agent_id = public.current_app_user_id());

CREATE TABLE public.agent_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  origin_label text NOT NULL DEFAULT '',
  total_km numeric(8,2) NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX agent_routes_one_per_agent_idx ON public.agent_routes (agent_id);
CREATE TRIGGER agent_routes_bump BEFORE UPDATE ON public.agent_routes
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

CREATE TABLE public.agent_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.agent_routes(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  lat double precision,
  lng double precision,
  label text NOT NULL DEFAULT '',
  leg_km numeric(8,2) NOT NULL DEFAULT 0,
  UNIQUE (route_id, seq),
  UNIQUE (route_id, delivery_id)
);
CREATE INDEX agent_route_stops_route_idx ON public.agent_route_stops (route_id, seq);

GRANT SELECT ON public.agent_routes TO authenticated;
GRANT SELECT ON public.agent_route_stops TO authenticated;
GRANT ALL ON public.agent_routes TO service_role;
GRANT ALL ON public.agent_route_stops TO service_role;
ALTER TABLE public.agent_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops staff read routes" ON public.agent_routes
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));
CREATE POLICY "agents read own route" ON public.agent_routes
  FOR SELECT TO authenticated USING (agent_id = public.current_app_user_id());
CREATE POLICY "ops staff read route stops" ON public.agent_route_stops
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));
CREATE POLICY "agents read own route stops" ON public.agent_route_stops
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.agent_routes r
    WHERE r.id = agent_route_stops.route_id
      AND r.agent_id = public.current_app_user_id()
  ));
