# Lost & Found — Airport Pickup vs Home Delivery (Workflow Engine Split)

## 1. Why one case became "Closed" (confirmed)

Case BAG-000001 (PIR CAIE542987) is the only Closed case. Its audit trail shows:

```text
2026-07-29 08:57  delivery.transition  driver   "Verified with passenger code"  -> Delivered
2026-07-30 07:02  delivery.close       admin                                    -> Closed
```

No cron job, trigger, or SLA sweep produced it. It was an explicit call to the
database function `dm_close(delivery)`, which sets `lf_status = 'Closed'`,
`workflow_status = 'CLOSED'` and stamps `closed_at`. That function is still
reachable from the app's RPC allowlist (`src/lib/ops.functions.ts`), even though
no button calls it today. All other completed cases stopped at Delivered because
nobody invoked it on them.

Fix: remove `dm_close` from the operational path entirely — drop it from the RPC
allowlist, drop the function, and roll BAG-000001 back to Delivered (clearing
`closed_at`) so no user-visible Closed status remains. `CLOSED` stays only as a
legacy enum value that nothing writes and no screen renders.

## 2. Two first-class operational paths

Home Delivery (unchanged):
```text
Open -> Tracing -> Located -> Arrived at Airport -> Waiting Customs Clearance
     -> Ready for Delivery -> [Delivery Management] -> Out for Delivery -> Delivered
```

Airport Pickup (new):
```text
Open -> Tracing -> Located -> Arrived at Airport -> Waiting Customs Clearance
     -> Ready for Airport Pickup -> Passenger Picked Up
```
No region, no address, no delivery record, no agent, no route, no Delivery
Management, no Agent Portal.

## 3. Database changes (single source of truth)

- Extend `lf_status` enum with `Ready for Airport Pickup` and `Passenger Picked Up`.
- Extend `workflow_status` enum with `READY_FOR_AIRPORT_PICKUP` and `PASSENGER_PICKED_UP`.
- New function `lf_allowed_statuses(delivery_method)` returning the valid list per
  path; `lf_set_status` validates against it, so a Home Delivery case can never
  reach a pickup status and vice versa.
- `lf_set_status` branches at the terminal step:
  - Home Delivery + `Ready for Delivery` -> `wf_open_delivery()` (unchanged handover).
  - Airport Pickup -> never calls `wf_open_delivery`; `Ready for Airport Pickup`
    and `Passenger Picked Up` are set directly on the case, journalled through
    `wf_journal` (timeline + audit + workflow history as today), and
    `Passenger Picked Up` stamps `resolved_at`.
- `wf_lf_workflow()` maps the two new statuses to the two new workflow statuses.
- Airport Pickup cases still get a passenger link/token so the Passenger Portal
  works without a delivery row (new `wf_ensure_case_link(case)` mirroring the
  delivery variant; `passenger_view` gains case-only rows).
- Guard: dropping/blocking `dm_close`, and a check that Airport Pickup cases can
  never have a `deliveries` row created.
- Data migration: existing cases keep their current values; BAG-000001 -> Delivered.

## 4. Notifications

Two new template trigger keys seeded bilingually for sms / whatsapp / email:
`READY_FOR_AIRPORT_PICKUP` and `PASSENGER_PICKED_UP`, queued by the same
`wf_queue_notification_key` path used by delivery statuses, with case-level
runtime context (PIR, bag tag, flight, terminal, contact info from settings).
Editable in System Settings > Notification Templates like the rest.

## 5. Application changes

- `src/lib/lost-found/statuses.ts`: add both statuses, colors, labels, the
  workflow mapping, and per-method owned-status lists; remove Closed from all
  user-facing lists.
- PIR Wizard (`pir-wizard.tsx`): when Delivery Method = Airport Pickup, hide
  Region and Full Address and their validation; show a pickup summary instead.
- L&F list + details: status stepper renders the branch matching the case's
  delivery method; Airport Pickup cases show Advance -> Ready for Airport Pickup
  -> Passenger Picked Up and never show the Delivery handover banner.
- Filters/search: both new statuses selectable; Closed removed.
- Delivery Dispatch Center: unchanged, and never receives pickup cases.
- Dashboard, Workflow Monitor, Timeline, Reports/KPIs, Quality: map the new
  statuses (completed = Delivered OR Passenger Picked Up; ready = Ready for
  Delivery OR Ready for Airport Pickup) so counts stay correct.
- Passenger Portal: pickup cases show the pickup journey (counter/terminal
  instructions, no driver, no OTP card, no route).
- SLA: pickup cases use the Lost & Found SLA only; regional delivery SLA is not
  applied to them.

## 6. Validation

Create one Home Delivery case and one Airport Pickup case and walk both to
completion, checking after each transition that the database row, workflow
history, timeline, audit log, dashboard, workflow monitor, reports and
notification queue all agree, and that the pickup case creates no delivery,
agent, or route records.

## Technical notes

- Enum additions require their own migration step before the functions that
  reference them (Postgres cannot use a new enum value in the same transaction).
- `src/integrations/supabase/types.ts` regenerates after the migrations; app
  edits land afterwards.
