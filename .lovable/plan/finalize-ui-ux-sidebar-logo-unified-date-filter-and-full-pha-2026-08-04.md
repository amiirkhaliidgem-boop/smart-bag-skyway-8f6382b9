# Finalize UI/UX — Sidebar, Logo, Unified Date Filter, and Full-Phase Plan

## 1. Sidebar auto-collapse on every device

Today the drawer only closes automatically below 1024px. Change it so selecting any module collapses the sidebar on desktop and tablet too:

- Clicking a nav item closes the mobile/tablet drawer and sets the desktop sidebar to the collapsed icon rail.
- Clicking the logo re-opens it (already the toggle).
- Content reflows to full width immediately; the collapsed rail keeps icons + tooltips, no layout jump.
- The persisted preference stops fighting this: the stored value only controls the initial state on first paint.

Standard navigation behavior across the whole app.

## 2. Sidebar logo alignment

Center the logo tile on the same vertical center line as every nav icon (identical left padding and icon box size as `SidebarMenuButton`), so in both expanded and collapsed states it lines up exactly with the icons below.

## 3. One shared Date Range Filter everywhere

Add a selected-range display to the shared component (e.g. "3 Aug – 4 Aug 2026") rendered next to the controls, exactly as it should read on Dashboard and Reports, then make every module use it with no local variation:

Already using it (will inherit the range label automatically): Dashboard, Reports, Lost & Found, Delivery Management, Notification Center, Activity Timeline, Feedback.

Still to convert: Workflow Monitor, Quality, Agent Monitoring, API Status — each gets from/to state wired into its existing data filtering, replacing any ad-hoc controls.

Identical layout, spacing, control heights, presets, From/To inputs, grain selector and responsive wrapping in all modules; module-specific selects are passed as children so they share the same rhythm.

## 4. Answer: validation access

Your project uses an external/BYO Supabase, so Lovable cannot mint a staff session for me — signing in on your side does not hand me a token, and I should not take pasted passwords. What I can do end-to-end today: public routes (`/auth`, Passenger Portal by token), database-level verification through direct SQL, and server-function checks. To validate authenticated screens visually I would need the project switched to Lovable-managed Supabase auth, or a temporary read-only staff account on a throwaway environment. Otherwise I verify authenticated pages by rendering them against real data via the database plus code-level review.

## 5. Answer: why "Phase 01" — and the plan to finish all UI/UX now

"Phase 01" was only the label for the shell + design-system pass. Consolidating everything into one finalization step:

1. Shell & navigation (this round): sidebar behavior, logo, header.
2. Shared primitives audit: every page uses PageHeader, KpiCard, SectionCard, DataTable, DateRangeFilter — no bespoke headers, cards, tables or filters left.
3. Token discipline: remove any hardcoded colors/spacing; all states (active/hover/focus/disabled/loading/empty/error) standardized.
4. Data-density pass: tables get sticky headers, pagination, mobile card fallback; charts get responsive heights and legends that wrap.
5. Forms & dialogs: consistent field heights, labels, validation text, footer button order, full-screen behavior on mobile.
6. Responsive validation across 390, 430, 768, 834, 1024, 1440, 1920, 2560 with screenshots per module, fixing overflow and truncation as found.

Presentation layer only — no workflow, backend, database or business-logic changes.

---

# Approved scope update (single continuous UI/UX stream)

No more phases. UI/UX is treated as one continuous work stream until every screen is production-ready on Desktop, Tablet and Mobile. Execution order:

1. **Shell & navigation** — sidebar auto-collapse on every device, logo centered on the icon axis, single shared header.
2. **Shared primitives audit** — every page uses PageHeader, KpiCard, SectionCard, DataTable, DateRangeFilter. No bespoke headers, cards, tables or filters remain (starting with Workflow Monitor, Agent Monitoring, API Status, Quality, Admin, Settings, Integrations).
3. **Token discipline** — remove hardcoded colors/spacing (amber/emerald/indigo/rose/slate literals in Workflow Monitor, API Status, Reports, Timeline) in favour of semantic tokens; standardize active/hover/focus/disabled/loading/empty/error states.
4. **Data density** — sticky headers, pagination, mobile card fallback on every table; responsive chart heights and wrapping legends.
5. **Forms & dialogs** — consistent field heights, labels, validation text, footer button order, full-screen behavior on mobile.
6. **Responsive validation** — 390, 430, 768, 834, 1024, 1440, 1920, 2560 with screenshots per module; overflow and truncation fixed as found.

## Authenticated visual validation — what I need from you

This project uses an external (BYO) Supabase, so Lovable cannot mint a staff session for me automatically; I currently can only reach public routes (`/auth`, Passenger Portal by token) plus direct SQL. To validate as a real end user I need one of these:

- **Preferred:** create a temporary read-only QA staff account in Administration (role with view access, no mutations), then store its credentials as project secrets named `QA_USER` and `QA_PASS`. I read them from the environment inside the browser automation, never print them, and delete the account after sign-off.
- Alternative: a separate staging environment with the same seed data and a QA login.

With that in place the final sign-off is done against the running application — navigation, responsive behavior, tables, filters, forms, dialogs, dashboards, workflow screens, Driver Portal, Passenger Portal, notifications, timeline and reports — with screenshots per module and breakpoint, not source-code inspection.
