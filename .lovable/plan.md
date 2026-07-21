## Plan: Simplify Lost & Found Filters Bar

Scope: UI-only cleanup in `src/routes/lost-found.index.tsx`. No backend, store, workflow, or API changes.

### 1. Remove Advanced Filters
- Delete the entire Advanced Filters `Popover` block (button + popover content with Officer, Station, Priority, Delivery Method, Created By, VIP Only).
- Remove now-unused imports: `Popover`, `PopoverTrigger`, `PopoverContent`, `SlidersHorizontal`.
- Remove the `activeAdvanced` helper and the advanced-filter state variables (`priority`, `method`, `officer`, `station`, `createdBy`, `vipOnly`) plus their `useMemo` option lists, since the UI to set them will be gone.
- Remove the advanced-filter branches from the `filtered` `useMemo` and from `resetFilters`.

### 2. Move Reset
- Keep the Reset button and its `resetFilters` handler.
- Move it so it sits immediately after the From/To date inputs, as the last control on the left side of the filter row.
- Keep the right-side Columns dropdown in its current position.

### 3. Simplify Date Filter Placeholders
- Keep the From/To `Input type="date"` fields and their `onChange` handlers.
- Make the inputs visually empty when no date is selected by suppressing the browser’s default `dd/mm/yyyy` placeholder text (conditional transparent text utility while empty).
- Calendar picker behavior remains unchanged.

### 4. Verify
- Build/typecheck the project.
- Confirm in the preview that the filter row shows: Search → Status → From → To → Reset, then Columns on the right, with no Advanced Filters button and empty date inputs until a date is picked.

No other files will be modified.