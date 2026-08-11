# Mobile UI/UX Polish + Delivery Agent Portal Header

Visual-only work, scoped to mobile breakpoints. No backend, workflow, routing, auth or business-logic changes. Desktop (`sm:` and above) stays byte-for-byte in behaviour and appearance.

## 1. Delivery Agent Portal header (desktop + mobile)

The agent portal header is currently a white/card bar, unlike every other module which uses the navy sidebar surface.

- Restyle `src/components/driver-shell.tsx` header to the system pattern: `bg-sidebar` / `text-sidebar-foreground` / `border-sidebar-border`, same 56px height and sticky behaviour as the main app header.
- Keep the IAB logo tile in the same style as the sidebar header (white rounded tile, ring).
- Language toggle and Sign out buttons get sidebar-surface variants (transparent with sidebar border), matching the main header's Sign out button.
- No change to navigation items, agent name, language switching, RTL, or any action.

## 2. Mobile layout polish

Minimum responsive adjustments, all behind default/`max-sm` styles:

- **Page header** (`page-header.tsx`): let the title wrap on very small screens instead of truncating mid-word ("Lost ..." in the screenshot), and stack action buttons full-width under the title on mobile.
- **Shell padding** (`app-shell.tsx`): reduce main content padding on the smallest widths (`p-3`) and ensure `overflow-x-hidden` on the content column so no page can produce horizontal scroll.
- **KPI grid** (`kpi-card.tsx`): keep 2-up on mobile but tighten gap and font sizes so cards do not feel oversized (the screenshot shows very large mobile KPI text/height).
- **Data tables** (`data-table.tsx`): verify the mobile card fallback is active on the L&F and Delivery lists; constrain the toolbar (search, filters, actions) to stack full-width on mobile and keep bulk-action toolbars horizontally scrollable rather than overflowing.
- **Dialogs** (`ui/dialog.tsx`): add mobile-safe sizing — `max-w-[calc(100vw-1.5rem)]`, `max-h-[90dvh]` with internal scroll, reduced padding on mobile — so Case Details dialogs and the PIR Wizard fit the viewport with footers reachable.
- **PIR Wizard**: make the step rail and footer buttons wrap/stack on mobile; body scrolls inside the dialog.
- **Driver portal body**: stop cards — stack the meta row and action buttons, allow full-width buttons on mobile.

## 3. Mobile navigation

The sidebar already opens as an off-canvas drawer via `SidebarTrigger`. Change: place the IAB logo tile next to the trigger in the mobile header so the logo/menu area is the visible anchor, and the drawer reads as the same application. Desktop header unchanged (`lg:hidden` scoping).

## Verification

- Playwright screenshots at 390x844 for Lost & Found, Delivery Dispatch, Case Details, PIR Wizard, Driver Portal: check no horizontal overflow (`scrollWidth <= clientWidth`), no clipped buttons.
- Same pages at 1440 wide compared against current desktop to confirm no visual change.

## Files touched

`src/components/driver-shell.tsx`, `src/components/app-shell.tsx`, `src/components/layout/page-header.tsx`, `src/components/layout/kpi-card.tsx`, `src/components/layout/data-table.tsx`, `src/components/ui/dialog.tsx`, `src/components/lost-found/pir-wizard.tsx`, `src/routes/driver-portal.tsx` (styling only).
