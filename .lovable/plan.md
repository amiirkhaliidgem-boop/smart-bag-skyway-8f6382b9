## Scope
UI-only cleanup for Lost & Found KPIs and app-wide "Cairo International Airport" branding removal beside the logo. No business logic or workflow changes.

## Changes

### 1. Remove "VIP Passengers" KPI card
- `src/routes/lost-found.index.tsx`: delete the `<Kpi label="VIP Passengers" .../>` card (line 292). The KPI grid already uses responsive `grid-cols` and will redistribute the remaining 5 cards evenly (adjust grid column count if needed so the row stays balanced, e.g. `lg:grid-cols-5`).

### 2. Remove "Cairo International Airport" beside the logo / in branding
Remove the airport name only from user-visible branding, headers, and page metadata. Keep the logo.

- `src/components/app-shell.tsx` (line 245): remove the `Cairo International Airport` subtitle above "Smart Baggage Ecosystem" in the top header.
- `src/routes/__root.tsx` (line 88): change default `<title>` to `Smart Baggage Ecosystem` (drop the em-dash suffix).
- `src/routes/index.tsx`:
  - line 33: update meta description to drop "at Cairo International Airport".
  - line 130: change subtitle to `Live baggage operations overview`.
- `src/routes/lost-found.index.tsx` (line 76): update the description meta to drop "for Cairo International Airport".
- `src/components/lost-found/pir-report.tsx` (line 82): change the print header line from `Cairo International Airport — Ground Handling` to `Smart Baggage Ecosystem — Ground Handling`.

### 3. Shared Header component
The header already lives in a single shared component: `src/components/app-shell.tsx` (rendered by `__root.tsx` via `<AppShell />` for all authenticated modules). No refactor needed — editing that one file updates every module's header. The Auth screen and Passenger Portal intentionally use their own headers (no airport text present) and remain untouched.

## Explicitly NOT changed (operational data, not branding)
- `src/lib/admin/data.ts` station/team records — real station master data.
- `src/lib/store.ts` line 305 station name — operational station record.
- `src/routes/timeline.tsx` line 293 — historical event description referring to a physical airport location.
- `src/lib/routing/optimize.ts` — code comment describing the routing anchor.
- `src/components/lost-found/pir-wizard.tsx` — station code `CAI - Cairo International Airport` is a station selector value, not branding.

These are data/labels for the physical station "CAI", not the app's brand name.
