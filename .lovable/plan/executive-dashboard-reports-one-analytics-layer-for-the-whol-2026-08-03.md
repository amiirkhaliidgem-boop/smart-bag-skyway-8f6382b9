# Executive Dashboard & Reports — one analytics layer for the whole ecosystem

Today the analytics SQL treats "completed" as "delivered by a driver" and counts several KPIs cumulatively. This plan rebuilds the analytics layer around the current workflow status of every case, so Home Delivery and Airport Pickup are equal citizens.

## What is wrong today (verified)

- `dashboard_executive()` counts **Located Bags** as "Located *or any later status*", which is why it reads 11 while no case is actually in Located.
- **Baggage Status Distribution** groups the cases table by current status and returns only statuses that exist, so today it shows just Delivered and Passenger Picked Up instead of the full lifecycle.
- **Current Pipeline by Stage** in Reports groups the deliveries table only. Airport Pickup cases never create a delivery record, so they are structurally invisible in that pipeline.
- Reports' delivery success, SLA, avg-hours and trends are all computed from deliveries only.

## 1. One canonical status ladder

Define the operational lifecycle once, in SQL, and reuse it everywhere:

```text
Open → Tracing → Located → Arrived at Airport → Waiting Customs Clearance
   → Ready for Delivery → Out for Delivery → Delivered
   → (Returned to Airport)
   → Ready for Airport Pickup → Passenger Picked Up
```

A helper returns this ordered list so every KPI, chart and report iterates the same set and always emits a row per status, including zeros.

## 2. Executive Dashboard KPI cards

Cards become current-status counts (each case counted in exactly one bucket, no cumulative sets):

Total Bags · Open Cases · Located Bags · Arrived at Airport · Waiting Customs Clearance · Ready for Delivery · Out for Delivery · Returned to Airport · Ready for Airport Pickup · Passenger Picked Up · Delivered · Delivery Success % · Airport Pickup Success % · Open Incidents

- Delivery Success % = delivered ÷ (delivered + returned to airport), home-delivery journeys only.
- Airport Pickup Success % = picked up ÷ all pickup-method journeys.
- CSAT and Avg. Resolution stay as supporting cards.
- Deltas keep comparing the selected window to the preceding equal window.

## 3. Baggage Status Distribution

Bar + donut render the full ladder from the Workflow Engine, zero-filled, in lifecycle order, with a colour per status (pickup statuses get their own colours).

## 4. Unified operational pipeline

"Current Pipeline by Stage" in Reports is replaced by one pipeline over all cases, keyed by current workflow status across Lost & Found, Delivery and Airport Pickup — a single chart, not two.

## 5. Reports, filters, export, print

- Executive block gains pickup counters and a combined "completed journeys" figure (delivered + picked up).
- Lost & Found status table zero-fills the full ladder.
- Add a journey filter (All / Home Delivery / Airport Pickup) applied to the report payload.
- Delivery-only sections (stage timings, return reasons, first-attempt) stay labelled as Home Delivery so nothing implies pickup cases failed.
- Excel/CSV export and print sheets include the journey type column and the pickup statuses.

## 6. Trends

Daily/Weekly/Monthly buckets emit `delivered`, `pickedUp` and `completed` series, all derived from workflow transitions rather than the deliveries table. Dashboard and Reports charts both stack the two completion types.

## 7. Single analytics layer

All of the above lives in the two existing RPCs (`dashboard_executive`, `report_operational`) sharing new helper functions over the Workflow Engine tables. No module computes its own statistics; the UI only renders what the RPCs return.

## Technical changes

- Migration: helper `wf_status_ladder()` and `wf_journey_kind(case)`; rewrite `dashboard_executive()` KPIs to current-status counts, zero-filled `byStatus`, unified `funnel`, dual completion `trends`; rewrite `report_operational()` pipeline, lostFound status table, executive block and trends; add optional journey filter argument.
- `src/lib/dashboard.server.ts` / `src/lib/reports.server.ts`: extend the returned types.
- `src/routes/index.tsx`: new KPI card grid, full-ladder colours, stacked completion trend.
- `src/routes/reports.tsx`: unified pipeline chart, journey filter, pickup-aware tables and trends.
- Export/print helpers under `src/lib/` updated for the journey column.

## Validation

Cross-check the dashboard, reports, workflow monitor and case lists against a direct status query so all four agree on every status count, including the 9 delivered and 2 picked-up cases currently in the system.
