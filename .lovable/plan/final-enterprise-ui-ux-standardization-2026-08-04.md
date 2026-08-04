# Final Enterprise UI/UX Standardization

One continuous pass, validated against the running authenticated app with the QA account. No further UI phases after this.

## 1. Sidebar logo alignment (measured, not eyeballed)

Current markup uses a 32px logo tile inside a `p-2` header button, while nav icons are 16px inside a `p-2` menu button. That puts the logo centre at 24px from the sidebar edge and the icon centre at 16px when expanded — an 8px offset, and the offset differs again in the collapsed icon rail (where buttons are 32px wide).

Fix: drive the logo tile off the same geometry tokens as `SidebarMenuButton`, with separate expanded/collapsed offsets so its centre line lands exactly on the icon centre line in both states. Verified by reading real `getBoundingClientRect()` centres in the browser at desktop, tablet and mobile — target delta 0px, not "looks centred".

## 2. One Enterprise Data Table everywhere

`src/components/layout/data-table.tsx` becomes the only table in the system, retuned to match the Activity Timeline visual rhythm (row height, header height, typography, spacing, hover, sticky header, pagination, sorting, selection, mobile card fallback, loading and empty states).

Modules still rendering bespoke `<table>` markup, all converted:

- Notification Center
- Workflow Monitor
- Reports (operational + quality tables)
- Feedback
- Delivery Details (per-delivery tables)
- Integrations
- Quality, API Status, Agent Monitoring, Administration list views

Lost & Found and Delivery Management already use it and are re-checked against the retuned baseline.

## 3. Date Range Filter — identical in every module

Dashboard/Reports is the standard. Every module renders the same component with: Today / 7 days / 30 days, From, To, grain selector where applicable, and a visible selected-range chip that never reads blank once dates are set. Modules currently mounting it with reduced props or their own wrappers (Lost & Found, Delivery, Notifications, Timeline, Workflow Monitor, Feedback, Quality, Agent Monitoring, API Status) are aligned to the same prop set, spacing and wrapping. Any module without a default range gets one so From/To are never empty.

## 4. Global polish pass

Standardize across all screens: page-header rhythm, section and card spacing, KPI card sizing, typography scale, icon sizes and alignment, control heights (buttons, inputs, selects at h-9), badge and chip styles, and hover / focus / active / disabled / loading / empty states. Replace remaining hardcoded colour literals with semantic tokens.

## 5. Full authenticated validation sweep

Playwright with the QA account across 390, 430, 768, 834, 1024, 1440, 1920, 2560 for: Executive Dashboard, Lost & Found, Delivery Management, Delivery Details, Driver Portal, Passenger Portal, Activity Timeline, Workflow Monitor, Notification Center, Reports, Feedback, Quality, Administration, API Status, Settings, Integrations, Agent Monitoring.

Per module and breakpoint: horizontal overflow (scrollWidth vs clientWidth), header/filter/table/dialog layout, sidebar behaviour, console errors. Every issue found is fixed in the same pass and re-verified, ending with a PASS / FIXED table per module.

## Scope

Presentation layer only — no workflow, RPC, database or business-logic changes.
