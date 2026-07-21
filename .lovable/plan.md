## Goal
Make the PIR number visible in the Passenger Portal Welcome Card, matching the existing Flight and Bag Tag fields, by threading `pir_number` through the entire public/anon data path.

## Changes

### 1. Database migration
- `ALTER TABLE public.delivery_public_view ADD COLUMN pir_number text`.
- Update `public.sync_passenger_public_from_app_state()` trigger fn to also write `pir_number`, sourced from `delivery.pirNumber` with fallback to `case.pirNumber`.
- Update `public.get_passenger_view(p_token)` to include `pir_number` in the returned JSON.
- One-shot backfill: for every existing row in `delivery_public_view`, populate `pir_number` from the current `app_state.payload`.

No RLS/grant changes — the column inherits existing table policies.

### 2. Server function — `src/lib/passenger.functions.ts`
- Add `pirNumber: string | null` to `PassengerView` interface.
- Add `pir_number: string | null` to the RPC `row` type.
- Map `pirNumber: row.pir_number` in the returned view. Default to `null` in `EMPTY_VIEW`.

### 3. Route — `src/routes/passenger.$token.tsx`
- In `synthesizeFromView()`, replace the two hard-coded `pirNumber: ""` assignments with `view.pirNumber ?? ""` on both the synthesized `Delivery` and `BaggageCase`.
- Remove the stale "PIR ... intentionally left empty" comment.

## Out of scope
- No UI changes to `passenger.index.tsx` — the Welcome Card already reads `delivery.pirNumber` correctly.
- No changes to staff-facing pages, workflow engine, or notification templates.

## Verification
- Open a passenger portal link from a case with a PIR → Welcome Card shows PIR alongside Flight and Bag Tag.
- Existing cases (via backfill) show PIR immediately without needing to re-save.
- New/updated cases keep PIR in sync via the trigger fn.