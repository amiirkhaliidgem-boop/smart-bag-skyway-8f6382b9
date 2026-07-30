CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'service',
  provider text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'production',
  version text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_configured',
  config_public jsonb NOT NULL DEFAULT '{}'::jsonb,
  secrets_ciphertext text,
  secret_fields text[] NOT NULL DEFAULT '{}',
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text NOT NULL DEFAULT '',
  last_sync_at timestamptz,
  last_latency_ms integer,
  updated_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version_no integer NOT NULL DEFAULT 1
);

GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations service only" ON public.integrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER integrations_touch BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.integration_events (
  id bigserial PRIMARY KEY,
  integration_key text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  actor_user_id uuid,
  actor_name text NOT NULL DEFAULT 'System',
  latency_ms integer,
  detail text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read integration events" ON public.integration_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX integration_events_key_time_idx
  ON public.integration_events (integration_key, occurred_at DESC);

CREATE TABLE public.api_health_checks (
  id bigserial PRIMARY KEY,
  api_key text NOT NULL,
  ok boolean NOT NULL,
  latency_ms integer,
  detail text NOT NULL DEFAULT '',
  error text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'probe',
  checked_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_health_checks TO authenticated;
GRANT ALL ON public.api_health_checks TO service_role;
ALTER TABLE public.api_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read api health" ON public.api_health_checks
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX api_health_checks_key_time_idx
  ON public.api_health_checks (api_key, checked_at DESC);

INSERT INTO public.integrations (key, name, category, provider, version, sort_order, config_public, secret_fields)
VALUES
  ('google_maps', 'Google Maps Platform', 'maps', 'Google', 'v1', 10,
   '{"directions":true,"distance_matrix":true,"geocoding":true,"places":false}'::jsonb, '{api_key}'),
  ('sms_gateway', 'SMS Gateway', 'messaging', '', 'v1', 20,
   '{"api_url":"","sender_id":""}'::jsonb, '{api_key,api_secret}'),
  ('whatsapp', 'WhatsApp Business', 'messaging', 'Meta Cloud API', 'v20.0', 30,
   '{"phone_number_id":"","business_account_id":"","webhook_url":""}'::jsonb, '{access_token,verify_token}'),
  ('email', 'Email Provider', 'messaging', 'SMTP', 'v1', 40,
   '{"host":"","port":587,"secure":true,"username":"","from_address":"","from_name":"IAB Baggage"}'::jsonb, '{password}'),
  ('odoo', 'Odoo ERP', 'erp', 'Odoo', 'v17', 50,
   '{"base_url":"","database":"","username":""}'::jsonb, '{api_key}'),
  ('mobile_platform', 'Mobile Platform', 'platform', 'IAB Mobile', 'v1', 60,
   '{"ios_bundle_id":"","android_package":"","min_supported_version":"","force_update":false,"push_provider":""}'::jsonb, '{push_server_key}'),
  ('cloud_database', 'Cloud Database', 'infrastructure', 'Supabase (PostgreSQL)', 'v15', 70,
   '{"realtime":true,"storage":true,"managed":true}'::jsonb, '{}');