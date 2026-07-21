## Lost & Found Status Terminology — Airport-Neutral Update

Scope: Lost & Found module only. No changes to Workflow Engine, Delivery, Notifications, or Database schema.

### Status changes

- **Remove:** `In Transit to Cairo`
- **Rename:** `Arrived at Cairo` → `Arrived at Airport`

Canonical L&F status list becomes:
`Open`, `Tracing`, `Located`, `Arrived at Airport`, `Waiting Customs Clearance`, `Ready for Delivery`, `Assigned Driver`, `Out for Delivery`, `Delivered`, `Closed`.

L&F-owned (user-selectable) subset:
`Open`, `Tracing`, `Located`, `Arrived at Airport`, `Waiting Customs Clearance`, `Ready for Delivery`.

### Files to update

1. **`src/lib/lost-found/statuses.ts`** — single source of truth
   - Remove `"In Transit to Cairo"` from `LF_STATUSES` and `LF_OWNED_STATUSES`.
   - Rename `"Arrived at Cairo"` → `"Arrived at Airport"` in `LF_STATUSES`, `LF_OWNED_STATUSES`, `LF_STATUS_COLOR`, and `LF_TO_WORKFLOW` (both map to existing workflow states — `Arrived at Airport` → `DELIVERY_APPROVED`, matching prior `Arrived at Cairo`).
   - `LF_STATUS_ORDER` regenerates automatically from `LF_STATUSES`.

2. **Migration of any persisted values** (in-memory only, no DB migration)
   - Add a one-time normalizer in the L&F store hydration path so any existing case with `lfStatus === "In Transit to Cairo"` or `"Arrived at Cairo"` is coerced to `"Arrived at Airport"` on load. Keeps historical data valid without a SQL migration.

3. **Consumers** — no code changes expected because they read from `LF_STATUSES` / `LF_OWNED_STATUSES` / `LF_STATUS_COLOR`:
   - `src/components/lost-found/status-stepper.tsx`
   - `src/components/lf-status-badge.tsx`
   - `src/routes/lost-found.index.tsx` (filters, table, Change Status dropdown)
   - `src/routes/lost-found.$bagId.tsx` (Change Status dialog)
   - Bulk toolbar Change Status action

   Grep will confirm no hardcoded `"In Transit to Cairo"` or `"Arrived at Cairo"` strings remain; any found will be updated or removed.

### Verification

- Grep the repo for `"In Transit to Cairo"` and `"Arrived at Cairo"` — must return zero matches after the change.
- Open L&F case → Change Status: dropdown shows the new 6-item owned list.
- Bulk selection → Change Status: same 6-item list.
- Filter dropdown on L&F index: same list.
- Status badges render `Arrived at Airport` with existing blue styling.
- Existing cases previously in `In Transit to Cairo` or `Arrived at Cairo` render as `Arrived at Airport`.

### Deliverable summary (post-implementation)

- Removed: `In Transit to Cairo`
- Renamed: `Arrived at Cairo` → `Arrived at Airport`
- Files touched: `src/lib/lost-found/statuses.ts` (+ store hydration normalizer if the store references legacy values directly)
- Confirmation: single canonical list drives every L&F dropdown, filter, badge, and bulk action.
