## Goal

Enforce the system philosophy: **only the Workflow Engine creates notifications**. The Notification Center becomes a pure monitoring dashboard. Providers stay simulated — no real SMS/WhatsApp wiring in this phase.

## 1. Remove every manual send path

Delete `createTestNotification()` from `src/lib/store.ts` and all six call sites:

- `src/routes/notifications.tsx` — remove the entire "Send Test Notification" card, its form state, and the per-row **Resend** button.
- `src/routes/delivery.index.tsx` — remove the row-level **Notify** button and the bulk "Notify passengers" dialog.
- `src/routes/delivery.$deliveryId.tsx` — remove the **Notify Passenger** action button.
- `src/components/contact-center/contact-center-full.tsx` — remove the three manual send actions (file is currently unrendered behind the Coming Soon page, but is cleaned up so it can't reintroduce the pattern).
- Drop the now-unused `notify` flag from the stage-action helper in `src/lib/delivery/stages.ts`.

After this, the only writers to `state.notifications` are `enqueueNotifications()` and the send-lifecycle updater.

## 2. Move the send lifecycle into the engine

Today `queued → sending → sent` is faked with `setTimeout` inside the Notification Center component, so the log only advances while that page is open. Move it into `src/lib/store.ts`, immediately after `enqueueNotifications()` creates events, so status advances regardless of which page the operator is on. The simulated adapter path routes through `src/lib/notifications/channels.ts` (still no-op) so swapping in a real provider later is a one-file change.

`setNotificationStatus` stays exported but becomes engine/adapter-internal — no UI calls it.

## 3. Notification Center becomes read-only

Keep: KPI cards, filters, event table, bilingual message preview. Remove: send form, resend, any action column. Add a short header note stating notifications are generated automatically by the Workflow Engine and cannot be sent manually.

The **Failed** KPI stays (it will be reachable once real providers land) but no failure-triggered action button.

## 4. Close the trigger-coverage gap

Templates exist for only 5 of the workflow statuses; every other transition silently produces nothing. Add EN/AR SMS + WhatsApp templates for the remaining passenger-relevant transitions so the log reflects the real lifecycle:

- `SCHEDULED` — delivery scheduled
- `COLLECTED` — bag collected from the airport
- `DELIVERY_FAILED` — attempt failed, contact centre will follow up
- `RETURNED_TO_AIRPORT` — bag returned to airport storage

Internal-only statuses (driver accept/reject, dispatch bookkeeping) intentionally get **no** passenger template.

## Technical notes

- Email and Push remain contract-only (no templates); they stay in the channel union for the future provider phase.
- `operator` on every event will now always be `"Workflow Engine"`, making the ledger unambiguous for audit. Existing historical rows tagged with an operator name are left untouched.
- Every generated event continues to write a `notification.dispatch` audit entry.
- No schema or Supabase changes; notifications persist through the existing shared-state sync.

## Out of scope (next phase)

Real Twilio/Meta/SES credentials, delivery receipts, retry/backoff, per-passenger channel preference and opt-out.
