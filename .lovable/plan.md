# Delivery POD Print — Plan

Reuse the existing PIR print architecture (dedicated template + hidden print host + in-page `window.print()`) for Delivery Management. No engine, DB, or business-logic changes.

## New files

1. **`src/components/delivery/pod-report.tsx`** — pure presentational A4 POD template (mirrors `pir-report.tsx`).
   Props: `{ delivery: Delivery; caseRecord?: BaggageCase }` (case looked up by `bagId` for baggage/flight/passenger enrichment).
   Sections:
   - Header: IAB logo, "Smart Baggage Ecosystem", title "Proof of Delivery (POD)", meta (Delivery Number, PIR, Bag ID, Generated Date).
   - Passenger: Full Name, Mobile, Email, PNR.
   - Flight: Airline, Flight No., Flight Date, Origin, Destination.
   - Baggage: Bag Tag(s), Number of Bags, Color, Type, Weight, Description.
   - Delivery: Method, Driver, Delivery Address, Priority.
   - Timeline (dates only): Assigned At, Accepted At, Collected At, Out For Delivery, Delivered At.
   - OTP: OTP Status, Verification Status (derived: "Verified" if `deliveredAt` and `otpStatus==='verified'`, else pending/not-verified).
   - Signatures block (Driver + Passenger).
   Reuses existing `.pir-*` print CSS classes from `src/styles.css` so no new print styles are needed. Wrapper class `pir-print` keeps identical page layout.

2. **`src/components/delivery/pod-print-host.tsx`** — clone of `pir-print-host.tsx`:
   - Exposes `podPrintBus.print(deliveryIds: string[])`.
   - Subscribes to store, resolves `Delivery` records (+ their `BaggageCase` by `bagId`), portals into `.pir-print-portal` container, triggers `window.print()`, cleans up on `afterprint`.

## Wiring

3. **`src/routes/__root.tsx`** (or wherever `<PirPrintHost />` is mounted) — mount `<PodPrintHost />` alongside it.

4. **`src/routes/delivery.$deliveryId.tsx`** — replace the `Print` button's `onClick={() => window.print()}` with `podPrintBus.print([deliveryId])`.

5. **`src/routes/delivery.index.tsx`** — add a `Print` action to the `SharedBulkToolbar` that calls `podPrintBus.print(selectedDeliveryIds)`.

## Non-goals

- No changes to Workflow / Delivery / Notification / Timeline / Audit engines, store mutations, DB, or Supabase.
- No new print CSS; reuse existing `@media print` rules that target `.pir-print-portal`.
