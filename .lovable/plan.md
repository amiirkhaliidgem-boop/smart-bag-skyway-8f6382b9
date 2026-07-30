## Verified root cause (PIR)

`deliveries` has **no** `pir_number` column, but `mapDelivery()` reads `d.pir_number` (src/lib/ops.mapping.ts:199) → always `""`. The PIR lives on `baggage_cases` (confirmed: all 7 deliveries have a valid PIR on their case, e.g. DEL-000001 → CAIE542987). So it's a mapping bug, not missing data.

## 1. PIR display (Dispatch grid + Details)

- `buildCoreSnapshot` already loads the case row; pass `pir_number` (and `case_no`) into `mapDelivery` and set `pirNumber` from the case.
- UI binding: show `pirNumber` when present, otherwise the Case ID (`BAG-xxxxx`) — same fallback L&F uses. Applied in the grid PIR column and the Delivery Details header/Overview tab.
- No temporary/synthetic values anywhere.

## 2. Remove Close action

- Drop the `Close` row button and `closeDelivery` usage from the Dispatch grid and Details page; remove `close` from `actionsForStage`. The `dm_close` RPC stays in the DB but is no longer reachable from the UI (single operational path via the Workflow Engine).

## 3–4. Merge "Delivery Failed" into "Returned to Airport"

Database migration (Workflow Engine owns the behaviour):

- `wf_stage_allowed`: remove all `Delivery Failed` paths; allow `Assigned`, `Driver Accepted`, `Collected Bag`, `Out for Delivery` → `Returned to Airport`, and `Returned to Airport` → `Ready for Delivery`.
- `wf_stage_lf` / `wf_stage_workflow`: `Returned to Airport` maps back to `Ready for Delivery` / `READY_FOR_COLLECTION`.
- Rewrite `dm_mark_returned(p_delivery, p_reason_code, p_note, p_expected_version)` to, in one transaction:
  1. record the reason/note on the delivery,
  2. `wf_transition(... 'Returned to Airport')` — journals Timeline + Audit + queues notifications + refreshes the passenger view,
  3. clear `assigned_agent_id` / `assigned_at`, expire any pending OTP,
  4. `wf_transition(... 'Ready for Delivery')` so the case genuinely re-enters the Ready queue system-wide,
  5. `wf_recompute_route(old_agent)` so the stop disappears from the Driver Portal route immediately.
- `dm_mark_failed` is retired (kept as a thin alias that calls `dm_mark_returned`, so no caller breaks).

Frontend: remove `"Delivery Failed"` from `DELIVERY_STAGES`, labels, styles, and every mapping in `src/lib/delivery/stages.ts`; update the handful of references in `store.ts`, `passenger.index.tsx`, `track-baggage.tsx`, `templates.ts`, `workflow-monitor.tsx`.

## 5. Return to Airport action placement

- **Delivery Details**: new button next to View Passenger Portal / Open Navigation, visible for stages Assigned → Out for Delivery. Opens a small dialog to pick a reason (existing `failure_reasons` list) + optional note.
- **Bulk Actions toolbar**: "Return to Airport" — one reason dialog, then the Workflow Engine processes each selected delivery sequentially; summary toast reports successes/failures.

## 6. Standardize filters

- Remove the queue chip row (All / Ready / Assigned / Out / Completed) from the Dispatch Center and the `DELIVERY_QUEUES` state, leaving Search + Stage select + Date range + Reset — identical to Lost & Found.

## 7. Validation

- SQL checks: run a return-to-airport on a test delivery and confirm stage → Ready for Delivery, `assigned_agent_id` null, OTP expired, `workflow_events` / `timeline_events` / `audit_events` / notification rows written, `agent_route_stops` no longer contains the delivery.
- UI checks via headless browser: PIR visible in grid and details, no Close button, no queue chips, bulk + single Return actions work, Driver Portal no longer lists the returned delivery.
- Typecheck + build.

### Technical notes
Files touched: `src/lib/ops.mapping.ts`, `src/lib/ops.server.ts`, `src/lib/delivery/stages.ts`, `src/lib/store.ts`, `src/routes/delivery.index.tsx`, `src/routes/delivery.$deliveryId.tsx`, plus small stage-reference edits in passenger/tracking/workflow-monitor/templates. One Supabase migration for the workflow functions.
