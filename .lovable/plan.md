# System Architecture Validation & End-to-End Integration Audit

Analysis only — no code, schema, or UI was changed. Every claim below was verified this turn by reading source files or querying the production database.

## Critical Issues

### C1 — The scheduled workers are dead: nothing is ever sent
- Location: `cron.job` (`drain-notification-outbox` every 2 min, `api-health-sweep` every 5 min) posting to `https://project--75f669c5-...lovable.app/api/public/...`
- Root cause: the app has never been published, so both URLs return **404** (confirmed in `net._http_response` — every response in the last hours is 404 HTML).
- Impact: **70 notification events sit in `queued`** with `attempt_count = 0`, `notification_attempts` is empty, no passenger has ever received an SMS/WhatsApp. API Status samples come only from manual probes.
- Fix: publish the app (or repoint both cron jobs at the stable `-dev` preview URL for pre-go-live testing), then confirm rows leave `queued`.
- Priority: Critical

### C2 — No transport is configured for any channel
- Location: `public.integrations` — only `cloud_database` is enabled; `sms_gateway`, `whatsapp`, `email`, `google_maps`, `odoo`, `mobile_platform` are all `not_configured`.
- Root cause: configuration, not code. `adapterFor()` in `drain.ts` returns `null` and marks the event permanently `failed` (`retryable: false`) on the first attempt.
- Impact: once C1 is fixed, all 70 queued events flip straight to `failed` on the first pass instead of sending.
- Fix: configure SMS/WhatsApp/Email in the Integration Center before draining; consider making "no transport" non-exhausting so events stay retryable.
- Priority: Critical

### C3 — `dm_close` is allowlisted but does not exist
- Location: `src/lib/ops.functions.ts` allowlist; no `public.dm_close` in `pg_proc` (verified).
- Root cause: the function was dropped when "Closed" was retired; the client allowlist entry was left behind.
- Impact: dead entry in the guarded RPC bridge; any caller gets a runtime PostgREST error instead of a clean rejection.
- Fix: remove from the allowlist.
- Priority: High

## Architecture Mismatches

### A1 — Two independent notification-drain implementations
- Location: `public.notif_claim_batch()` / `notif_record_result()` (SQL, allowlisted in `ops.functions.ts`) vs `src/routes/api/public/notifications/drain.ts`, which claims and updates `notification_events` directly with the admin client.
- Impact: duplicate business rules (batch size, retry/backoff, exhaustion) in two places; the SQL pair is never called.
- Fix: pick one — either the drainer calls the RPCs, or drop the RPCs from the allowlist and from the database.
- Priority: High

### A2 — Legacy in-app notification stack shadows the DB engine
- Location: `src/lib/notifications/registry.ts`, `dispatch.ts`, `adapters/simulated.ts`, `src/lib/integrations/{sms,whatsapp,otp,odoo,maps}.ts` — all have **zero importers** (verified).
- Impact: a second, simulated "notification engine" still exists next to the real DB-queued one; a future edit could reintroduce fake sends.
- Fix: delete, keeping only `channels.ts` and the `adapters/{configured,twilio}.server.ts` used by the drainer.
- Priority: Medium

### A3 — `src/lib/workflow/mapping.ts` is a second status-mapping source
- Location: file has no importers; the live mappings are `src/lib/lost-found/statuses.ts`, `src/lib/delivery/stages.ts`, and SQL (`wf_lf_workflow`, `wf_stage_workflow`, `wf_case_status`).
- Impact: duplicate status definitions — exactly the drift the single-engine rule forbids.
- Fix: delete.
- Priority: Medium

## Backend Objects Without Frontend

| Object | Status | Note |
|---|---|---|
| `dm_mark_failed()` | allowlisted, **no UI caller** | Dispatch Center has Return-to-Airport but no "Mark Failed"; `failure_reasons` (9 rows) is only half-used |
| `qm_create_incident()` | allowlisted, **no UI caller** | incidents can only appear via `qm_sweep_sla`; `quality_incidents` has **0 rows** |
| `qm_raise_incident()` | not allowlisted, no caller | internal-only or dead |
| `lf_apply_region()` | no caller | the UI uses `lf_set_region` |
| `sla_delivery_hours()`, `settings_group()`, `has_role()`, `is_ops_staff()` | no direct client caller | used inside SQL/RLS — verify before removal |
| `notif_claim_batch`, `notif_record_result` | see A1 | |
| `delivery_notes` table | **0 rows** | `dm_add_note` is wired in `store.ts` but the feature is unexercised |
| Enum values never observed: `timeline_module` = `workflow`, `agent_portal`, `passenger_portal`, `quality`, `admin`; `notification_state` = `sending/sent/failed/cancelled`; the `incident_*` enums | | consequence of C1/C2 and missing UI, not necessarily dead |
| Templates `DELIVERY_APPROVED`, `DELIVERY_FAILED`, `RETURNED_TO_AIRPORT` | exist, never queued | reachable only through paths never exercised in production data |

