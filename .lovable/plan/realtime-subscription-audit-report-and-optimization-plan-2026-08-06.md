# Realtime Subscription Audit — Report and Optimization Plan

## Part 1 — Full inventory (nothing changed yet)

There are exactly **three** Postgres-changes Realtime subscriptions in the app, plus three auth listeners and several polling timers. Everything that "feels live" is driven by these.

### 1. `ops_sync` — src/lib/store.ts (module singleton, one per tab)

Tables: `deliveries`, `baggage_cases`, `notification_events` → debounced tier refresh (750 ms, deferred while the tab is hidden).

- **Why it exists:** the store is a read-through projection of the database. This channel is what makes a write by one operator appear on every other screen.
- **Workflows depending on it:** Lost & Found list and case details, Delivery Dispatch Center, Delivery Details, Driver Portal active deliveries and route, Workflow Monitor, Timeline, Notifications, Feedback, OTP and assignment state.
- **If removed:** a dispatcher would assign a driver another dispatcher already took; the Driver Portal would not see new stops; OTP and stage changes would not propagate; L&F would show cases already handed over. Direct breakage of delivery synchronization, case status sync, OTP status and assignment updates.
- **Classification: CRITICAL — keep.**

### 2. `executive_dashboard_sync` — src/routes/index.tsx (mounted only on `/`)

Tables: `baggage_cases`, `deliveries`, `workflow_events`, `quality_incidents`, `passenger_feedback` → invalidates the `executive-dashboard` query.

- **Why it exists:** the dashboard reads a server-side aggregate (`dashboard_executive`) that is not part of the store snapshot, so it needs its own invalidation signal.
- **Workflow depending on it:** executive KPI and chart viewing only. No operational decision is blocked by a few seconds of lag; the page already has a manual Refresh button and a 30 s `staleTime`.
- **If removed entirely:** KPI tiles and charts could show slightly stale numbers until refresh. No workflow, notification, timeline or delivery regression — it is read-only reporting.
- **Overlap:** `baggage_cases` and `deliveries` are already carried by `ops_sync`; this duplicates two of five tables on a second socket topic.
- **Classification: OPTIONAL — consolidate rather than remove** (keep the live behaviour, stop opening a second channel).

### 3. `system-settings-live` — src/lib/settings/use-settings.ts (one channel **per mounted hook instance**)

Tables: `system_settings`, `sla_regions`, `notification_templates`.

- **Why it exists:** an admin editing SLA hours, regions or notification templates should propagate to open staff screens.
- **Workflows depending on it:** SLA % KPI in Dispatch, the region picker in the PIR wizard, template previews in Workflow Monitor, the Settings screen itself.
- **If removed:** an operator with a stale tab could use an outdated region list or SLA target until reload. Not a workflow break, but a genuine correctness aid, and settings writes are rare so keeping it costs almost nothing.
- **Defect found:** the hook is used by 5 components. Every mounted instance opens its **own** channel on the same topic, so `/delivery` alone (Dispatch plus an open wizard) holds 2–3 duplicate channels, and route changes churn them. `publicSettingsQuery` additionally polls every **5 seconds** forever on the passenger portal — far more traffic than the channel it duplicates.
- **Classification: CRITICAL to keep, but de-duplicated to one shared channel; the 5 s public poll rate is UNNECESSARY.**

### Non-Realtime live mechanisms (audited, correctness only)

- `passenger.$token.tsx`: 5 s query poll, stops at terminal stages, no background polling. Public/anon page with no session — Realtime is not appropriate here. **Keep as-is.**
- `agent-monitoring.tsx`: 15 s interval refreshing secondary and activity tiers (GPS positions). **Keep** — `agent_positions` is not covered by `ops_sync`.
- `workflow-monitor.tsx`: 30 s tick for relative-time re-render only. **Keep.**
- `api-status.tsx` 30 s and `integrations.tsx` 60 s query polls. **Keep.**
- Three `onAuthStateChange` listeners (`__root`, `index`, `driver-portal`) — all correctly unsubscribed. `store.ts` registers a fourth without teardown, but it is a deliberate module singleton.

### Cleanup defects found

- `ops_sync` is removed only on `beforeunload`; its `visibilitychange` listener is never removed. Tolerable for a singleton, but not explicit.
- `use-settings.ts` teardown is correct per instance — the *duplication* is the problem, not the cleanup.
- `index.tsx` cleanup is correct.

**Verdict: nothing is safe to delete outright. The win is consolidation and de-duplication, not removal.**

## Part 2 — What I will change after approval

1. **One shared realtime hub in `src/lib/store.ts`.** A single `supabase.channel("app_sync")` owning all tables (`deliveries`, `baggage_cases`, `notification_events`, `workflow_events`, `quality_incidents`, `passenger_feedback`, `system_settings`, `sla_regions`, `notification_templates`), exposed through a ref-counted `subscribeRealtime(tables, handler)` helper that returns an unsubscribe function. The channel opens on the first subscriber and is torn down with `supabase.removeChannel(channel)` when the last one leaves.
2. `**src/routes/index.tsx**` — drop its own `.channel(...)` and register its invalidation callback with the hub. Identical live behaviour, zero extra channels.
3. `**src/lib/settings/use-settings.ts**` — drop the per-instance channel and register with the hub, so all 5 hook instances share one listener. Lower `publicSettingsQuery` from a 5 s poll to 60 s, keeping `refetchOnWindowFocus` (the passenger page is anon and cannot use the authenticated hub).
4. **No changes** to Driver Portal, Passenger Tracking, Notifications, Timeline, Dispatch, the Workflow Engine data paths, or any RPC/business logic. The store's debounce, hidden-tab deferral and tier mapping stay exactly as they are.

### Expected result

- Active channels per tab: **3–5 → 1**.
- Duplicate settings channels from re-render or route change: eliminated by ref counting.
- Passenger portal settings requests: 720/hour → 60/hour.
- Subscription bindings 11 → 9, with no table losing coverage.  
  
Before implementing the shared Realtime Hub, please verify that channel consolidation does not introduce event cross-talk between modules.
  Specifically confirm that:
  - Delivery events never trigger unnecessary Lost & Found refreshes.
  - Lost & Found events never trigger unnecessary Driver Portal refreshes.
  - Settings updates invalidate only consumers that actually depend on those settings.
  - Executive Dashboard invalidation remains isolated from operational workflows.

## Part 3 — Verification after implementation

Playwright regression across `/`, `/lost-found`, `/delivery`, `/delivery/:id`, `/driver-portal`, `/timeline`, `/notifications`, `/workflow-monitor`, `/settings` and `/passenger/:token`: drive a real case Ready for Delivery → Assigned → Out for Delivery → OTP Delivered and confirm each screen updates with no manual refresh, plus a console count of `supabase.getChannels().length` per route before and after.