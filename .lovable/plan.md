## Goal

Turn the System module (Integrations + API Status) into one backend-driven subsystem: administrators configure real credentials in the UI, connections are tested against the real providers, and API Status shows live health recorded from those checks and from actual runtime calls. No demo cards, no hardcoded statuses.

## 1. Database (new tables, admin-only)

**`integrations`** — one row per provider slot, seeded by migration (no UI-created cards):
- `key` (google_maps, sms_gateway, whatsapp, email, odoo, mobile_platform, cloud_database)
- `name`, `provider` (selected provider, e.g. Twilio/Infobip/SMTP), `environment` (development/testing/production), `version`
- `enabled`, `status` (not_configured / connected / error / disabled)
- `config_public` jsonb (non-secret settings: endpoints, sender ID, feature toggles, phone number IDs)
- `secrets_ciphertext` text (AES-256-GCM encrypted blob of API keys/tokens/passwords)
- `last_success_at`, `last_failure_at`, `last_error`, `last_sync_at`, `updated_by`, timestamps, `version`

**`integration_events`** — append-only log of every configure / test / enable / disable / rotate / sync, with actor, outcome, latency, error text. Powers "synchronization logs".

**`api_health_checks`** — rolling health samples per API key (`workflow`, `notification`, `passenger`, `driver`, `database`, `google_maps`, `sms`, `whatsapp`, `email`, `odoo`), with `ok`, `latency_ms`, `error`, `checked_at`. Aggregated for uptime / error count / success rate.

RLS: no anon/authenticated access to `integrations` (secrets never leave the server). Reads/writes go only through server functions using the service-role client after an admin check. `integration_events` and `api_health_checks` readable by staff with Administration access.

## 2. Secret handling

- Secrets are encrypted server-side with AES-256-GCM before insert; the key is a generated project secret (`INTEGRATION_CONFIG_SECRET`).
- Server functions return only masked previews (`sk_live_••••4821`) plus which fields are set — never plaintext.
- "Rotate credentials" replaces the ciphertext and logs the event; old values are never displayed.

## 3. Server layer

`src/lib/integrations/*.server.ts` + `integrations.functions.ts`, all guarded by the existing `assertAdmin` (Administration → Manage):
- `listIntegrations` — masked config + status + last success/failure/error + environment/version/provider.
- `saveIntegration` — validates with Zod per provider schema, encrypts secrets, records an event.
- `testIntegration` — performs a **real** provider call and stores the outcome:
  - Google Maps → Geocoding/Distance Matrix ping with the stored key
  - SMS → provider-specific auth/balance endpoint (Twilio, Infobip, Vodafone/Orange/Etisalat/Custom REST via configured URL); optional real test SMS to a supplied number
  - WhatsApp Cloud API → `GET /{phone_number_id}` with the access token
  - Email → SMTP verification via the configured host/port/credentials (falls back to API-provider auth check)
  - Odoo → `/web/session/authenticate` (or JSON-RPC `version`) against base URL + db + user + key
  - Cloud Database → Supabase round-trip (query latency, realtime, storage, last backup info where exposed)
- `setIntegrationEnabled`, `disconnectIntegration` (clears ciphertext, sets `not_configured`), `rotateIntegrationSecret`, `syncIntegrationNow`, `listIntegrationEvents`.
- `getApiHealth` — aggregates `api_health_checks` into status/latency/uptime/error count/success rate/last heartbeat per API.
- Runtime calls (notification dispatch, maps, OTP-free workflow paths) record a health sample on every real send, so status reflects production traffic, not only manual tests.
- Notification registry reads live SMS/WhatsApp/Email config from the DB instead of hardcoded simulated adapters, so entering production credentials switches transport with no code change.

## 4. Integrations page (`/integrations`)

Rewrite as the Integration Management Center. Each card shows real status chip, provider name, environment, version, last successful connection, last failed connection and error message. Actions: **Configure**, **Test Connection**, **Enable/Disable**, **Sync now**, **Disconnect**, **View logs**.

Configure opens a per-integration dialog with the real fields:
- **Google Maps** — API key + toggles for Directions, Distance Matrix, Geocoding, Places
- **SMS Gateway** — provider selector (Twilio, Infobip, Vodafone Business, Orange Business, Etisalat Business, Custom REST API), API URL, API key/secret, Sender ID, Send test SMS
- **WhatsApp Business** — Cloud API phone number ID, business account ID, access token, webhook URL (read-only, generated), Verify Connection
- **Email** — SMTP host/port/security/user/password/from address, send test email
- **Odoo ERP** — base URL, database, username, API key, Test
- **Mobile Platform** (renames "Delivery Agent Mobile App") — app package/bundle IDs, minimum supported version, push credentials, force-update flag
- **Cloud Database** — read-only panel: connected, provider, environment, database, realtime, storage, backup status, connection health, performance, View details

**OTP Provider card is removed** (OTP is internal to the Workflow Engine).

Every dialog: Save + Test with inline validation and clear provider error messages.

## 5. API Status page (`/api-status`)

Monitoring only — no configuration actions. Live cards for Workflow, Notification, Passenger, Driver, Database, Google Maps, SMS, WhatsApp, Email and Odoo APIs, each showing status, version, latency, last heartbeat, last successful call, last failed call, uptime %, error count and success rate — all from `api_health_checks`. Auto-refresh via polling plus a "Run health check now" (admin-only) that executes the checks server-side.

A `/api/public/health/sweep` server route (secret-protected) lets a scheduler run periodic heartbeats after deployment.

## 6. RBAC

Configure / Test / Enable / Disable / Disconnect / Rotate / Sync are all gated by `assertAdmin` on the server **and** hidden in the UI for non-admins. Both routes stay admin-only in `src/lib/rbac.ts`; API Status stays read-only for admins who can view it.

## 7. Validation

Verify with SQL that saved config round-trips encrypted, that test results write `last_success_at` / `last_failure_at` / `last_error`, that a non-admin session is rejected by every mutation, and that no secret value appears in any client payload. Run typecheck and a production build.
