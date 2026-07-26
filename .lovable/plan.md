## Goal
Apply two small UI refinements to `src/routes/feedback.tsx`. No workflow, database, engine, reporting, or business logic changes.

## Changes

### 1. Remove the “Detractors” KPI Card
- Delete the fifth KPI card (`Detractors (≤2★)`) from the KPI grid.
- Adjust the grid layout from 5 columns to 4 columns (`grid-cols-2 md:grid-cols-4`).
- Remove any now-unused `detractors` calculation if it is no longer referenced elsewhere on the page.

### 2. Simplify the Date Filters
- Replace the browser-default `dd/mm/yyyy` placeholder on the From/To date inputs with a visually empty state.
- Implement by wrapping each `<input type="date">` in a relative container and overlaying `__/__/____` text that is hidden once a value is selected or the input is focused.
- Keep the native date picker opening on click exactly as today.
- Do not change the filtering logic, state variables, or event handlers.

## Files Modified
- `src/routes/feedback.tsx`

## Not Touched
- Workflow Engine, Notification Engine, Delivery Engine, Timeline Engine, Audit Engine
- Database schema or queries
- Reporting/export logic
- Other KPI calculations (Avg Rating, Total Responses, Issue Resolved, Today)
- Filter behavior or state management