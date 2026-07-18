# Route Optimization Engine — Pre-Test Audit

Verified against `src/lib/routing/optimize.ts` and `src/routes/driver-portal.tsx`. No code changes proposed yet — this is a status confirmation. Items marked ⚠️ do not match the expectation exactly and need a decision before testing.

## Confirmed as implemented

**1. Auto-calculated for multiple deliveries on same driver** ✅
`DriverDashboard` filters `deliveries` by `driver === <signed-in driver>`, then `useMemo(() => optimizeRoute(open), [mine])` runs nearest-neighbor over every non-delivered stop.

**2. Origin is the Airport** ✅ (with caveat)
`AIRPORT_ORIGIN` in `src/lib/routing/optimize.ts` is hard-coded to Cairo International Airport (30.1219, 31.4056). It is not read from a "station" setting — if the airport ever changes, it's a code edit.

**3. Stops reordered automatically before trip starts** ✅
Optimization runs on every render of the driver dashboard, so the order is always current when the driver opens the app — no manual trigger, no "optimize" button.

**4. Driver never sees the optimization process** ✅
UI shows only the numbered ordered list ("Today's Route · N stops · optimized from airport"). No toggles, no algorithm details, no raw distances.

**5. Reassign / add recalculates automatically** ✅
The store is reactive (`useStore`), so any `assignDriver` / reassignment mutation updates `mine`, which re-runs `useMemo`, which re-runs `optimizeRoute`. No manual refresh needed.

## Partial / does not match exactly

**6. Open Navigation opens Google Maps for the current stop only** ⚠️
Per-stop, yes — each card's button calls `navigationHref(d)` for that one delivery. **But** the URL is built as `origin=<airport coords> → destination=<stop>`, so Google Maps always routes from the airport, even for stop #3 after the driver already left stops #1 and #2. Expected behavior is usually "navigate from my current location to this stop." Two options:
- **A.** Drop `origin` from the URL so Google Maps uses the device's current location (recommended for a real driver in the field).
- **B.** Keep airport as origin (matches the current "optimized from airport" framing but is wrong for stops 2+).

**7. After completing a stop, the next stop automatically becomes active** ⚠️
Partial. Completing a stop (OTP verified → `driverMarkDelivered`) moves it to the "Completed" section and it drops out of the route, so the next stop naturally rises to position #1. **But** there is no explicit "active / current stop" state or highlight in the UI — the driver has to infer it's the top card. Also, the remaining route is re-optimized from the airport, not from the driver's last delivered location, so the visit order after a completion can shift in ways that surprise the driver.
Options:
- **A.** Add a visible "Current stop" badge on route[0] and slightly de-emphasize the rest until it's completed.
- **B.** Additionally, re-anchor optimization to the last completed stop's coordinates (not the airport) once the trip has started, so the order is stable as the driver progresses.

## Decision needed before testing

Please confirm which of these to apply (if any) before you start the E2E test:

- Item 6: **A** (device location) or **B** (keep airport origin)?
- Item 7: **A** (add active-stop highlight only), **A + B** (also re-anchor from last stop), or leave as-is?
- Item 2: is a hard-coded Cairo airport origin acceptable, or should it become a configurable station coordinate?

Once you pick, I'll implement in build mode and then you can test.
