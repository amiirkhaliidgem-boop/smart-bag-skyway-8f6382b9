## L&F Case Details — Remove Documents, Timeline, Audit tabs (UI only)

Scope: `src/routes/lost-found.$bagId.tsx` only. No changes to engines, database, or shared components.

### Changes

1. **Remove Documents tab**
   - Delete the `"documents"` entry from the tabs list.
   - Delete the Documents tab panel and its `DocumentsTab`/upload UI (Upload section, Attach button, file list).
   - Remove now-unused imports (e.g. `Paperclip`/`Upload` icons, any document helpers used only here).

2. **Remove Timeline tab (UI only)**
   - Delete the `"timeline"` entry from the tabs list and its tab panel from this route.
   - Do NOT touch `src/routes/timeline.tsx`, timeline emit calls in `src/lib/store.ts`, or any Timeline data. Delivery, Driver, Passenger, Workflow, Contact Center, and Admin continue to render/consume timeline as-is.

3. **Remove Audit tab (UI only)**
   - Delete the `"audit"` entry from the tabs list and its panel from this route.
   - Do NOT touch `src/lib/audit/log.ts`, audit writes across the store, or any Admin/Quality audit views.

4. **Cleanup**
   - Default active tab remains `"overview"`.
   - Remove any local state, helpers, or imports that become unused after the three panels are gone.

### Resulting tabs (in order)

Overview · Passenger · Flight · Baggage · Delivery · Communication

### Non-goals

- No changes to any other route, engine, migration, or shared component.
- Timeline and Audit remain fully functional everywhere else and continue to be written on every L&F action.

### Verification

- L&F Case Details shows exactly the 6 tabs above; Documents/Timeline/Audit are gone.
- Performing an L&F status change still produces Timeline entries (visible in `/timeline`) and Audit entries (visible in Admin/Audit views).
- No unused-import or dead-code TS errors.
