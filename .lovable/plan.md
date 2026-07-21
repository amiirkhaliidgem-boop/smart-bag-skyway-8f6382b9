## RCA — Delivery Details: `Accepted At` & `Collected At` never populate

### Root Cause
The Driver Portal skips the two lifecycle stages that write these timestamps.

In `src/routes/driver-portal.tsx` (line ~425–436), the only driver action available on an `Assigned` delivery is **"Start Delivery"**, which calls `driverStartTrip(...)` → `setDeliveryStage(id, "Out for Delivery")`. This jumps `Assigned → Out for Delivery` in one step, bypassing:

- `Driver Accepted` — the stage that sets `acceptedAt`
- `Collected Bag` — the stage that sets `collectedAt`

The store logic that writes the timestamps is correct and already in place (`src/lib/store.ts` line 1285–1287):

```
if (stage === "Driver Accepted") patch.acceptedAt = now;
if (stage === "Collected Bag")   patch.collectedAt = now;
if (stage === "Delivered")       patch.deliveredAt = now;
```

`deliveredAt` populates because the OTP flow does transition through `Delivered`. The two missing timestamps are simply never reached because no UI (Driver Portal or Dispatch) invokes `driverAccept()` or `driverCollect()` — both helpers exist in the store but have zero call sites.

### Affected files
- `src/routes/driver-portal.tsx` — only exposes `driverStartTrip`; missing Accept and Collect actions.
- `src/lib/store.ts` — exports unused `driverAccept` (line 1396) and `driverCollect` (line 1430).
- `src/routes/delivery.$deliveryId.tsx` (line 302–303) — UI reads `d.acceptedAt` / `d.collectedAt` correctly; not the fault.
- `src/lib/delivery/stages.ts` — already declares `accept`, `collect`, `startTrip` as valid driver actions per stage (lines 186–188), so the stage machine expects the intermediate transitions.

### Data flow (actual vs. expected)

Expected:
```
Assigned --driverAccept--> Driver Accepted  (writes acceptedAt)
        --driverCollect--> Collected Bag    (writes collectedAt)
        --driverStartTrip--> Out for Delivery
        --OTP--> Delivered                  (writes deliveredAt)
```

Actual:
```
Assigned --driverStartTrip--> Out for Delivery   [acceptedAt & collectedAt never written]
        --OTP--> Delivered                        (writes deliveredAt)
```

### First failing step
Driver Portal renders no button for `stage === "Assigned"` that calls `driverAccept`, and no button for `stage === "Driver Accepted"` that calls `driverCollect`. The chain breaks at the very first driver-side transition after assignment.

### Recommended fix (not implemented)
In `src/routes/driver-portal.tsx` `StopCard`, replace the single "Start Delivery" button with stage-gated actions matching `actionsForStage()`:

- `Assigned` → **Accept** button → `driverAccept(id, { actor, role: "Driver" })`
- `Driver Accepted` → **Collect Bag** button → `driverCollect(...)`
- `Collected Bag` → **Start Delivery** button → `driverStartTrip(...)` (keep current)
- `Out for Delivery` → existing OTP flow (unchanged)

No store, schema, or workflow-engine changes required — the transitions and timestamp writes already exist; only the Driver Portal UI needs to invoke them.
