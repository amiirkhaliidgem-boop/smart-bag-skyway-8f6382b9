# Reports Module + Quality Management — Production Build

## Current state (verified)

- `public.quality_incidents` exists but is **empty**; its only writer is the Passenger Portal `passenger_report_misconduct` RPC (always `Possible Misconduct` / `High` / `Open`).
- No incident lifecycle actions, no assignment, no audit or workflow journaling, no notifications.
- `src/lib/quality/categories.ts` has a category→severity matrix that nothing uses.
- Reports computes 5 KPIs and 2 charts client-side; airline analytics use `flightNumber.slice(0,2)` instead of the real `airline` column, so they are wrong today.
- `sla_policies` table exists and is unused by Reports; Workflow Monitor hardcodes SLA minutes in the page file.

## Part 1 — Quality Management (database)

Extend `quality_incidents` with: `incident_no` (QI-000001 sequence), `source` (passenger / sla / return / otp / csat / manual), `assigned_to`, `assigned_at`, `agent_id`, `airline`, `station_id`, `due_at`, `resolution_category`, and a `dedupe_key` unique index so automation cannot raise the same incident twice.

Add `Assigned` and `Investigating` to `incident_state` so the lifecycle is Open → Assigned → Investigating → Resolved.

New RPCs, all journaling through the existing `wf_journal_event` so every action lands in Timeline and Audit:

- `qm_raise_incident(...)` — internal, idempotent on `dedupe_key`, severity from the category matrix.
- `qm_create_incident(...)` — staff manual raise.
- `qm_assign_incident(id, app_user_id)`, `qm_set_state(id, state, note)`, `qm_resolve_incident(id, resolution_category, note)`.

Automatic generation (the four sources you selected), wired into the Workflow Engine itself, not the UI:

| Trigger | Where | Category | Severity |
|---|---|---|---|
| Stage exceeds its `sla_policies` target | `wf_transition` + a lightweight sweep on snapshot read | Late Delivery | Medium |
| `dm_mark_returned` | Return to Airport | uses the recorded failure reason | High |
| OTP attempts hit `max_attempts` | `agent_complete_delivery` | Failed Verification | High |
| Feedback rating ≤ 2 | `passenger_submit_feedback` | Service Quality | Medium |

Incidents link to case, delivery, agent, and (denormalised at raise time) airline and station, so every report dimension is queryable.

## Part 2 — Reports as a server-side reporting layer

Add `src/lib/reports.functions.ts` + `reports.server.ts`: one authenticated server function `getOperationalReport({ from, to })` that runs **SQL aggregates against the engine tables** (`baggage_cases`, `deliveries`, `workflow_events`, `passenger_feedback`, `quality_incidents`, `notification_events`, `sla_policies`). Nothing is recomputed in the browser; the store snapshot is not used for Reports.

Returned sections, all date-filtered:

- **Executive** — total cases, delivered, delivery success %, SLA compliance %, CSAT, open incidents, avg case-to-delivery hours.
- **Delivery** — volume by stage, first-attempt success, returns and reasons, avg minutes per stage transition, on-time vs breached.
- **Lost & Found** — intake, by L&F status, incomplete-record rate, avg time to Ready for Delivery, VIP share.
- **Passenger experience** — CSAT from real `passenger_feedback` (avg rating, 1–5 distribution, response rate = feedback ÷ delivered, resolved %), portal link view rate, notification delivery success by channel.
- **Quality** — incidents by category, severity, source, state; open vs resolved; avg time to resolve; repeat-offender agents.
- **Performance** — per delivery agent (delivered, returned, on-time %, avg CSAT, incidents), per L&F officer (cases owned, avg time to ready), per airline (cases, delivered, incidents, CSAT) using the real `airline` column.
- **Trends** — daily / weekly / monthly series for volume, success, SLA, CSAT, incidents.

## Part 3 — Reports page

Rewrite `src/routes/reports.tsx` as a single sectioned page with a global date-range selector (Today / 7d / 30d / MTD / custom, reusing `date-range-filter`) and a granularity toggle. Sections in order: Executive KPIs → SLA & Delivery → Lost & Found → Passenger Experience & CSAT → Quality Management → Performance league tables → Trends. Loads via TanStack Query with skeletons matching the existing `ops-skeleton` style. Export uses the existing xlsx helper.

A **Quality Incidents** section becomes actionable for staff with quality permission: filter by state/severity/source, open a drawer, assign, move state, resolve with a resolution category. Read-only for everyone else.

## Part 4 — Hide Import / Export

Same treatment as Storage Control and QR Scan: remove the `/data-io` sidebar entry, point `src/routes/data-io.tsx` at `ModuleComingSoon` with the real implementation preserved in `src/components/io/data-io-full.tsx` and a commented one-line restore. Routes, RBAC entries, registry, and all backend code stay untouched.

## Part 5 — Validation

- Cross-check every KPI against a direct SQL query on the same window; they must match exactly.
- End-to-end run of one delivery: assign → accept → collect → out → OTP lockout (verify incident raised) → deliver → 2-star feedback (verify CSAT incident) → confirm the incident appears in Reports, Workflow Monitor, Timeline and Audit.
- Force one SLA breach and one Return to Airport and confirm exactly one incident each, no duplicates on repeat reads.
- Supabase linter run and a typecheck; report anything that cannot be verified rather than claiming it passed.

## Technical notes

All aggregation is SQL in server functions under `requireSupabaseAuth`; Reports stays a read-only projection of the engine. Incident automation lives inside the existing workflow RPCs so no module can raise state independently. No changes to the Passenger Portal design, Driver Portal, or delivery lifecycle rules.
