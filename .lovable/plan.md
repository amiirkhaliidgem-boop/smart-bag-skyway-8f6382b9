## Objective
Remove the "Export Case" action from the Lost & Found Case Details → Advance → Quick Actions menu, while preserving Print PIR and other actions.

## Current state
In `src/routes/lost-found.$bagId.tsx`:
- `Download` icon is imported on line 42.
- `exportCase()` handler is defined on lines 144-154.
- The "Export Case" `DropdownMenuItem` is rendered on lines 265-267.
- `Download` is not used anywhere else in this file.

## Changes
1. In `src/routes/lost-found.$bagId.tsx`:
   - Remove `Download` from the `lucide-react` import list.
   - Delete the `exportCase()` function.
   - Delete the Export Case `DropdownMenuItem` from the Quick Actions dropdown.

## Out of scope
- Print PIR remains unchanged.
- Bulk Export elsewhere in the module is not modified.
- Workflow Engine, Audit, Timeline, Notifications, and backend logic are untouched.

## Expected result
The Quick Actions dropdown on the Lost & Found Case Details page will contain only:
- Edit PIR
- Assign Officer
- Print PIR