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
