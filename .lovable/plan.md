## RCA (verified in code)

`src/lib/store.ts` boots with `emptyState()` and then calls `refreshOps()`, which awaits one monolithic server function `loadOpsSnapshot` (`src/lib/ops.functions.ts` → `src/lib/ops.server.ts`). That handler runs **17 table reads in one round trip** (cases, bags, deliveries, notes, OTPs, links, workflow events, audit, notifications, feedback, incidents, positions, routes, route stops, users, failure reasons, stations) and only then maps them.

Consequences:
- Pages render instantly, but every screen reads from the empty store, so KPIs show `0`, charts show empty axes, tables show "no rows" — visually indistinguishable from real emptiness.
- There is no `loading` flag anywhere in the store, so no screen can show a skeleton.
- The slowest single query gates all data: notifications, audit and timeline (large, low-priority tables) delay KPI cards (small, high-priority tables).
- Every realtime change triggers a full 17-table refetch.

So this is purely a loading-strategy issue, exactly as reported.

## What will change

### 1. Split the snapshot into three tiers (server)
`src/lib/ops.server.ts` gets three builders instead of one, sharing the existing mappers so no mapping/business logic changes:

- **Core** — stations, `baggage_cases`, `case_bags`, `deliveries`, `app_users`, `failure_reasons`, `otp_challenges`, `passenger_links`, `delivery_notes`: everything the KPI cards, L&F registry, Dispatch Center and charts need.
- **Activity** — `workflow_events`, `audit_events`, `notification_events`: Timeline, Workflow Monitor, Notification Center, Audit tabs.
- **Secondary** — `passenger_feedback`, `quality_incidents`, `agent_positions`, `agent_routes`, `agent_route_stops`: CSAT, incidents, route tracking.

`src/lib/ops.functions.ts` exposes `loadOpsCore`, `loadOpsActivity`, `loadOpsSecondary` (same `requireSupabaseAuth` middleware, same allow-listed RPC bridge untouched). Existing limits and the truncation reporting are preserved per tier.

### 2. Fire the tiers in parallel and commit each as it lands (client)
`refreshOps()` starts all three requests at once and merges each result into the store the moment it resolves, calling `notify()` per tier. Core typically lands first, so KPIs and tables fill while activity/secondary are still in flight. Failure of one tier no longer blanks the others.

### 3. Add explicit load state so screens show skeletons, not zeros
The store gains a small `loading: { core, activity, secondary }` flag plus a `useOpsLoading()` selector. Screens read it to swap in skeletons:

- `src/routes/index.tsx` — KPI cards and each chart card get their own skeleton, so cards appear before charts.
- `src/routes/delivery.index.tsx`, `src/routes/lost-found.index.tsx`, `src/routes/storage.tsx`, `src/routes/workflow-monitor.tsx` — table/KPI skeletons on `core`.
- `src/routes/timeline.tsx`, `src/routes/notifications.tsx`, `src/routes/reports.tsx`, `src/routes/feedback.tsx`, `src/routes/route-tracking.tsx` — skeletons on their own tier, so they never block core screens.
- A shared `src/components/ops-skeleton.tsx` supplies KPI-card, chart and table-row placeholders using existing shadcn `Skeleton` + design tokens. No layout, copy, colours or business rules change — only a placeholder instead of a fake `0`.

### 4. Cheaper realtime refresh
Realtime events on `deliveries` / `baggage_cases` refresh only the **core** tier; `notification_events` refresh only **activity**. Same debounce, far less work per event.

## Explicitly unchanged
- No migration, no schema, table, RLS, grant, RPC or trigger change.
- `wf_transition`, `dm_*`, `agent_*`, `lf_*`, `notif_*` and the `callOpsRpc` allow-list are untouched.
- Mapping functions in `src/lib/ops.mapping.ts` and all KPI/SLA formulas stay byte-identical.
- No route added or removed; no visual redesign.

## Expected effect

Measured on the current dataset the snapshot is small, so I will benchmark the real before/after with the dev server rather than quote guesses. Structurally: time-to-first-meaningful-KPI drops from "slowest of 17 queries" to "slowest of ~9 small queries", with heavy audit/notification reads moved off the critical path — the dominant win grows with data volume.

## Deliverables at the end
RCA (above, confirmed against the code), the list of changes actually implemented, measured before/after timings for first KPI paint and full hydration, and explicit confirmation that Workflow Engine and database architecture are unchanged.
