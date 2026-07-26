## Current state (verified)

- `src/routes/feedback.tsx` contains a manual "Submit Feedback" form (bag picker, resolved yes/no, star rating, comments, submit) calling `addFeedback()` from `src/lib/store.ts`, plus a simple "Daily Feedback Report" card list.
- `Feedback` in `src/lib/store.ts` stores only `id, bagId, passengerName, resolved, rating, comments, at` — no PIR, delivery ID, agent, airline or flight. Those must be joined at render time from `cases` and `deliveries` (same bagId), which the store already holds.
- The Passenger Portal already submits feedback: `src/routes/passenger.index.tsx` calls the `submit-feedback` action in `src/lib/passenger.functions.ts` (RPC `passenger_submit_feedback`, writing to `public.passenger_feedback`) and also records it into the store.
- Excel export pattern already exists in `src/lib/lost-found/export-xlsx.ts` (xlsx + column map), reusable for feedback.

## Changes (UI only)

**1. Remove the manual entry form** — delete the entire "Submit Feedback" card from `src/routes/feedback.tsx` (bag select, resolved selector, stars, comment box, submit button) and its local state + `addFeedback` import. Feedback becomes read-only; the page never writes.

**2. KPI row** — keep and restyle to match the Lost & Found / Dispatch KPI cards: Avg Rating, Total Responses, Resolved %, Today, plus Detractors (rating ≤ 2).

**3. Read-only feedback table** replacing the card list, columns:
Passenger · PIR · Delivery ID · Delivery Agent · Airline · Flight · Rating (stars) · Resolved · Comment · Submitted (dd/MM/yyyy HH:mm).
Values are derived per row by matching the feedback `bagId` to its Baggage Case (PIR, airline, flight) and its Delivery record (delivery ID, agent). Missing joins render as "—".

**4. Filters bar** — Search (passenger / PIR / delivery ID), Date-from / Date-to, Airline dropdown, Delivery Agent dropdown, and a Reset button — same layout/behaviour as the Lost & Found filter bar.

**5. Bulk export** — row checkboxes + the shared bulk toolbar used elsewhere, with "Export Selected" producing a formatted `.xlsx` via a new `src/lib/feedback/export-xlsx.ts` mirroring the L&F exporter and using the same column set as the table.

**6. Include already-submitted portal feedback** — the dashboard reads the store's `feedback` array (single source of truth, synced through the Workflow Engine's app state), so all portal submissions past and future appear automatically. Feedback rows written only to `public.passenger_feedback` and not present in app state will additionally be merged in as a read-only query so nothing already collected is lost.

## Not touched

Workflow, Notification, Delivery, Timeline, Audit engines; database schema; the Passenger Portal UI and its submission path; `addFeedback()` stays in the store since the portal uses it.

## Technical notes

Single route file `src/routes/feedback.tsx` plus one new export helper; no new routes, no schema migration, no writes from this page.
