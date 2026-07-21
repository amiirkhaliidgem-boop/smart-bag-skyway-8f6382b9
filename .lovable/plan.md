## Objective
Simplify the Lost & Found export workflow: remove the top toolbar Export button and make "Export Selected" download a formatted Excel (.xlsx) file for the selected cases.

## Changes

### 1. `src/routes/lost-found.index.tsx`
- Replace `<ImportExportButtons ... />` in the top toolbar with an Import-only button (reuse the existing `ImportDialog` directly, or pass a new `showExport={false}` prop — see technical note). Result: only "Import" and "New PIR Case" remain in the header.
- Replace `runExportSelected()` (currently a toast placeholder) with a real handler that builds an `.xlsx` file from the selected cases and triggers a download.
- Remove now-unused `ImportExportButtons` import if fully swapped for `ImportDialog`.

### 2. New file `src/lib/lost-found/export-xlsx.ts`
- Export `exportCasesToXlsx(cases: BaggageCase[])`.
- Build one worksheet with a formatted header row (bold) and one row per case.
- Columns (in order): PIR Number, Bag ID, Bag Tag, Passenger Name, Mobile, Airline, Flight Number, Flight Date, Origin, Destination, Delivery Method, Current Status (from `deriveLfFromCase`), Assigned Officer, Priority, Created Date, Last Updated, Delivery Address, Number of Bags, Bag Color, Bag Type, Remarks.
- Dates formatted `dd/MM/yyyy` (or `dd/MM/yyyy HH:mm` for Last Updated).
- Auto-size columns based on max content length.
- Filename: `lost-found-YYYYMMDD-HHmm.xlsx`.

### 3. Dependency
- Add `xlsx` (SheetJS community build) via `bun add xlsx` for `.xlsx` generation.

## Technical notes
- `ImportExportButtons` currently always renders `ExportMenu`. Simplest fix: in `lost-found.index.tsx`, stop using that wrapper and render the existing Import button + `ImportDialog` inline (same pattern already used elsewhere). The generic Import/Export component stays untouched for other modules (e.g. `data-io.tsx`).
- Field mapping in the exporter will read from `BaggageCase` shape already used in the file (`c.pirNumber`, `c.bagId`, `c.bagTagNumber`, `c.passengerName`, `c.contact`, `c.airline`, `c.flightNumber`, `c.flightDate`, `c.origin`, `c.destination`, `c.delivery?.method`, `deriveLfFromCase(c)`, `c.internal?.assignedOfficer`, `c.priority`, `c.createdAt`, `c.updatedAt`, `c.delivery?.address`, `c.baggage?.numberOfBags`, `c.baggage?.color`, `c.baggage?.type`, `c.description` / remarks).
- Column auto-size implemented by computing `!cols = [{ wch: maxLen + 2 }, ...]`.

## Out of scope
- CSV export path, `ExportMenu`, and `data-io.tsx` are unchanged.
- Bulk Print, Change Status, Assign Officer/Delivery actions unchanged.
- No workflow, audit, or store changes.

## Expected result
- Top toolbar: only Import + New PIR Case.
- Selecting cases → clicking "Export Selected" downloads a formatted `.xlsx` with the columns above.
