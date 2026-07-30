## What I verified first

Read `catalog.ts`, `probes.server.ts`, `integrations.server.ts`, `system.functions.ts`, `integrations.tsx`, `api-status.tsx`, `notifications/registry.ts`, and queried the live `integrations` and `api_health_checks` tables.

Confirmed current state:
- All 7 internal APIs have real heartbeat samples (`ok = true`, source `sweep`), `database` has real samples from the managed probe. These are genuine.
- All 6 external slots have `secrets_ciphertext = NULL`, `status = 'disabled'`.
- `odoo` has `enabled = true` while completely unconfigured — an enable switch can turn on a slot with no credentials.
- `email` and `mobile_platform` carry `last_error = "Missing configuration: ..."` while displaying as *Disabled*, not *Not configured*.

## Real placeholder behavior still present

1. **Mobile Platform "probe" is not a probe.** `probeMobilePlatform()` in `probes.server.ts` returns `ok: true` purely because three text fields are non-empty. No network call, no provider. It can report *Operational* with zero real connection.
2. **Email probe never authenticates.** It opens a TCP socket and accepts any `220` banner — it ignores username/password/TLS entirely. A wrong password still reports *Connected*.
3. **Sweep marks slots "configured" from plain text fields.** `runHealthSweep()` treats a slot as probeable when its non-secret fields are filled, which is what lets Mobile Platform be probed and pass.
4. **Hardcoded database facts.** `getSystemCenter()` returns `backup: "Managed daily backups (platform)"` as a literal string, and `realtime`/`storage` read from `config_public` flags that nobody sets from real platform state.
5. **Hardcoded version fallback.** API Status shows `v1` for any internal API with no version row.
6. **Enable-without-credentials.** `setIntegrationEnabled` allows enabling an unconfigured slot (why `odoo` is currently enabled), and `status` mapping produces *Disabled* rather than *Not configured* for slots that were never configured.
7. **Notification transport is still simulated.** `notifications/registry.ts` registers `simulatedAdapters` for sms/whatsapp; the configured adapter is only used when credentials exist. The Notification API therefore reports healthy while nothing real is sent.

## Fixes

**Probes (`probes.server.ts`)**
- Replace `probeMobilePlatform` with a real check: require a push provider + push server key and validate the credential against FCM (`https://fcm.googleapis.com/...` auth check). With no push credential, return a non-probeable result so the slot stays *Not configured* rather than pretending success.
- Upgrade `probeEmail` to a real SMTP handshake: `EHLO`, optional `STARTTLS`, then `AUTH LOGIN` with the stored username/password, reporting the server's actual response code. Missing credentials → not configured, wrong credentials → error.
- Add a `notProbeable` outcome to `ProbeResult` so "not set up" is distinct from "failed".

**Service layer (`integrations.server.ts`)**
- Gate sweeps and status on genuine configuration: a slot is probeable only when every `required` field (including secrets) is present. Drop the "all plain fields filled" shortcut.
- Never write a health sample or `error` status for a non-probeable slot; leave it `not_configured`.
- `setIntegrationEnabled`: refuse to enable a slot whose required fields are incomplete, with a clear message.
- Status mapping: slots with no stored credentials read `not_configured` (not `disabled`), and clear their stale `last_error` on disconnect.
- Database card: derive `realtime` from `pg_publication_tables` for `supabase_realtime`, `storage` from an actual storage-bucket probe, and replace the literal backup string with "Managed by platform" only when the ping succeeds — otherwise "Unknown". No invented values.
- Version: return the real `integrations.version` value; when absent, `—` instead of `v1`.

**UI (`integrations.tsx`, `api-status.tsx`)**
- Unconfigured slots: show *Not configured*, hide the Test button (or disable it with "Configure credentials first"), show `Latency —`, `Last success —`.
- API Status: external APIs with no genuine configuration render *Not configured* with dashes, never Degraded/Down.
- Remove the "AES-256-GCM" hardcoded stat card claim in favour of a factual count of slots holding encrypted credentials.

**Notification honesty (minimal, health-only)**
- The Notification API card gains a real qualifier: when no SMS/WhatsApp provider is configured, its health detail states "internal queue healthy — no live transport configured". No change to the notification engine or Notification Center UI in this task.

## Verification

After the changes I'll run a sweep and read `api_health_checks` + `integrations` back from the database, confirming: 7 internal APIs Operational with real latencies, all 6 external slots *Not configured* with no samples, `odoo` no longer enabled, and no row carrying a fabricated success.

## Technical notes

Files touched: `src/lib/system/probes.server.ts`, `src/lib/system/integrations.server.ts`, `src/lib/system/catalog.ts` (add push-provider requirement flags), `src/routes/integrations.tsx`, `src/routes/api-status.tsx`, plus one small migration to reset `odoo.enabled` and clear stale `last_error` on unconfigured slots. No schema changes.
