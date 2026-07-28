-- ============================================================
-- Phase 1 · Migration 2 — Operational core
-- ============================================================

-- ---------- Identity helpers ----------
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id FROM public.app_users u
  WHERE u.user_id = auth.uid() AND u.status = 'Active'
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_ops_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.has_role(_user_id, 'agent')
      OR public.has_role(_user_id, 'coordinator')
$$;
GRANT EXECUTE ON FUNCTION public.is_ops_staff(uuid) TO authenticated;

-- ---------- Baggage cases ----------
CREATE TABLE public.baggage_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_no text NOT NULL UNIQUE,
  pir_number text NOT NULL UNIQUE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,

  lf_status public.lf_status NOT NULL DEFAULT 'Open',
  workflow_status public.workflow_status NOT NULL DEFAULT 'PIR_CREATED',
  priority public.case_priority NOT NULL DEFAULT 'Normal',

  passenger_name text NOT NULL,
  passenger_first_name text,
  passenger_middle_name text,
  passenger_last_name text,
  nationality text,
  passport_number text,
  pnr text,
  ticket_number text,
  contact_mobile text NOT NULL DEFAULT '',
  contact_mobile_alt text,
  email text,

  airline text NOT NULL,
  flight_number text NOT NULL,
  arrival_date date,
  arrival_time text,
  origin_airport text,
  destination_airport text,
  terminal text,
  arrival_belt text,

  number_of_bags integer NOT NULL DEFAULT 1 CHECK (number_of_bags BETWEEN 1 AND 20),
  weight_kg numeric(6,2),
  bag_brand text,
  bag_color text,
  bag_type text,
  bag_size text,
  distinctive_marks text,
  fragile boolean NOT NULL DEFAULT false,
  rush_delivery boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',

  delivery_method public.delivery_method NOT NULL DEFAULT 'Home Delivery',
  full_address text NOT NULL DEFAULT '',
  preferred_delivery_time text,
  google_maps_link text,
  dest_lat double precision,
  dest_lng double precision,

  storage_zone text,
  storage_shelf text,
  storage_position text,

  assigned_officer_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  department text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',

  incomplete boolean NOT NULL DEFAULT false,
  missing_fields text[] NOT NULL DEFAULT '{}',

  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);

CREATE INDEX baggage_cases_lf_status_idx ON public.baggage_cases (lf_status);
CREATE INDEX baggage_cases_workflow_status_idx ON public.baggage_cases (workflow_status);
CREATE INDEX baggage_cases_created_at_idx ON public.baggage_cases (created_at DESC);
CREATE INDEX baggage_cases_arrival_date_idx ON public.baggage_cases (arrival_date);
CREATE INDEX baggage_cases_officer_idx ON public.baggage_cases (assigned_officer_id);
CREATE INDEX baggage_cases_priority_idx ON public.baggage_cases (priority);
CREATE INDEX baggage_cases_search_idx ON public.baggage_cases
  USING gin (to_tsvector('simple',
    coalesce(pir_number,'') || ' ' || coalesce(passenger_name,'') || ' ' ||
    coalesce(flight_number,'') || ' ' || coalesce(contact_mobile,'') || ' ' || coalesce(case_no,'')));

CREATE TRIGGER baggage_cases_bump BEFORE UPDATE ON public.baggage_cases
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

GRANT SELECT ON public.baggage_cases TO authenticated;
GRANT ALL ON public.baggage_cases TO service_role;
ALTER TABLE public.baggage_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops staff read cases" ON public.baggage_cases
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Case bags ----------
CREATE TABLE public.case_bags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  bag_tag text NOT NULL,
  seq integer NOT NULL DEFAULT 1,
  weight_kg numeric(6,2),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0,
  UNIQUE (case_id, bag_tag)
);
CREATE INDEX case_bags_case_idx ON public.case_bags (case_id);
CREATE INDEX case_bags_tag_idx ON public.case_bags (bag_tag);
CREATE TRIGGER case_bags_bump BEFORE UPDATE ON public.case_bags
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

GRANT SELECT ON public.case_bags TO authenticated;
GRANT ALL ON public.case_bags TO service_role;
ALTER TABLE public.case_bags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read case bags" ON public.case_bags
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Deliveries ----------
CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_no text NOT NULL UNIQUE,
  case_id uuid NOT NULL REFERENCES public.baggage_cases(id) ON DELETE RESTRICT,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE RESTRICT,

  stage public.delivery_stage NOT NULL DEFAULT 'Ready for Delivery',
  workflow_status public.workflow_status NOT NULL DEFAULT 'READY_FOR_COLLECTION',
  priority public.case_priority NOT NULL DEFAULT 'Normal',
  delivery_type public.delivery_method NOT NULL DEFAULT 'Home Delivery',

  passenger_name text NOT NULL,
  mobile text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  dest_lat double precision,
  dest_lng double precision,

  assigned_agent_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  scheduled_for timestamptz,
  accepted_at timestamptz,
  collected_at timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  returned_at timestamptz,
  closed_at timestamptz,

  failure_reason_id uuid REFERENCES public.failure_reasons(id) ON DELETE RESTRICT,
  failure_note text NOT NULL DEFAULT '',
  attempt_no integer NOT NULL DEFAULT 1 CHECK (attempt_no > 0),

  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 0
);

