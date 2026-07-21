## Scope
Fix Edit PIR only. Do NOT touch workflow, timeline, notifications, audit, or any status logic. Single file: `src/components/lost-found/pir-wizard.tsx`.

## Root cause
`PirWizard` treats every step as locked until the previous one passes `validateStep()`. This sequential gate was designed for Create (fresh intake), but it is reused as-is for Edit. Result: opening Edit PIR on any existing case surfaces "Complete the previous steps first" whenever a legacy/optional field is missing, even though Edit PIR is not a workflow transition.

## Change (edit mode only — create flow untouched)

In `src/components/lost-found/pir-wizard.tsx`:

1. Make step locking conditional on mode. In the stepper (l. 350–385), compute `locked = mode === "create" && i > step`. In `create` mode nothing changes; in `edit` mode every step is freely reachable (no lock icon, no disabled button, no "Complete the previous steps first" tooltip).

2. In `goToStep` (l. 223–238), when `mode === "edit"` jump directly to the target step without running `validateStep` on the intermediate steps. Create mode keeps its current sequential gate.

3. Leave `next()` / `validateStep()` untouched — the Next button in edit mode still nudges the user through missing required fields, but it is no longer the only way to move.

4. Leave `submit()` and `canSubmit` untouched. Saving still requires the same core required fields (names, PIR, mobile, airline, flight, bag tags, address). `editCase` already preserves workflow status (see `l. 344` header copy), so no store change is needed.

## Explicitly NOT changing
- `src/lib/store.ts`, workflow engine, `editCase`, LF status handlers.
- Create flow (new PIR intake keeps sequential gate).
- Any other route, notification, timeline, or audit code path.

## Result
Edit PIR opens on any case at any lifecycle stage (Open → Closed), all 5 steps immediately clickable, no "Complete the previous steps first" message. Saving still validates required fields and preserves the current workflow stage.