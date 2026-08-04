# Final Enterprise UI/UX Polishing (Global)

Passenger Portal is frozen — no changes to `/passenger/*`. Everything below is the internal staff UI only.

## 1. Date Range Filter always shows real dates

Today most modules mount the shared filter with empty `from`/`to`, so the browser renders `dd/mm/yyyy`. Every module gets the same default range: **last 7 days** (today − 6 → today), which is already the Dashboard/Reports behaviour.

- A single shared default helper (e.g. `defaultRange()` / `useDateRange()` exported alongside the filter) becomes the initial state for: Executive Dashboard, Reports, Lost & Found, Delivery Management, Notification Center, Activity Timeline, Workflow Monitor, Feedback, Quality, Agent Monitoring, API Status.
- No module keeps `useState("")` for a date bound to the shared filter.
- The visible range chip therefore always reads a real range (e.g. `29 Jul – 4 Aug 2026`).

Note on behaviour: modules that currently default to "all dates" will now show the last 7 days on first load. A **Clear / All dates** control stays available in the filter so operators can widen back to the full history in one click.

## 2. Global header redesign

The header becomes a three-zone bar that reads as one unit with the sidebar:

```text
[toggle] User Name              IAB Smart Baggage Center              [Sign out]
         • System Online
```

- **Left:** user name (display name, falling back to the account identifier) with the green `System Online` dot underneath. The role line (`Airport Administrator`) is removed entirely from the header.
- **Center:** `IAB Smart Baggage Center`, absolutely centered so it stays centered at any width independent of the left/right zone widths; truncates gracefully and hides below `sm` where there is no room.
- **Styling:** dark navy header surface with white typography, using the same sidebar tokens as the navigation so header and sidebar form one continuous navy shell. The sign-out button and toggle are restyled for the navy surface (white text, subtle border/hover), keeping `h-9` control height.

## 3. Sidebar role badge

The role indicator loses its filled pill: transparent background, no border, plain white/near-white text at the same small size, blending into the sidebar.

## 4. Continue enterprise standardization

One pass over every remaining module to remove per-page differences in: page headers (all via `PageHeader`), filters (all via the shared `DateRangeFilter`), tables (all via `DataTable` — sticky header, pagination, sorting, selection, mobile card fallback), KPI and section cards, forms and dialogs (field/control heights, label and validation styling, footer button order, full-screen on mobile), spacing rhythm, typography scale, icon sizes, button hierarchy, and hover / focus / loading / empty / disabled states. Any remaining hardcoded colour literals are replaced with semantic tokens.

## 5. Final authenticated validation

Playwright sweep with the QA account across 390, 430, 768, 834, 1024, 1440, 1920, 2560 for every module (Dashboard, Lost & Found, Delivery Management, Delivery Details, Activity Timeline, Workflow Monitor, Notification Center, Reports, Feedback, Quality, Administration, API Status, Settings, Integrations, Agent Monitoring), checking header centering, sidebar behaviour, date-filter values, horizontal overflow and console errors — fixing what is found and ending with a PASS / FIXED table per module.

## Scope

Presentation layer only — no workflow, RPC, database or business-logic changes.
