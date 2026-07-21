## Delivery Management — UI Cleanup & Standardization

Scope: `src/routes/delivery.index.tsx` only. No changes to workflow, store, notifications, business logic, or the Delivery Details page.

### 1. Header
- Remove the descriptive subtitle ("Operational back office for home baggage delivery…").
- Keep only the H1 "Delivery Dispatch Center", matching L&F's header style.

### 2. KPI cards
- Replace the current 6-card strip with a 5-card grid (`md:grid-cols-5`) using the same `Kpi` visual style as L&F (label + colored value, no icons/tone-blocks):
  - Ready for Delivery (slate)
  - Assigned (indigo)
  - Out for Delivery (amber/cyan)
  - Delivered (emerald) — renamed from "Delivered Today", counts all Delivered
  - Active (violet)
- Remove: "Avg Delivery Time" card and the "Delivered Today" concept.

### 3. Filter bar
- Rewrite to match L&F's `Card > CardHeader` layout with the same spacing, sizing, typography, and shadcn `Select` components.
- Keep only: Search, Status (all delivery stages), From date, To date, Reset (right-aligned, ghost, ✕ icon).
- Remove: Driver filter, More/Advanced filters toggle, Priority, Station, Type, VIP only, "Clear filters" text button, "Showing X of Y" counter line.
- Keep the queue tabs (All / Ready / Assigned / Out / Completed) above the filter bar since they are the primary operational lens — implemented as they are today but visually matched to L&F's tab treatment.

### 4. Bulk actions
- Replace the local `DeliveryBulkToolbar` with the shared `BulkToolbar` from `@/components/bulk/bulk-toolbar` (same one L&F uses) with `noun="Delivery"`.
- Actions (operational only):
  - Assign Driver (primary)
  - Resend OTP (outline)
  - Notify Passenger (outline)
- Delete the local `DeliveryBulkToolbar` component.

### 5. Table / row / status badges
- Keep table columns and row logic unchanged (functional).
- Swap the inline stage pill for the shared badge style used in L&F (same radius, padding, typography) — reusing `STAGE_STYLES` colors.
- Keep the existing per-row Actions menu (already stage-aware); no behavioral changes.

### 6. Visual consistency
- Match L&F's spacing (`space-y-6`, `Card` + `CardHeader pb-3`), typography, button sizes (`h-9`), dropdown styles, card radius, and hover states.
- Date inputs use L&F's transparent-placeholder pattern.

### Out of scope
- Workflow engine, store, notification templates, database, timeline, driver portal, delivery details page, dialogs' business logic (BulkAssignDialog, BulkNotifyDialog, SingleAssignDialog remain functionally identical).

### Files touched
- `src/routes/delivery.index.tsx` (only)
