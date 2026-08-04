# Production Readiness Report

Scope: full system audit follow-up — dead code removal, single source of truth
verification, and activation of the background workers.

## 1. Notification pipeline (was Critical C1/C2)

| Item | Before | After |
| --- | --- | --- |
| Scheduled drain worker | 404 — pointed at an unpublished production URL | 200 — repointed at the stable preview URL |
| Health sweep worker | 404 | 200, writing `api_health_checks` |
| SLA breach sweep | not scheduled at all | runs every 15 minutes (`qm_sweep_sla`) |
| Unconfigured channel | event marked `failed` permanently | event stays `queued` and retries once a transport is connected |

Verified live: `{"claimed":20,"sent":0,"failed":0,"skipped":20}` every 2 minutes.
The 63 historical events are intact and will send the moment SMS / WhatsApp /
Email credentials are entered in the Integration Center — nothing was lost and
nothing is burning retry budget.

## 2. Single drain implementation

`src/routes/api/public/notifications/drain.ts` is now the only writer to
`notification_events`. The SQL-side claim/record helpers
(`notif_claim_batch`, `notif_record_result`) were dropped, so there is exactly
one outbox worker.

## 3. Missing operational actions — now built

- **Mark Delivery Failed.** `dm_mark_failed` was a silent alias of
  `dm_mark_returned`, so the `Delivery Failed` stage was unreachable. It is now
  a real transition: records the reason, counts the attempt, expires the
  one-time code, raises a quality incident, and queues the passenger message.
  Exposed in the Dispatch Center row actions and the Delivery console
  (`Out for Delivery` only), with `Reschedule` and `Return to Airport` as the
  two exits.
- **Report Incident.** `qm_create_incident` had no caller. Quality Management
  now has a "Report Incident" dialog (category, severity, description) for
  incidents the engine cannot detect automatically.

## 4. Removed code

Screens with no route or navigation: `route-tracking`, `export-center`.
Parked implementations behind "coming soon" pages: `storage-control-full`,
`qr-scan-full`, `data-io-full`, `contact-center-full`.
Legacy simulated notification stack: `notifications/registry`,
`notifications/dispatch`, `notifications/adapters/simulated`, and the
`integrations/{sms,whatsapp,otp,odoo,maps}` stubs.
Database: `notif_claim_batch`, `notif_record_result`, `lf_apply_region`.
Stale entries removed from the RBAC matrix and the admin module map.

Corrections to the earlier audit: `workflow/mapping.ts`, `io/duplicate.ts` and
`qm_raise_incident` are **not** dead — they are reached through relative
imports and from `qm_sweep_sla` respectively, and were kept.

## 5. Single source of truth — verified

- Every case and delivery state change in `src/lib/store.ts` goes through a
  guarded Workflow Engine RPC; no module writes `baggage_cases`, `deliveries`,
  `workflow_events`, `timeline_events` or `audit_events` directly.
- Timeline, Audit, Notifications and Quality are all written inside those
  RPCs, so no screen can produce a state the other modules cannot see.
- Analytics derive status from `wf_case_status()` / `wf_status_ladder()` only.

## 6. Remaining before go-live

1. Enter live SMS / WhatsApp / Email credentials in the Integration Center —
   the outbox drains automatically once a transport exists.
2. Publish the app, then repoint the two workers from the `-dev` preview URL to
   the production URL.

## 7. Workflow verification — PIR number is optional (UAT finding, 2026-08-04)

**Symptom.** Moving BAG-000022 from *Waiting Customs Clearance* to *Ready for
Delivery* failed with
`null value in column "pir_number" of relation "passenger_view" violates not-null constraint`.

**Root cause.** The hand-off chain is
`lf_set_status` → `wf_open_delivery` → `wf_refresh_passenger_view`. The last
function copied `baggage_cases.pir_number` straight into the `NOT NULL`
`passenger_view.pir_number` column. PIR became optional by business rule, but
this projection was never updated, so every PIR-less case (3 of 16) aborted the
whole transition. The read path `passenger_get_view` already carried the
fallback — only the write path did not. The transition itself is valid:
`lf_allowed_statuses('Home Delivery')` includes *Ready for Delivery* and there
is no step-ordering rule, so no workflow transition is missing.

**Resolution — one canonical operational reference.**
`operational_reference = coalesce(nullif(pir_number,''), case_no)`. The
`NOT NULL` constraint is kept (a reference must always exist); the fallback is
applied wherever the reference is written or rendered.

- Database: `wf_refresh_passenger_view`, `wf_open_delivery` (journal title) and
  `wf_journal` (timeline/audit `reference`) now emit the fallback;
  `wf_open_delivery` also refreshes the projection when re-entered on an
  existing delivery. Existing `passenger_view` rows were backfilled.
  `lf_set_status`, `lf_update_case`, `passenger_get_view`, `qm_raise_incident`,
  `qm_sweep_sla`, `report_operational`, `wf_queue_case_notification`,
  `wf_queue_notification_key`, `wf_journal_event` and `wf_journal_public`
  already used it.
- Application: `operationalRef()` in `src/lib/ops.mapping.ts`; case mapping and
  the timeline projection fall back to the BAG number; Tracking resolves BAG ID
  before PIR; Driver and Passenger portals label the value "Ref"/"Reference";
  `addCase` identifies the created case by BAG number instead of PIR.

**Verified.** Hand-off re-run on BAG-000022 (no PIR) → DEL-000013 created,
`passenger_view.pir_number = BAG-000022`, timeline/audit written, passenger link
issued. `SELECT count(*)` of projection rows disagreeing with the case reference
returns 0. Cases with a PIR are unchanged.
