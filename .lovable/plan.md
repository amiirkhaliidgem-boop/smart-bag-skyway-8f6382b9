## Lost & Found – UI Cleanup

Scope: UI-only tweaks in `src/routes/lost-found.index.tsx`. No backend, store, workflow, or filter logic changes.

### 1. Reorder Filter Bar Controls
Current order: Search → Status → From → To → Reset → Columns  
Target order: Search → Status → From → To → Columns → Reset

- Move the Reset button out of the date-input group and place it immediately after the Columns dropdown.
- Keep the Reset button's existing `variant="ghost"` style and `resetFilters` handler.
- Preserve the `ml-auto` spacer so the Columns + Reset group stays right-aligned while the earlier controls stay left-aligned.

### 2. Simplify Search Placeholder
- Change the search `Input` placeholder from `"Search PIR, passenger, tag, PNR, phone…"` to `"Search"`.
- No other search behavior changes.

### 3. Remove Page Subtitle
- Delete the descriptive `<p>` element under the `Lost & Found Management` heading:
  > "AHL / PIR registry — tracing, customs clearance, and delivery assignment across the IAB ground handling network."
- Keep the `<h1>` and the Import / New PIR Case buttons exactly as they are.

### 4. Verify
- Run the project build/typecheck.
- Confirm in the preview that the filter bar reads: Search → Status → From → To → Columns → Reset, the search placeholder is "Search", and the subtitle is gone.

No other files will be modified.