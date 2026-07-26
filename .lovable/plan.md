## Goal

Replace every user-visible occurrence of "Driver" with "Delivery Agent" across the whole app (Arabic: "مندوب التسليم"). Internal identifiers, routes (`/driver-portal`), stage keys, DB fields, functions and variables stay exactly as they are — only rendered strings change. Behavior stays 100% identical.

## Scope of edits (display strings only)

1. Delivery Agent Portal
   - `src/components/app-shell.tsx` — sidebar item "Driver Portal" → "Delivery Agent Portal".
   - `src/routes/driver-portal.tsx` — browser title "Delivery Agent Portal — Smart Baggage Ecosystem"; any hardcoded visible label.
   - `src/lib/i18n/driver.ts` (EN + AR) — `portalTitle`, `signInTitle`, `driverLabel` → "Delivery Agent Portal" / "Delivery Agent Sign In" / "Delivery Agent" and "بوابة مندوب التسليم" / "تسجيل دخول مندوب التسليم" / "مندوب التسليم". File and type names unchanged.

2. Delivery Management
   - `src/routes/delivery.index.tsx` — table column header, driver filter/dropdown labels, bulk "Assign Driver" action label, dialog titles/labels.
   - `src/routes/delivery.$deliveryId.tsx` — "Driver" fields in Overview/Delivery tabs, assignment dialog title, select label, buttons.
   - `src/components/delivery/pod-report.tsx` — printed "Driver" label → "Delivery Agent".

3. Workflow / status display
   - `src/lib/workflow/statuses.ts` — visible EN/AR labels only: "Driver Assigned" → "Delivery Agent Assigned", "Driver Arrived" → "Delivery Agent Arrived" (AR "مندوب التسليم"). Status keys (`DRIVER_ASSIGNED`) untouched.
   - `src/lib/delivery/stages.ts` — if stage labels are rendered, add/adjust display labels only; canonical stage values ("Driver Accepted") stay unchanged in data. Where a raw stage string is rendered, map it through a display-label helper so stored values are never rewritten.

4. Other modules with visible "Driver" text
   - `src/routes/workflow-monitor.tsx` — filter placeholder + column header.
   - `src/routes/timeline.tsx` — visible module label, filter label, event titles/descriptions, detail field label (module keys stay `"Driver"` internally; only the rendered label changes).
   - `src/routes/passenger.index.tsx` / `passenger.$token.tsx` — any passenger-facing driver wording.
   - `src/routes/contact-center.tsx`, `src/routes/notifications.tsx`, `src/lib/notifications/templates.ts` — visible message/template text.
   - `src/routes/reports.tsx`, `src/routes/index.tsx` (dashboard) — chart/table/KPI labels.
   - `src/routes/settings.tsx` — template field labels ("Driver Assigned (EN)", "Push notification via Driver App").
   - `src/lib/io/registry.ts` + `src/routes/export-center.tsx` — visible column labels and module list entry "Driver Portal".
   - `src/lib/lost-found/export-xlsx.ts` — exported column header if it reads "Driver".

## Method

Enumerate every match of `Driver`/`driver`/`السائق` in `src/`, classify each as rendered-string vs identifier, and change only the rendered strings. Data values persisted to Supabase (stage names, module keys, status keys) are never rewritten — where such a value is displayed, it is translated at render time through a label map.

## Verification

- Typecheck passes.
- Grep confirms no remaining user-visible "Driver" string.
- Spot-check Delivery Agent Portal (EN + AR), Dispatch Center list/details, Timeline, and Passenger Portal in the preview.
