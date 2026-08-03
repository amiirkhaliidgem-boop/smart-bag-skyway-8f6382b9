# Production Cleanup, Missing Actions & Final Validation

Executes the approved audit findings, closes the two unreachable backend actions, strips every demo/legacy artefact, then produces a Production Readiness Report. Decisions taken: placeholders stay, parked implementations go; build the missing UI; validate notifications against the preview URL first.

## Step 1 — Make the notification pipeline actually run

- Re-point both cron jobs (`drain-notification-outbox`, `api-health-sweep`) at the stable preview URL `project--75f669c5-...-dev.lovable.app`, which serves the latest build (the production URL 404s because the app is not published).
- Change the drainer's "no transport configured" outcome from permanently failed to retryable, so the 70 queued events stay queued instead of burning to `failed` before real providers exist. Attempts are still recorded, so the outbox becomes observable.
- Verify: `notification_attempts` starts filling, `notification_events.attempt_count` increments, Notification Center and API Status show real traffic.

## Step 2 — One drain implementation (A1)

Delete `notif_claim_batch()` and `notif_record_result()` from the database and from the `ops.functions.ts` allowlist. The HTTP drainer stays the single transport worker: it already owns batching, backoff and exhaustion, and it is the only path that can call a provider.

## Step 3 — Missing operational actions

- **Mark Failed** (Dispatch Center row menu + Delivery Details console): dialog picking a reason from `failure_reasons` plus a note, calling `dm_mark_failed`. Failure reason and attempt number surface in Overview and Timeline; retry/return continues through the existing Return-to-Airport path.
- **Report Incident** (Quality Management, Reports module): dialog with category, severity, optional case/delivery link and description, calling `qm_create_incident`. New incidents appear in the incident table, Timeline and Audit like SLA-swept ones.
- Both go through the existing guarded RPC bridges — no new business logic in the frontend.

## Step 4 — Dead code and dead database objects

Frontend removals:
- `src/routes/route-tracking.tsx` (filters on legacy status strings; always empty) and `src/routes/export-center.tsx` (no backend).
- Parked implementations: `components/warehouse/storage-control-full.tsx`, `components/warehouse/qr-scan-full.tsx`, `components/io/data-io-full.tsx`, `components/contact-center/contact-center-full.tsx`. The Coming Soon placeholders and their sidebar entries stay.
- Legacy simulated notification stack: `lib/notifications/{registry,dispatch}.ts`, `lib/notifications/adapters/simulated.ts`, `lib/integrations/{sms,whatsapp,otp,odoo,maps}.ts`.
- Duplicate mapping/util modules: `lib/workflow/mapping.ts`, `lib/io/duplicate.ts`.
- Any import/export or data-io helpers left with no consumer after the above.

Backend removals (one migration, after a final usage re-check):
- `dm_close` allowlist entry (function already gone).
- `notif_claim_batch`, `notif_record_result` (Step 2).
- `lf_apply_region` (superseded by `lf_set_region`), and `qm_raise_incident` if `qm_sweep_sla` does not depend on it.
- Retained with justification: `sla_delivery_hours`, `settings_group`, `has_role`, `is_ops_staff`, `wf_ensure_case_link`, `wf_recompute_route` — all called from inside SQL, triggers or RLS.

## Step 5 — Single-source-of-truth enforcement

- Confirm every mutation path in `store.ts` and the server functions ends in a `wf_*` / `lf_*` / `dm_*` / `agent_*` RPC — no client-side status derivation, no direct table writes.
- Confirm notification rendering exists only in SQL (`wf_fill_template`, `notification_templates`); the app only transports.
- Confirm analytics exist only in `wf_status_ladder` / `wf_case_status` / `dashboard_executive` / `report_lifecycle`; remove any client-side recomputation found.
- Fold `report_operational` + `report_lifecycle` into one RPC call path and move `qm_sweep_sla()` off the report read path onto the cron sweep.
- Close the pickup-portal gap: ensure `passenger_view` (or the case branch of `passenger_get_view`) is refreshed on every Airport Pickup transition, not only delivery ones.

## Step 6 — Cross-system end-to-end validation

Walk one Home Delivery case and one Airport Pickup case through every transition, and after each one verify the same status and timestamp in: Lost & Found, Delivery Management, Driver Portal, Passenger Portal, Workflow Monitor, Activity Timeline, Dashboard, Reports, Notification Center, Quality Management, SLA monitoring, Audit Log, System Settings effects and Integration Center health. Also exercise Mark Failed and Report Incident. Any module that disagrees is a blocker, not a note.

## Step 7 — Production Readiness Report

Written to a dated file and summarised in chat, covering: architecture validation, database validation (table/function/RPC/trigger/cron/queue consumer matrix), UI↔backend integration matrix, Workflow Engine, Notification Engine, Dashboard & Reports, security scan results, performance observations, remaining risks, remaining blockers, and required actions before Go Live. The report will explicitly state that the system is **not** Production Ready while real SMS/WhatsApp/Email providers are unconfigured and the app is unpublished — those are the two known Go-Live blockers under the chosen "preview first" path.

## Technical notes

- Cron re-point and the object drops are separate SQL steps; the drops run only after the final consumer re-check in Step 4.
- Removing routes regenerates `routeTree.gen.ts` automatically; no manual edit.
- No enum values are dropped — unused `timeline_module` / `notification_state` / `incident_*` values become reachable once Steps 1 and 3 land.