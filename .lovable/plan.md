
## Goal

Fix the first failing step (driver's current GPS is never used) without moving routing responsibility into the Driver Portal. The Workflow Engine remains the single source of truth for the optimized route. The Driver Portal only reports its position and renders what the engine produces.

## Architecture

```text
Driver device (GPS)
        │  reportDriverPosition(driver, {lat,lng})
        ▼
┌────────────────── Workflow Engine ──────────────────┐
│  • driverPositions[driver] = {lat,lng,at}           │
│  • recomputeDriverRoute(driver):                    │
│       origin = driverPositions[driver]              │
│               ?? lastCompletedStop                  │
│               ?? station                            │
│       stops  = open deliveries for driver           │
│       route  = optimizeRoute(stops, origin)         │
│       persist: driverRoutes[driver] = {origin,      │
│                stops:[deliveryId...], computedAt}   │
│  • Triggers: assignDriver, unassign, stage change,  │
│    delivered, new position, station change          │
└────────────────────────┬────────────────────────────┘
                         │  useStore → driverRoutes[driver]
                         ▼
                  Driver Portal (read-only)
                  • shows ordered stops
                  • “Navigate Full Route” → Maps deep link
                    origin=<gps> waypoints=<mid stops>
                    destination=<last stop>
                  • “Navigate to this stop” per row
```

## Scope of changes

### 1. Workflow Engine — `src/lib/store.ts`
- Add state slices:
  - `driverPositions: Record<string, { lat:number; lng:number; at:string; accuracy?:number }>`
  - `driverRoutes: Record<string, { origin:{lat,lng,source:'gps'|'lastStop'|'station'}; stops:string[]; computedAt:string }>`
- New actions:
  - `reportDriverPosition(driver, pos)` — updates position, calls `recomputeDriverRoute(driver)`, emits.
  - `recomputeDriverRoute(driver)` — internal; picks origin (GPS → last completed stop → station), calls `optimizeRoute`, writes `driverRoutes[driver]`.
- Trigger `recomputeDriverRoute` inside existing actions: `assignDriver`, `bulkAssignDriver`, `driverMarkDelivered`, `driverStartTrip`, any stage change that removes a stop, and station updates.
- Persist through the existing Supabase `app_state` path (no schema change).

### 2. Routing module — `src/lib/routing/optimize.ts`
- Keep `optimizeRoute` and `haversineKm` as pure functions.
- Replace `navigationHref(single)` with two helpers:
  - `stopNavigationHref(origin, stop)` — single leg, origin included.
  - `routeNavigationHref(origin, orderedStops)` — full multi-stop deep link using Google Maps URLs API: `dir/?api=1&origin=<lat,lng>&destination=<lastLat,lastLng>&waypoints=<lat,lng>|<lat,lng>&travelmode=driving` (waypoints capped at 9 per Maps limit; overflow handled by chunking with a note).

### 3. Driver Portal — `src/routes/driver-portal.tsx`
- Remove `useMemo(optimizeRoute(...))`. Read `driverRoutes[driver]` from the store and hydrate `stops[]` → `Delivery[]` in display order.
- Add a GPS reporter effect (only while signed in):
  - On mount: `navigator.geolocation.getCurrentPosition` → `reportDriverPosition`.
  - Then `watchPosition` with a throttle (e.g. only report if moved > 75 m or 30 s elapsed).
  - On unmount: `clearWatch`.
  - Graceful fallback UI when permission denied / unavailable: show badge "Location off — route anchored at station", engine still returns a route using station origin.
- Header shows origin source badge: GPS · Last stop · Station.
- Navigation buttons:
  - Primary "Navigate Full Route" → `routeNavigationHref(origin, stops)`.
  - Per-stop "Navigate" → `stopNavigationHref(previousStopOrOrigin, thisStop)`.

### 4. Not in scope
- No database migration, no new tables, no Supabase edge functions.
- No Google Directions / Routes API server call. The engine stays haversine nearest-neighbor (the existing drop-in seam is preserved for a later provider swap).
- No changes to Dispatch, L&F, Passenger Portal, or notifications.

## Behaviour after the change

- Assigning a driver immediately produces `driverRoutes[driver]` anchored at station (no GPS yet).
- When the driver opens the portal and grants location, the engine recomputes with GPS origin and the portal re-renders the reordered list.
- As the driver moves, throttled position reports trigger recomputation; the remaining stop order updates automatically.
- Marking a stop delivered removes it from `stops[]` and recomputes from the newest GPS fix.
- "Navigate Full Route" opens Google Maps with the driver's real origin + ordered waypoints + final destination — not a generic single-destination page.

## Risks / edge cases to handle
- Geolocation permission denied → keep station origin, surface badge, no console spam.
- >9 remaining stops → chunk the deep link and expose "Next 9 stops" / "Following stops" buttons.
- Rapid position churn → throttle (distance + time) to avoid Supabase write storms.
- Multiple tabs for the same driver → last write wins; acceptable for demo scope.

## Verification checklist
- Assign a delivery → `driverRoutes[driver].origin.source === 'station'`, stops present.
- Sign into Driver Portal with location allowed → origin flips to `gps`, order may change, badge shows GPS.
- Simulate movement (devtools sensors) → order recomputes without reload.
- Click "Navigate Full Route" → URL contains `origin=`, `waypoints=`, `destination=`.
- Mark first stop delivered → it disappears from route; next stop becomes #1; origin re-anchors to newest GPS.