## Frontend Without Backend / Unreachable UI

- `src/routes/route-tracking.tsx` — filters deliveries on legacy strings `"Picked Up"`, `"Out For Delivery"`, `"Assigned"`, which are **not** canonical `delivery_stage` values. Always renders empty, and it is not in the sidebar. Priority: High (delete or rewrite).
- `src/routes/export-center.tsx` — static module list, no backend, not in the sidebar. Dead. Priority: Medium.
- `src/routes/storage.tsx`, `qr-scan.tsx`, `data-io.tsx`, `contact-center.tsx` — intentional "Coming Soon" shells with full implementations parked beside them (`warehouse/*-full.tsx`, `io/data-io-full.tsx`, `contact-center-full.tsx`). The sidebar still links Storage Control, QR Scan and Contact Center to placeholders. Priority: Low (intentional).
- `src/lib/io/duplicate.ts` — no importers. Priority: Low.

## Workflow Validation

Verified healthy: every transition runs through SQL (`lf_set_status`, `wf_transition`, `dm_*`, `agent_*`), all of which call `wf_journal`, producing `timeline_events` (48 lost_found + 61 delivery), `audit_events` (124), `workflow_events` (110) and `wf_queue_notification*`. Dashboard and Reports read the same ladder (`wf_status_ladder` / `wf_case_status`). No module keeps an independent status; `store.ts` is a read-through projection.

Gaps:
1. The Notification leg of every transition stops at `queued` (C1/C2) — complete in the database, never reaching the passenger.
2. `passenger_view` holds **9** rows for **11** cases: the 2 Airport Pickup cases have no projection row and depend on `passenger_get_view` reading the case branch directly. Confirm the pickup portal path is refreshed on every transition, not only delivery ones.
3. The failure branch (`Delivery Failed` → retry/return) has no dispatcher entry point (`dm_mark_failed`), so half of that lifecycle is unreachable from the UI.

## Dashboard & Reports

Healthy after the last refactor: one analytics layer (`wf_status_ladder`, `wf_case_status`) feeds `dashboard_executive`, `report_operational` and `report_lifecycle`. Current data: 9 Delivered (Home Delivery) and 2 Passenger Picked Up (Airport Pickup); no cumulative-count leaks found. Caveat: `report_operational` and `report_lifecycle` are two RPCs merged client-side in `reports.server.ts` — one RPC would remove a round trip and a merge rule.

## Performance Opportunities

- Reports issues 2 RPC round trips per filter change; Dashboard 1. Merge or cache.
- `reports.server.ts` calls `qm_sweep_sla()` on every report load — a write on a read path. Move it to the cron sweep.
- Largest client files (`passenger.index.tsx` 1560 lines, `timeline.tsx` 1293, `store.ts` 1176) ship whole; timeline and reports are lazy-route candidates.

## Cleanup Opportunities (safe, in dependency order)

1. `dm_close` allowlist entry (C3).
2. Unimported modules: `lib/integrations/{sms,whatsapp,otp,odoo,maps}.ts`, `lib/notifications/{registry,dispatch,adapters/simulated}.ts`, `lib/workflow/mapping.ts`, `lib/io/duplicate.ts`.
3. `routes/route-tracking.tsx`, `routes/export-center.tsx`.
4. After A1 is decided: drop `notif_claim_batch` / `notif_record_result`, or the duplicate drain logic.

## Recommended Order of Work

1. C1 publish and re-point cron, then C2 configure a real SMS/WhatsApp provider — nothing else in the notification chain can be validated until then.
2. C3 and A1 (one drain implementation).
3. Add the missing UI for `dm_mark_failed` and `qm_create_incident`, or drop them deliberately.
4. Dead-code sweep (Cleanup 2–4).
5. Performance items.