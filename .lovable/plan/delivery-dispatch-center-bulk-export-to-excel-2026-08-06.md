# Delivery Dispatch Center — Bulk Export to Excel

Add an "Export Selected" action to the Dispatch Center bulk toolbar that downloads a real `.xlsx` file containing exactly the selected delivery rows.

## Behaviour

- Appears in the existing bulk toolbar (next to Assign Agent, Resend OTP, Return to Airport, Print POD) only when rows are selected.
- Exports only the selected deliveries. Because selection is made from the already-filtered table, active filters (search, stage, date range) are implicitly preserved.
- File name: `Delivery_Dispatch_YYYY-MM-DD_HH-mm.xlsx` (local time).
- Success/error toast, matching the Lost & Found export behaviour.

## Columns (exact order)

Delivery Number, PIR / Case Reference, Bag Tag, Passenger Name, Airline, Region, Delivery Address, Delivery Agent, OTP Status, Date, Accepted At, Collected At, Delivered At, Priority, Created At.

Field sources (all already in the store, projected from the database):

- Delivery record: delivery number, address, delivery agent, OTP status, stage timestamps (accepted/collected/delivered), priority, created at.
- Linked Lost & Found case (matched on bag id): PIR / case reference (PIR number, falling back to the case number — the same fallback rule the rest of the system uses), bag tag(s), airline, region.
- Region resolves the case's region id to its display name from SLA regions in System Settings; blank when unset.
- "Date" is the delivery's operational date (created date, date-only). Timestamps format as `dd/MM/yyyy HH:mm`; stages not yet reached export as blank.

## Bag Tag handling

If a case has multiple bag tags, all tags go in a single Excel cell, comma-separated (e.g. `CAI12345678, CAI12345679, CAI12345680`). Never split a delivery across rows — one delivery = one Excel row.

## Technical notes

- New `src/lib/delivery/export-xlsx.ts` mirroring `src/lib/lost-found/export-xlsx.ts`: SheetJS `aoa_to_sheet`, bold header row, auto-sized columns, `XLSX.writeFile`. SheetJS writes UTF-8 xlsx, so Arabic passenger names and addresses render correctly in Excel (no CSV encoding pitfall).
- Wire it into `src/routes/delivery.index.tsx` as a new bulk action; the export function receives the selected `Delivery[]`, the `cases` array, and the regions list from settings.
- No new routes, no schema changes, no new server functions.

## Permissions

Export acts on data already loaded by the Dispatch Center, which is gated by existing route-level RBAC. No new permission surface — only users who can open Delivery Dispatch can export.

## Verification

Playwright run against the preview: export a single delivery, export multiple, apply a stage + date filter then export, and read the produced workbook back to confirm headers, row count, exact value match against the delivery records, and correct Arabic text.