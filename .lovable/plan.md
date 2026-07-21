## Goal

Replace the current `window.print()` behavior (which prints the visible app UI) with a dedicated **PIR Report Template** that generates a clean, standalone printable document — usable for single-case Print PIR and bulk Print of selected cases, and reusable for future Save/Email/Export PDF.

## Deliverables

### 1. New PIR Report Template component
`src/components/lost-found/pir-report.tsx`

A pure, presentational React component that renders one case as a print-formatted document. No app chrome, no interactive controls, no navigation.

Sections (data-only, all pulled from `BaggageCase` + related workflow/delivery records):
- **Header**: IAB logo, "Property Irregularity Report", PIR number, Bag ID, generated timestamp
- **Case Meta**: Status, Priority, Created, Last Updated, Assigned Officer
- **Passenger Information**: Full name, Mobile 1/2, Email, PNR
- **Flight Information**: Airline, Flight No., Flight Date, Origin, Destination
- **Baggage Information**: Bag Tag(s), Color, Type, Weight, Contents description
- **Delivery Information**: Method, Full Address, Notes
- **Lifecycle**: Compact status trail (Open → … → current)
- **Signatures block**: Passenger signature / Officer signature / Date lines
- **Footer**: Case reference, page number placeholder, "IAB Smart Baggage Ecosystem"

Styling is scoped via a single `pir-print` root class defined in `src/styles.css` (A4 page setup, print-safe fonts, black-on-white, page-break rules). No Tailwind color tokens that render poorly in print.

### 2. Print host route
`src/routes/print.pir.tsx` — new route at `/print/pir?ids=BAG-100248,BAG-100247,...`

- Reads case IDs from search params (single or multiple).
- Resolves each case from the store.
- Renders `<PirReport case={…} />` per ID, wrapped in a container that forces `page-break-after: always` between reports.
- On mount: waits for fonts/images to load, then calls `window.print()` automatically.
- Uses a minimal layout that does NOT include the app shell (sidebar/header). The route sets its own head and renders only the report body.

This keeps the "print template" completely independent from the application UI — the browser print dialog sees only the report markup.

### 3. Wire up Single Print
`src/routes/lost-found.$bagId.tsx`
- Replace `printPir()` (currently `window.print()`) with `window.open('/print/pir?ids=' + bagId, '_blank')`.

### 4. Wire up Bulk Print
`src/routes/lost-found.index.tsx`
- Replace `runPrint()` (currently `window.print()`) with `window.open('/print/pir?ids=' + selectedIds.join(','), '_blank')`.
- Behavior: one document, one print dialog, each PIR starts on a new page.

### 5. Reusable pieces
- `PirReport` — the template, reusable for future "Save as PDF" (same route, user picks Save as PDF in dialog), "Email PDF" (server can render this component to PDF later), "Export PDF" (bulk export).
- Print-only CSS block in `src/styles.css` under `@media print` scoped to `.pir-print`.

## Out of scope
- No changes to Workflow Engine, store, Supabase, notifications, timeline, audit.
- No server-side PDF generation yet (the template is designed so a future server function can render it, but that work is not part of this change).
- No redesign of the Lost & Found UI beyond swapping the two print handlers.

## Summary provided after implementation
- New report template: `PirReport`
- New print host route: `/print/pir`
- Single Print: opens print route with one ID
- Bulk Print: opens print route with N IDs, one page per PIR
- Reusable component ready for Save/Email/Export PDF flows
