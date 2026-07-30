## Goal

Remove **Delivery Agent Portal** from the admin navigation and put a new read-only **Delivery Agent Monitoring** screen in its place, under Delivery Operations. The Driver Portal route, backend, workflow, and database stay untouched — drivers keep signing in through `/auth` and landing on `/driver-portal`.

## 1. Navigation

In `src/components/app-shell.tsx`, the "Delivery Operations" section item `/driver-portal` "Delivery Agent Portal" is replaced by `/agent-monitoring` "Delivery Agent Monitoring" (Radar/Activity icon). No other nav entry changes. `/driver-portal` remains fully routable and reachable by direct URL and by driver sign-in redirect.

## 2. Access

No new permissions and no RBAC redesign. The new path is mapped to the **existing** "Delivery Management" module so anyone who currently sees Delivery Management sees monitoring:

- `src/lib/admin/modules.ts` → add `{ prefix: "/agent-monitoring", module: "Delivery Management" }`.
- `src/lib/rbac.ts` (legacy fallback matrix) → add `{ prefix: "/agent-monitoring", roles: ["admin", "coordinator"] }`, matching `/delivery`.
- Driver-role behavior is unchanged: drivers are still confined to `/driver-portal` by the existing root guard.

## 3. New route: `src/routes/agent-monitoring.tsx`

Read-only screen, no mutating calls, no action buttons at all. It consumes only data already produced by the existing snapshot tiers — no new tables, RPCs, or engines.

Layout:

- **Filter bar**: a driver selector (All Drivers / one driver) plus a text search. URL search param `driver` so the view is shareable. No other controls.
- **Driver cards / rows**, one per selected driver, each showing:
  - Driver name and employee ID (from `snapshot.agents`)
  - Derived status chip: **Busy** (has an active in-flight delivery), **Online** (position reported recently, e.g. within 10 min), **Offline** (no recent position) — derived in the component from existing `driverPositions` and delivery stages; nothing is written back.
  - Current delivery (delivery no, passenger, PIR/Bag ID) and its current workflow stage
  - Current route summary from `driverRoutes` (ordered stops) and **Remaining stops** count
  - **Completed deliveries today** count, computed from delivered deliveries with today's completion timestamp
  - **Live GPS position** (lat/lng) and **Last location update** timestamp with relative age
- **Activity timeline panel**: reads the canonical engine-written `timeline` list from the activity snapshot (`public.timeline_events`), filtered to the selected driver's deliveries (and to all monitored drivers when "All" is selected). No separate driver history is created. Shows Assigned / Accepted / Collected / Out for Delivery / OTP Verified / Delivered / Returned to Airport as the engine recorded them.
- Skeletons from `src/components/ops-skeleton.tsx` while the core/activity/secondary tiers load, so the shell paints immediately.

## 4. Live updates

No manual refresh button. The page uses the store's existing hydration/refresh path: it subscribes to the store and triggers the same background snapshot refresh the rest of the app uses, on the existing realtime channel where available, with a lightweight interval (~15s) for the secondary tier that carries GPS positions and routes. Timeline data refreshes with the activity tier.

## 5. Technical notes

- Data sources, all already present: `agents`, `deliveries` (stage, timestamps, agent assignment), `driverPositions`, `driverRoutes` from `buildCoreSnapshot`/`buildSecondarySnapshot`, and `timeline` from `buildActivitySnapshot`.
- No changes to `src/routes/driver-portal.tsx`, `src/lib/store.ts` mutations, workflow RPCs, notifications, route engine, or any migration.
- Route gets its own `head()` metadata (title/description/og) per project convention.

## 6. Validation before hand-off

- TypeScript check clean, no broken imports.
- Verify nav shows Monitoring and no longer shows Agent Portal, for both a coordinator-style and admin-style permission set.
- Verify `/driver-portal` still loads directly and driver sign-in still redirects there.
- Load the monitoring page and confirm driver filtering, GPS/last-update rendering, remaining stops, completed-today counts, and that timeline entries match the Activity Timeline page for the same deliveries.
- Confirm zero mutating calls originate from the page and no console errors.
- Spot-check Delivery Management, Lost & Found, Passenger Portal, Warehouse, Notifications, Timeline, and Reports for regressions.