-- One live delivery per case; completed/failed ones may coexist historically.
CREATE UNIQUE INDEX deliveries_one_active_per_case_idx
  ON public.deliveries (case_id)
  WHERE stage NOT IN ('Delivered','Delivery Failed','Returned to Airport');

CREATE INDEX deliveries_stage_idx ON public.deliveries (stage);
CREATE INDEX deliveries_agent_idx ON public.deliveries (assigned_agent_id);
CREATE INDEX deliveries_case_idx ON public.deliveries (case_id);
CREATE INDEX deliveries_created_at_idx ON public.deliveries (created_at DESC);
CREATE INDEX deliveries_delivered_at_idx ON public.deliveries (delivered_at DESC);
CREATE INDEX deliveries_scheduled_idx ON public.deliveries (scheduled_for);

CREATE TRIGGER deliveries_bump BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.bump_version();

GRANT SELECT ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops staff read deliveries" ON public.deliveries
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

CREATE POLICY "agents read own deliveries" ON public.deliveries
  FOR SELECT TO authenticated
  USING (assigned_agent_id IS NOT NULL AND assigned_agent_id = public.current_app_user_id());

-- Delivery Agents can read only the case behind a delivery assigned to them.
CREATE POLICY "agents read linked cases" ON public.baggage_cases
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.case_id = baggage_cases.id
      AND d.assigned_agent_id = public.current_app_user_id()
  ));

CREATE POLICY "agents read linked case bags" ON public.case_bags
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.case_id = case_bags.case_id
      AND d.assigned_agent_id = public.current_app_user_id()
  ));

-- ---------- Delivery notes (append-only) ----------
CREATE TABLE public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  author_user_id uuid,
  author_name text NOT NULL DEFAULT 'System',
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delivery_notes_delivery_idx ON public.delivery_notes (delivery_id, created_at DESC);
CREATE TRIGGER delivery_notes_immutable
  BEFORE UPDATE OR DELETE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

GRANT SELECT ON public.delivery_notes TO authenticated;
GRANT ALL ON public.delivery_notes TO service_role;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read delivery notes" ON public.delivery_notes
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Workflow events (append-only) ----------
CREATE TABLE public.workflow_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id uuid REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  from_status public.workflow_status,
  to_status public.workflow_status NOT NULL,
  from_stage public.delivery_stage,
  to_stage public.delivery_stage,
  actor_user_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_events_case_idx ON public.workflow_events (case_id, occurred_at DESC);
CREATE INDEX workflow_events_delivery_idx ON public.workflow_events (delivery_id, occurred_at DESC);
CREATE INDEX workflow_events_occurred_idx ON public.workflow_events (occurred_at DESC);
CREATE TRIGGER workflow_events_immutable
  BEFORE UPDATE OR DELETE ON public.workflow_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

GRANT SELECT ON public.workflow_events TO authenticated;
GRANT ALL ON public.workflow_events TO service_role;
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read workflow events" ON public.workflow_events
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));
CREATE POLICY "agents read own workflow events" ON public.workflow_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.id = workflow_events.delivery_id
      AND d.assigned_agent_id = public.current_app_user_id()
  ));

-- ---------- Timeline events (append-only) ----------
CREATE TABLE public.timeline_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module public.timeline_module NOT NULL,
  case_id uuid REFERENCES public.baggage_cases(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  reference text NOT NULL DEFAULT '',
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  actor_user_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX timeline_events_occurred_idx ON public.timeline_events (occurred_at DESC);
CREATE INDEX timeline_events_module_idx ON public.timeline_events (module, occurred_at DESC);
CREATE INDEX timeline_events_case_idx ON public.timeline_events (case_id, occurred_at DESC);
CREATE INDEX timeline_events_delivery_idx ON public.timeline_events (delivery_id, occurred_at DESC);
CREATE TRIGGER timeline_events_immutable
  BEFORE UPDATE OR DELETE ON public.timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

GRANT SELECT ON public.timeline_events TO authenticated;
GRANT ALL ON public.timeline_events TO service_role;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read timeline" ON public.timeline_events
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));

-- ---------- Audit events (append-only) ----------
CREATE TABLE public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text NOT NULL DEFAULT '',
  case_id uuid REFERENCES public.baggage_cases(id) ON DELETE SET NULL,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_occurred_idx ON public.audit_events (occurred_at DESC);
CREATE INDEX audit_events_actor_idx ON public.audit_events (actor_user_id, occurred_at DESC);
CREATE INDEX audit_events_entity_idx ON public.audit_events (entity_type, entity_id);
CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops staff read audit" ON public.audit_events
  FOR SELECT TO authenticated USING (public.is_ops_staff(auth.uid()));
