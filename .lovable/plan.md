# PIR-optional fix: `passenger_view` NOT NULL failure at "Ready for Delivery"

## What actually happened

Changing a case to **Ready for Delivery** runs `lf_set_status` -> `wf_open_delivery` -> `wf_refresh_passenger_view`.
That last function copies `baggage_cases.pir_number` straight into `passenger_view.pir_number`, which is
declared `NOT NULL`. Case BAG-000022 has no PIR, so the insert aborts and the whole transition rolls back.

Confirmed by reading the live function bodies and the column definition:

- `passenger_view.pir_number` is `NOT NULL` (checked in `information_schema`).
- `wf_refresh_passenger_view` selects `c.pir_number` with no fallback.
- The sibling read path `passenger_get_view` already falls back with
  `coalesce(nullif(pir_number,''), case_no)` on the pickup branch — so the projection was simply never
  updated when PIR became optional. This is a missed projection, not a wrong constraint.
- 3 of 16 existing cases have no PIR, so this blocks handover for every one of them.

## Is the transition itself valid?

Yes. `lf_set_status` validates against `lf_allowed_statuses(delivery_method)`, which for Home Delivery
includes `Ready for Delivery`; there is no step-by-step ordering rule. "Waiting Customs Clearance ->
Ready for Delivery" is a legal move. No transition is missing — the failure was purely the projection write.

## The fix: one canonical operational reference

Rule: `operational_reference = coalesce(nullif(pir_number,''), case_no)` (BAG number). The `NOT NULL`
constraint stays — it is correct, because a reference must always exist. We guarantee it by always
writing the fallback, never a bare `pir_number`.

### Database (single migration)

1. `wf_refresh_passenger_view` — write `coalesce(nullif(c.pir_number,''), c.case_no)` into `pir_number`.
2. `wf_open_delivery` — journal title uses the same fallback instead of raw `c.pir_number`.
3. Apply the same expression in the remaining functions that still reference `pir_number` bare where it
   feeds a display/reference string: `lf_create_case`, `wf_journal`, `wf_journal_event`,
   `wf_journal_public`.
   (`lf_set_status`, `lf_update_case`, `passenger_get_view`, `qm_raise_incident`, `qm_sweep_sla`,
   `report_operational`, `wf_queue_case_notification`, `wf_queue_notification_key` already do it.)
4. Backfill existing `passenger_view` rows whose `pir_number` drifted from the case reference.

### Application layer

Add one shared helper (`operationalRef(pirNumber, bagId)`) and use it wherever a case/delivery reference
is rendered, so no screen shows a blank PIR:

- `src/lib/ops.mapping.ts` — map cases with the fallback (deliveries already do this).
- `src/routes/timeline.tsx`, `src/routes/workflow-monitor.tsx`, `src/routes/driver-portal.tsx`,
  `src/routes/passenger.index.tsx`, `src/lib/tracking/resolve.ts` (match on BAG number too),
  `src/lib/notifications/templates.ts` (label reads "Ref" instead of "PIR" when falling back).
- Delivery Dispatch and Delivery Details already fall back to `bagId`; leave them as-is.

Reports, Dashboard and Contact Center read through the same RPCs and projections, so they inherit the fix.

## Verification

- Re-run the failing transition on BAG-000022 (no PIR) and on a case that has a PIR; confirm the delivery
  record, `passenger_view` row, timeline, audit and notification queue are all created.
- Walk both branches end to end: Home Delivery through Delivered, and Airport Pickup through
  Passenger Picked Up — with and without a PIR.
- Authenticated sweep of Lost & Found, Delivery, Workflow Monitor, Timeline, Reports, Driver Portal
  and Passenger Portal for a no-PIR case.
- Append the finding, root cause and resolution to the Workflow Verification section of
  `docs/production-readiness.md`.