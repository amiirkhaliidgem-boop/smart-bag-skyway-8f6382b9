## Goal

Finish Lost & Found by aligning its Bulk Actions with Delivery Management's design, removing manual notifications, and making "Assign Delivery" a real Workflow Engine transition that hands cases over to Delivery Management.

## 1. Create a shared Bulk Toolbar component

Promote Delivery's inline `BulkToolbar` into a reusable component so every module uses the same UI.

- New file: `src/components/bulk/bulk-toolbar.tsx`
  - Exports `<BulkToolbar>` — the sticky primary-tinted bar currently used in `src/routes/delivery.index.tsx` (Selected count + right-aligned action buttons + Cancel Selection).
  - Props: `count`, `label` (e.g. "Delivery" / "Case"), `actions: { key, label, icon?, variant?, onClick, disabled? }[]`, `onCancel`.
  - Renders identically to today's Delivery toolbar; no dropdown menu. This becomes the system-wide standard.
- Refactor `src/routes/delivery.index.tsx` to consume the shared component (behavior unchanged: Bulk Assign / Reassign, Bulk Notify Passenger, Cancel Selection).

## 2. Replace the Lost & Found "Bulk (n) ▾" dropdown

In `src/routes/lost-found.index.tsx`:

- Remove the current `BulkActions` dropdown (`Bulk (n)` button + `DropdownMenu`).
- When one or more rows are selected, render the shared `<BulkToolbar>` in the same header slot with these operational actions only:
  - **Assign Officer** — opens an officer-picker dialog (replaces `window.prompt`), writes via existing `bulkUpdateCases`.
  - **Assign Delivery** — primary action (see §3).
  - **Change Priority** — small inline sub-menu / dialog with Low / Normal / High / VIP (existing `bulkUpdateCases({ priority })`).
  - **Export Selected** — triggers the existing export flow scoped to selected IDs.
  - **Print** — `window.print()`.
  - **Cancel Selection**.
- Remove: **Send Notification** and **Close cases** from bulk (notifications are engine-only; closing stays a per-case action).

## 3. Make "Assign Delivery" a real Workflow Engine transition

Single entry point that hands cases over to Delivery Management through the central engine — no local status writes, no manual notifications.

- New store action in `src/lib/store.ts`: `bulkAssignDelivery(bagIds: string[], actor)`:
  1. **Validate** each case: must be in an L&F-owned status (not already handed over, not Closed). Skip + report ineligible ones.
  2. For each eligible case, drive the transition through the existing L&F status setter to `"Ready for Delivery"` — the same path already used by the PIR wizard, which:
     - Updates the case status (single source of truth via the Workflow Engine mapping).
     - Bootstraps a `Delivery` record when one doesn't exist (existing `ensureDeliveryForBag` logic).
     - Emits Workflow `DELIVERY_APPROVED`, Timeline entry, Audit entry.
     - Fires the automatic passenger notification the engine already schedules for that status.
  3. Return `{ handedOver, alreadyHandedOver, skipped }` for the toast summary.
- In `lost-found.index.tsx`, the toolbar's Assign Delivery button calls this action, then clears selection and shows a summary toast (`X cases moved to Delivery Management, Y already handed over, Z skipped`).
- No new notification code, no direct `deliveries` mutation, no `updateLfStatus` bypass — all effects flow through the existing L&F → Workflow → Delivery pipeline that already runs when a case reaches Ready for Delivery.

## 4. One status across the system (verification, not new code)

Confirm and document that after this change every module reads the same status:

- Workflow Engine remains the single source of truth (`src/lib/workflow/*`, `stageToLfStatus`, `toCaseStatus`, `toDeliveryStatus`).
- L&F, Delivery Dispatch, Delivery Details, Driver Portal, Passenger Portal, Timeline, Notifications, Dashboard, Reports all already derive from the store's workflow/stage — no per-module status writes are added.
- After the refactor, grep for any remaining direct `updateLfStatus` / delivery status mutations reachable from bulk paths and remove/replace them.

## 5. Out of scope

- No changes to Delivery Management functionality (only the toolbar refactor to use the shared component).
- No new routes, no Passenger Experience work.

## Technical notes

- Files touched:
  - Add: `src/components/bulk/bulk-toolbar.tsx`
  - Edit: `src/routes/delivery.index.tsx` (swap inline toolbar for shared component)
  - Edit: `src/routes/lost-found.index.tsx` (replace `BulkActions` dropdown with shared toolbar; wire Assign Delivery to new store action; add Assign Officer + Change Priority dialogs)
  - Edit: `src/lib/store.ts` (add `bulkAssignDelivery` that routes through existing `Ready for Delivery` transition)
- No schema, RLS, or Supabase changes.
- No new notification templates — engine reuses the existing `DELIVERY_APPROVED` passenger notification.