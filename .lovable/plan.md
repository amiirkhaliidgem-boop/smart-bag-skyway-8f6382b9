## Current state (verified)

There is no shared date-filter component today. Lost & Found (`src/routes/lost-found.index.tsx:362-377`) and Delivery Management (`src/routes/delivery.index.tsx:280-292`) each render the same inline markup: a `From` / `To` label pair with `<Input type="date" className="h-9 w-[145px]">`, plus a `[&::-webkit-datetime-edit]:text-transparent` class that hides `dd/mm/yyyy` until a date is picked. Feedback (`src/routes/feedback.tsx`) uses a different local `DateFilterInput` that swaps input type on focus and shows a `__/__/____` placeholder.

## Changes

### 1. Extract the existing pattern into one shared component
- Add `src/components/filters/date-range-filter.tsx` exporting `DateRangeFilter` with props `from`, `to`, `onFromChange`, `onToChange`.
- Its markup is copied verbatim from the current Lost & Found implementation, so the rendered result is pixel-identical to today's L&F / Delivery filters.

### 2. Use it in all three modules
- Feedback: delete the local `DateFilterInput` and render `<DateRangeFilter>` in its place, wired to the existing `from`/`to` state.
- Lost & Found and Delivery: replace their inline blocks with the same component (no visual change) so there is exactly one implementation.

## Not touched
- Filtering logic, state variables, handlers
- KPIs, reporting, export
- Workflow / Notification / Delivery / Timeline / Audit engines
- Database
