# Final Mobile Polish — Header Trigger + Unified Filter Bar

Visual-only, mobile breakpoints only. No backend, workflow, routing, auth, data or action changes. Desktop (`sm:` / `lg:` and above) stays exactly as approved.

## 1. Mobile header — logo opens the sidebar

In `src/components/app-shell.tsx` (mobile branch only, `lg:hidden`):

- Wrap the IAB logo tile in the existing `SidebarTrigger` (`asChild`) so tapping the logo opens the same sidebar drawer. No new navigation, no duplicated menu, no changed items.
- Keep a single tap target: logo tile + trigger become one button with an accessible "Open navigation" label, sized for touch (min 44px).
- Show "IAB Smart Baggage Ecosystem" next to the logo on mobile, truncating gracefully on very narrow screens (logo never shrinks). The existing absolutely-centered desktop title stays untouched and remains desktop-only.

## 2. Header consistency

All authenticated modules already share this one header, so the change above applies everywhere at once. The Delivery Agent Portal header (`driver-shell.tsx`) already uses the navy sidebar surface, logo tile and matching spacing — only its title line will be aligned to the same wording/typography treatment as the main header on mobile.

## 3. Unified mobile filter bar

`src/components/filters/date-range-filter.tsx` is the shared control used by Lost & Found, Delivery Dispatch, Executive Dashboard, Reports, Agent Monitoring, Timeline, Notifications, Workflow Monitor, Feedback and API Status. Compacting it fixes all of them at once.

Mobile layout (default styles; every current desktop style pinned behind `sm:`):

```text
[ Today ][ 7 days ][ 30 days ][ All dates ]   <- 4-up equal grid, one row
From [ 05/08/2026 ]  To [ 11/08/2026 ]        <- one row, equal widths
[ module filters ]                             <- full-width, stacked
[ 5 Aug 2026 – 11 Aug 2026 ]                   <- compact summary chip
```

- Tighter gaps (`gap-1.5`), smaller control height (`h-9`) and `text-xs` labels on mobile; unchanged sizes from `sm:` up.
- Preset buttons become an equal-width grid instead of wrapping unevenly.
- From/To inputs share one row with `min-w-0` so the date text and native dropdown arrow stay visible and never overflow.
- Selected-range chip shrinks to a single compact line under the controls on mobile.

## 4. Per-module filter wrappers

Where a module wraps the filter in its own card/row (search input, module selects, Reset), only the mobile classes are adjusted so the order reads Search → quick dates → From/To → additional filters → Reset, all full-width and stacked, with reduced card padding on mobile. No filter is added, removed or re-wired.

## Verification

- Playwright at 393x756 on Lost & Found, Delivery Dispatch, Reports, Agent Monitoring, Feedback and Timeline: assert `scrollWidth <= clientWidth`, screenshot the filter block, confirm the logo tap opens the drawer.
- Same routes at 1440 wide compared against current desktop to confirm zero visual change.

## Files touched

`src/components/app-shell.tsx`, `src/components/filters/date-range-filter.tsx`, `src/components/driver-shell.tsx`, plus mobile-only class tweaks in the filter rows of `lost-found.index.tsx`, `delivery.index.tsx`, `reports.tsx`, `agent-monitoring.tsx`, `timeline.tsx`, `notifications.tsx`, `workflow-monitor.tsx`, `feedback-dashboard.tsx`, `index.tsx`.
