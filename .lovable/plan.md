## Delivery Details — UI Cleanup Only

Scope: `src/routes/delivery.$deliveryId.tsx` only. No changes to workflow, delivery engine, notifications, timeline, audit, database, or status handling.

### 1. Header field strip
Remove the following metadata fields from the header grid:
- Station
- Created
- Type (Home Delivery)

Keep:
- Driver
- Priority
- Last Updated
- OTP Status

### 2. Header button strip
Remove from the top-right action group:
- Export (JSON download button)
- Close

Keep:
- Assign / Reassign (existing dispatch action)
- Resend OTP
- Notify Passenger
- View Passenger Portal
- Open Navigation
- Print

> Rationale: Export/Close are non-operational for dispatchers; Assign/Resend/Notify remain because they are the core dispatch actions and were not requested for removal.

### 3. Tab strip
Remove the following tabs and their panels:
- Timeline
- Audit
- History

Keep:
- Overview
- Passenger
- Delivery
- Notes
- Notifications

Update the `Tab` union type and the tab navigation array accordingly.

### 4. Dead-code cleanup
Remove imports that become unused after the tab/button removals (e.g., `Download`, `XCircle`, `WORKFLOW_LABELS`, `closeDelivery`). Leave all data-fetching hooks and business-logic helpers untouched.

### Files touched
- `src/routes/delivery.$deliveryId.tsx`