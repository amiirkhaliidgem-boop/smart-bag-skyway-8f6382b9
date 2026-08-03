# Phase 01 UI Polish — Sidebar, Unified Date Filter, Clean Headers

## 1. Sidebar behaves like a modern enterprise app

- Remove the logo + "Smart Baggage Ecosystem" block from the top header bar; the logo lives only in the sidebar.
- The sidebar logo becomes the toggle: clicking it collapses/expands on desktop and opens/closes the drawer on tablet/mobile. The separate trigger button in the header is removed on desktop and kept only as a way to re-open the sidebar when collapsed/closed (icon rail on desktop, a small menu button on mobile).
- Tablet & mobile: selecting any module closes the drawer immediately and the content takes full width (the auto-close already exists on route change; it is extended to fire on click so it feels instant, and tablet is included via the 1024px breakpoint).
- Desktop keeps the current collapsible icon-rail behaviour and the persisted open/closed state.

## 2. One shared Date Range filter for the whole system

Promote the Reports/Dashboard filter into a single reusable component (`src/components/filters/date-range-filter.tsx`), containing:

- Quick presets: Today / 7 days / 30 days
- From and To date inputs
- Grain selector: Daily / Weekly / Monthly
- The selected range always rendered next to the controls
- One consistent spacing/height/wrapping behaviour, responsive down to 390px

Adopted by: Executive Dashboard, Reports, Lost & Found, Delivery Management, Notification Center, Activity Timeline, Workflow Monitor, Feedback, Quality, Agent Monitoring, API Status. Existing ad-hoc date inputs in those pages are deleted, and each page passes its own state in — no duplicated filter markup anywhere. Modules that don't need a grain can hide it via a prop, but the layout stays identical.

## 3. Remove module subtitles

Delete the description line under every page title (Lost & Found, Executive Dashboard, Reports, Integration Center, System Settings, API Status, and all remaining modules). Section-level card descriptions inside a page stay — only the top-of-page subtitles go.

## Technical notes

- `src/components/app-shell.tsx`: header simplified, sidebar header wrapped in a button calling `toggleSidebar()` / `setOpenMobile(false)`; nav links close the mobile drawer on click.
- `src/components/filters/date-range-filter.tsx`: rewritten to own presets + grain + range label; typed props `{ from, to, grain?, onFromChange, onToChange, onGrainChange?, showGrain? }`.
- `src/components/layout/page-header.tsx`: `description` prop dropped from all call sites (prop itself can remain for internal states such as error/empty).
- No backend, workflow, RPC or data-layer changes.
