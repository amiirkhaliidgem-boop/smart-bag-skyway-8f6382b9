## Current state (verified)

- `src/routes/tracking.tsx` holds the whole Track Baggage screen: the `TrackingPage` search shell plus `TrackingResultPanel`, `Section`, `InfoTile`, `formatAt`, the `PROGRESS_STAGES` / `OTP_VISIBLE_STAGES` constants — all inline in the route file.
- Resolution logic is already shared and read-only in `src/lib/tracking/resolve.ts` (Delivery ID → PIR → Bag ID → Bag Tag → PNR against live store data).
- The sidebar in `src/components/app-shell.tsx` lists "Baggage Tracking" only under the `CONTACT CENTER OPERATIONS` section (line 77); `Baggage Operations` has just Lost & Found.
- `src/lib/rbac.ts` currently restricts `/tracking` to `admin` only (line 25), while `/lost-found` is `admin` + `agent`.

## Refactor

**1. Extract the shared component — `src/components/tracking/track-baggage.tsx`**
Move `TrackingPage`'s body, `TrackingResultPanel`, `Section`, `InfoTile`, `formatAt`, `PROGRESS_STAGES`, `OTP_VISIBLE_STAGES` out of the route file verbatim. Export a single `<TrackBaggage />` component with optional presentation props only:
- `showHeading?: boolean` (default `true`) — so an embedding surface can hide the duplicate `<h1>`.
It keeps its own `useStore` reads and `resolveTracking` call, so both consumers get identical live data and identical UI with zero prop plumbing.

**2. Route becomes a thin wrapper — `src/routes/tracking.tsx`**
Keeps only `createFileRoute("/tracking")`, its `head()` metadata, and `component: () => <TrackBaggage />`. No behavioural change for Contact Center users; same URL, same page.

**3. Baggage Operations entry point**
Add a "Baggage Tracking" item to the `Baggage Operations` sidebar section pointing at the same `/tracking` route (single implementation, single URL — no second page, no duplicated route). It renders active for either sidebar entry since both link to the same path.

**4. Access**
Widen the `/tracking` RBAC rule from `["admin"]` to `["admin", "agent", "coordinator"]` so Lost & Found officers can actually open it from their section; admin behaviour is unchanged.

## Not touched

Workflow Engine, Delivery Engine, Notification Engine, Timeline, Audit, database, `src/lib/tracking/resolve.ts`, and all business logic. This is component extraction, navigation, and one access-rule line only.
