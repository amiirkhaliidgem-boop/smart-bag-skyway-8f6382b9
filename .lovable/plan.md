## Goal

Turn `/tracking` from a demo PIR lookup into the system-wide tracking gateway: one search box that auto-detects any operational reference and renders a single unified, read-only view built from live ecosystem data.

## 1. Remove demo content

In `src/routes/tracking.tsx`, delete the "Demo PIRs: CAIMS12045 …" helper line and any demo wording. Placeholder becomes:
`Search by PIR, PNR, Bag Tag, Bag ID or Delivery ID`.

## 2. Universal resolver (new, read-only)

Add a small resolver helper (e.g. `src/lib/tracking/resolve.ts`) that takes one raw query string and returns `{ case, delivery, workflow }` from the existing store — no new state, no writes.

Lookup order, stopping at the first match:
1. Delivery ID — `deliveries.deliveryId` (`DEL-50032`)
2. PIR Number — `cases.pirNumber`
3. Bag ID — `cases.bagId` (`BAG-100253`)
4. Bag Tag — `cases.bagTagNumber` and any entry in `cases.baggage.bagTags`
5. PNR — `cases.pnr`

Matching is case-insensitive and trims whitespace. No type selector in the UI; detection is implicit through the ordered lookup. Whichever key matched, the resolver normalises to the same triple, so the rendered result is identical.

## 3. Unified result panel

One result component rendered on `/tracking` for every match, reading live from the store (`cases`, `deliveries`, `workflow`, timeline/audit entries) so it always reflects current state:

- **Current Status** — latest Workflow Engine status + delivery stage badge
- **Passenger Information** — name, contact, PIR/PNR
- **Flight Information** — airline, flight number, arrival date
- **Baggage Information** — Bag ID, bag tag(s), description, storage location
- **Delivery Information** — Delivery ID, method, address, priority, stage
- **Delivery Agent Information** — shown only when assigned
- **Delivery Progress** — stage stepper driven by the canonical stage list
- **Live Timeline** — existing workflow history entries, newest first
- **OTP Verification** — code shown only when eligible (Out for Delivery onward), otherwise the OTP status only

Cases still owned by Lost & Found (no delivery record yet) render the same panel with delivery/agent/OTP sections omitted or marked "Not yet scheduled".

## 4. Link to the passenger journey

When the matched delivery has a tracking token, the panel shows a **View Passenger Portal** button opening `/passenger/{token}` — the existing passenger experience, unchanged.

## 5. Not found

If nothing matches, show a neutral production-style empty state (no demo hints) asking the user to check the reference.

## Technical notes

- Purely a presentation + lookup layer. No changes to the Workflow, Delivery, Notification, Timeline, Audit or OTP engines, and no database or schema changes.
- No new tracking storage: all reads come from the existing Zustand store hydrated from `public.app_state`.
- Tracking page keeps its existing route and head metadata; only the body and placeholder change.

## Verification

- Search each of the five identifier types for the same case and confirm the identical panel renders.
- Confirm the OTP code only appears from Out for Delivery onward.
- Confirm the passenger portal link opens the correct token.
