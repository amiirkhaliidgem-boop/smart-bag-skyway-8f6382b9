# Final Mobile Polish — Executive Dashboard + Date Range Filter

Visual-only, mobile-breakpoint-only changes in two files. No logic, data, routing or desktop styling touched.

## 1. Shared Date Range Filter — unified preset group

In `src/components/filters/date-range-filter.tsx`:

- Give "All dates" the same `variant="outline"` treatment as Today / 7 days / 30 days, so all four render as one uniform button group (same height, border, radius, text size, padding).
- Keep the existing 4-column grid on mobile and the inline row from `sm:` up, so desktop is unchanged apart from "All dates" now matching its siblings.
- Tighten the mobile From/To row: labels and inputs stay on one line, inputs share the remaining width evenly, no overflow at 393px.
- Selected-range summary chip stays as-is, sized to match the control heights.

"All dates" still clears both dates — behaviour untouched.

## 2. Executive Dashboard mobile layout

In `src/routes/index.tsx` (dashboard only, presentation classes only):

- Header actions: date filter takes the full width on mobile with the refresh button aligned on its own row instead of being squeezed beside it; from `sm:` up the current inline arrangement is preserved.
- KPI grid: keep 2 columns on mobile with the existing compact card sizing; unchanged from `sm:` up.
- Chart cards: reduce mobile card padding slightly and let the chart containers shrink to the viewport so nothing scrolls horizontally at 393px.
- Unified Operational Pipeline rows: narrow the fixed label column on mobile so the bar and count stay visible without clipping.

No changes to queries, KPI descriptors, chart series, or any calculation.

## 3. Consistency check

Every module that renders `DateRangeFilter` (Lost & Found, Dispatch, Reports, Agent Monitoring, Timeline, Notifications, Workflow Monitor, Feedback, API Status, Dashboard) picks up the unified preset group automatically — no per-module edits.

## Verification

At 393px: no horizontal scroll, no clipped text or buttons, all four presets look like one group, dashboard matches the other modules' mobile language. Desktop at 1440px unchanged.
