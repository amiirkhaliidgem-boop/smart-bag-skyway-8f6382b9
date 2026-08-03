# Phase 01 — UI/UX Polish & Responsive Validation

Polish only. No workflow, business-logic, backend, or database changes.

## Part A — UI Audit Report (findings from reading the code)

### Navigation issues
- The sidebar in `app-shell.tsx` is hand-rolled: a fixed `w-64` panel on `lg:` and up with no collapse, no persisted state, and no animation. Tablet widths (768–1023px) fall back to the mobile drawer with no swipe support and no transition.
- The mobile drawer is a raw `fixed` div with a black overlay — no focus trap, no Escape-to-close, no body scroll lock, no slide animation. The project already ships `ui/sidebar.tsx` and `ui/sheet.tsx`, both unused here.
- The nav array is rendered twice (desktop + mobile) with duplicated markup, so every nav tweak has to be made in two places.
- Duplicate entries: "Baggage Tracking" and "Customer Feedback" each appear in two sections, and `isActive` highlights both at once.

### Layout / responsive issues
- Tables are the biggest risk. `lost-found.index`, `delivery.index` (11 columns), `admin` (4 tables), `notifications`, `workflow-monitor`, `reports`, `settings`, `integrations` all render wide tables inside `overflow-x-auto` with no sticky header, no minimum column widths, and no mobile fallback. On phones these become long horizontal scrolls with the header scrolled out of view.
- No pagination anywhere. `ui/pagination.tsx` exists but is unused; every table renders all rows, which is both a scroll and a render-cost problem as data grows.
- KPI grids are inconsistent per page: `2/3/6` on the dashboard, `2/4/8` on reports, `2/5` on delivery. At two columns on a phone the larger numbers and long labels crowd.
- Page headers repeat the same header/actions block in ~12 routes with drifting classes (`text-2xl` vs `text-2xl sm:text-3xl`, `font-bold` vs `font-semibold`).
- `min-h-screen` is used throughout instead of `min-h-dvh`, leaving a gap under mobile browser chrome.
- Header rows mixing a title and action buttons use plain `flex` without `min-w-0` / `truncate`, so long case names and emails clip instead of shrinking.

### Consistency issues
- Card padding varies (`p-4`, `p-5`, `p-6`, `py-10`, `p-8`) with no shared page/card rhythm.
- Empty states are ad-hoc one-liners repeated in 8+ files with different paddings and no icon or guidance.
- Loading states mix `ops-skeleton`, inline `Skeleton`, and plain "Loading…" text.
- Hardcoded colors leak outside the token system: 23 occurrences in `index.tsx`, 12 in `reports.tsx`, plus a few in the shell, PIR wizard, and import dialog. (The Passenger Portal's `--iab-*` brand vars are intentional and stay.)
- Icon sizes drift between `h-4 w-4`, `h-5 w-5`, and `h-3.5 w-3.5` for the same semantic role.

### Accessibility issues
- Icon-only buttons in table row-action menus and toolbars are missing `aria-label`.
- The mobile drawer overlay is a `div` with `onClick` — not keyboard reachable, and it does not trap focus.
- Tap targets in row-action menus and compact filter chips fall under 44px on mobile.
- Some status signals rely on color alone (pulse dots, chart legends) and need a paired text label.

### Performance issues
- Long tables re-render every row on any filter/selection change; row components are not memoized and selection state lives at page level.
- Charts rebuild their data arrays on each render instead of memoizing.
- `passenger.index.tsx` (1560 lines), `timeline.tsx` (1293), `reports.tsx` (1134), and `admin.tsx` (964) are single monoliths, so any state change re-renders the whole page.

---

## Part B — Implementation Plan

### 1. Shell & navigation (highest impact)
- Rebuild `app-shell.tsx` on the existing `ui/sidebar.tsx` primitives, driving one shared nav array (no duplicated markup) with identical routes and labels.
- Desktop (`lg+`): collapsible to an icon rail, state persisted in `localStorage`, tooltips on collapsed items, CSS transitions only.
- Tablet + mobile (`<lg`): `ui/sheet.tsx` overlay drawer — focus trap, Escape, scroll lock, slide animation, auto-close on navigation, edge-swipe to open/close.
- Sticky header keeps the hamburger/toggle visible at all breakpoints; de-duplicate the repeated nav entries so only one highlights.

### 2. Shared layout primitives
Add small presentational components and apply them across routes:
- `PageHeader` (title, subtitle, actions slot, responsive truncation grid).
- `DataTableShell` — scroll container with sticky header, min column widths, and a mobile card-list fallback for the widest tables (L&F, Dispatch, Admin, Notifications).
- `EmptyState` and `ErrorState` (icon + message + optional action).
- `TablePagination` built on `ui/pagination.tsx`, client-side, applied to the long tables.
- Standardize on `ops-skeleton` for all loading states.

### 3. Token & spacing pass
- Replace hardcoded color utilities in app routes with semantic tokens; add any missing tokens to `src/styles.css`. Passenger Portal brand vars untouched.
- Unify card padding, section gaps, border radius, shadow, icon sizes, and heading scale.
- Normalize KPI grids to one responsive ladder shared by dashboard, reports, delivery, L&F, and workflow monitor.

### 4. Tables, forms, dialogs
- Apply `DataTableShell` + pagination + sticky headers; keep all existing filter, sort, selection, and action behavior.
- Dialogs: cap height with internal scroll, footers stacking full-width on mobile, consistent field spacing, required-field markers, consistent validation message placement.
- Forms (PIR Wizard, delivery scheduling, admin staff, settings): consistent label/field rhythm and mobile-first single-column layout.

### 5. Mobile-first + accessibility
- `min-h-screen` → `min-h-dvh`; `min-w-0`/`truncate` on all title+action rows.
- `aria-label` on every icon-only control; `min-h-11 min-w-11` on primary mobile tap targets.
- Charts get responsive heights and readable tick density on narrow screens.

### 6. Performance
- Memoize table rows and chart data; split heavy sub-sections of `timeline`, `reports`, and `admin` into memoized child components.
- Keep animations to transform/opacity transitions only.

### 7. Final visual QA
Screen-by-screen Playwright sweep at 1440, 1280, 1024, 820, 768, 430, and 390 px across every route (dashboard, L&F list + details, delivery dispatch + details, driver portal, passenger portal, admin, settings, reports, timeline, notifications, workflow monitor, integrations, API status, agent monitoring, feedback, auth), with screenshots and a written pass/fail list. Any overflow, overlap, or clipping found is fixed in the same pass.

## Technical notes
- Files touched are presentational only: `src/components/app-shell.tsx`, new `src/components/layout/*`, and `className`/markup in route files.
- No changes to `src/lib/store.ts` data flow, `*.functions.ts`, RPCs, or SQL.
- Work lands in the order above so the shell and shared primitives exist before the per-page passes.