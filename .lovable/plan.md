# Executive Dashboard — Production Ready

## Problem (verified)

- `src/routes/index.tsx` computes every KPI and chart in the browser from the client-side ops store (cases/deliveries/workflow arrays), which is capped at 500 rows per collection.
- KPI trend badges (`+12%`, `-4%`, `+8%`…) are hardcoded literals.
- The Cases by Carrier chart derives the carrier by stripping digits from `flightNumber` (`c.flightNumber.replace(/\d+$/g,"")`), producing `E` and `G`. The database already stores real codes: `baggage_cases.airline` = `E5` (4 cases) and `G9` (4 cases).
- A database reporting function already exists (`public.report_operational`) and is the pattern the Reports module uses.

## Scope

Operational KPIs and charts only. No module/system health panel — Timeline, Audit, Notifications and Portal status belong to the System module, not here.

## Approach

One new aggregated SQL function, one server function, one rewritten route. No frontend math.

### 1. Database: `public.dashboard_executive(p_from, p_to, p_grain)`

A single `SECURITY DEFINER` function (mirroring `report_operational`, granted to `authenticated`, revoked from `anon`/`PUBLIC`) returning one `jsonb` payload:

- **kpis** (current operational state): total cases, open cases, located bags, ready for delivery, delivered bags, avg resolution hours, CSAT, delivery success %, open quality incidents — plus, for each, a real period-over-period `delta_pct` comparing the selected window against the immediately preceding window of equal length. This replaces the hardcoded trend badges.
- **byStatus** — case counts grouped by `lf_status`.
- **byCarrier** — counts grouped by the actual `baggage_cases.airline` column, ordered by volume, no string slicing. New airlines appear automatically.
- **funnel** — counts grouped by `workflow_status` across the canonical workflow order.
- **trends** — bucketed by day/week/month: cases opened, cases resolved, delivered, quality incidents, CSAT, delivery success %.

All aggregation happens in SQL over the Workflow Engine tables; the browser receives a small payload, never thousands of rows.

### 2. Server layer

Add `loadExecutiveDashboard` to a `*.functions.ts` module with `requireSupabaseAuth` (same shape as `loadOperationalReport`), delegating to a `.server.ts` helper that calls the RPC and types the payload.

### 3. Route rewrite — `src/routes/index.tsx`

- Fetch through TanStack Query with the existing skeletons in `src/components/ops-skeleton.tsx`, so the shell paints immediately.
- Render KPIs, status distribution, carrier chart (real `E5` / `G9` labels), workflow funnel, and trend charts (opened vs resolved, quality incidents, CSAT, delivery success) purely from the returned payload.
- Reuse the exact Date Range component already used by Reports (`src/components/filters/date-range-filter.tsx`) plus the same grain selector, for consistent UI.
- Auto-refresh: subscribe to the existing realtime ops channel and invalidate the dashboard query on any workflow/delivery/case/incident/feedback change, so a Workflow Engine transition reflects with no manual refresh.

### 4. Validation

- Cross-check each KPI and chart series against direct SQL queries on the live database.
- Confirm the carrier chart shows `E5` and `G9`.
- Drive a workflow transition and confirm the dashboard updates without reload.
- Run typecheck and the production build.

## Notes

- No changes to the Workflow Engine, Reports, Delivery, L&F, or Passenger Portal behaviour.
- `report_operational` stays as-is; the dashboard gets its own function so its current-state KPIs aren't forced into a reporting date window.
