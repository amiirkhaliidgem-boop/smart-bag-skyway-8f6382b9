## Goal
Make Workflow Monitor a true live board over the existing ecosystem, and remove the Station filter. UI/read-only change — no engine, schema, or write-path modifications.

## Current state (verified)
- `src/routes/workflow-monitor.tsx` already reads `useStore` (Supabase-backed, realtime-synced) — so it isn't literally demo data, but:
  - Rows are built **only** from `workflow` records, so Lost & Found cases that haven't reached Delivery never appear (that's why "Cases Waiting" and "In Storage" show 0 in the screenshot).
  - Status column renders the raw `WorkflowStatus`, not the operational `DeliveryStage` used by Delivery Management / Agent Portal, so rows can look out of sync with those modules.
  - Elapsed time is computed once per render and never ticks.
  - A `Station` filter exists and matches on substrings of the address.

## Changes (all inside `src/routes/workflow-monitor.tsx`)

1. **Unified live row model**
   - Build rows from `cases` joined to `deliveries` and `workflow` (read-only selectors from the store).
   - Include L&F cases with no delivery yet, so the pre-delivery part of the lifecycle is visible.
   - Per row, derive: case/PIR, passenger, bag tag, current stage (delivery stage when a delivery exists, otherwise the L&F/workflow status), delivery agent, last transition timestamp, next step, and feedback-submitted flag.

2. **Remove Station filter**
   - Delete the Station `Select` and its state/filter logic; grid becomes Search + Delivery Agent + Status.

3. **Status display aligned with the modules**
   - Use `DeliveryStage` labels/colors from `src/lib/delivery/stages.ts` when a delivery exists, and `LF_STATUS_LABEL`/colors from `src/lib/lost-found/statuses.ts` before hand-off, so the monitor mirrors exactly what L&F and Dispatch show.
   - Status filter options become the same unified list.

4. **Live sync + ticking elapsed**
   - Store already pushes Supabase realtime updates, so any transition (L&F create → Ready for Delivery → Assigned → Accepted → Out for Delivery → OTP Verified → Delivered → Feedback Submitted) re-renders the board automatically.
   - Add a 30s interval tick so Elapsed/SLA badges stay accurate without a manual refresh.

5. **KPIs recomputed from the unified rows**
   - Cases Waiting (L&F pre-hand-off), In Storage, Ready for Delivery, Out for Delivery, Delivered, Delayed (SLA breach), Quality Alerts, Returned — all derived from the same live rows so the numbers match the table.

## Out of scope
No changes to Workflow, Delivery, Notification, Timeline, Audit engines, the store's write paths, or the database schema. No new routes or duplicate state.
