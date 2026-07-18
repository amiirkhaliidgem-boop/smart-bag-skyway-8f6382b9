
## Problem

The Passenger Portal renders `delivery.otpCode.slice(0, 4)` — only the first 4 digits of the 6-digit OTP minted at Assign Driver. The Driver Portal validates against the full `d.otpCode` (6 digits, `maxLength={6}`, placeholder "6-digit code"). Verification therefore never succeeds because the two portals reference different views of the same value. There is no second OTP being minted at verify time — the bug is length/rendering, not generation.

## Single source of truth

`Delivery.otpCode` in `src/lib/store.ts` remains the only OTP. It is minted exactly once inside `assignDriver` (store.ts ~L1235), stored on the delivery, and every module reads it from there. Verify OTP compares the driver's input to that same field and never mints anything.

## Changes

1. **`src/lib/store.ts`** — make every OTP mint 4 digits so the stored value equals what the passenger sees.
   - `assignDriver` (~L1235): `Math.floor(1000 + Math.random() * 9000)` (4-digit).
   - `generateOtp` helper (~L1406) and `resendOtp` fallback (~L1427): same 4-digit formula.
   - Seed deliveries (L430, 446, 461, 476): replace the 6-digit literals with 4-digit codes so demo data matches.

2. **`src/routes/passenger.tsx`** (L238) — render the full stored value: `<OtpCard code={delivery.otpCode} />`. Remove `.slice(0, 4)`.

3. **`src/routes/driver-portal.tsx`** `OtpDialog` (L315–345):
   - `maxLength={4}`, `placeholder="4-digit code"`, `inputMode="numeric"`.
   - Remove the "6-digit code" phrasing. Keep the existing helper line: "Ask the passenger for the OTP shown in their Passenger Portal." (already present; drop the redundant "Ask … for the 6-digit code" sentence above the input and keep only the single instruction).
   - Verification path unchanged: `code.trim() === d.otpCode` → `driverMarkDelivered(...)`. No new mint.

4. **End-to-end test** — add `src/lib/__tests__/otp-flow.test.ts` (Vitest) that:
   - picks a seeded Ready-for-Delivery case, calls `assignDriver`, captures `delivery.otpCode`;
   - asserts the code is exactly 4 digits and that the passenger-portal view (reading the same store) shows that same string;
   - calls `driverStartTrip` then `driverMarkDelivered` with the captured code and asserts:
     - delivery stage becomes `Delivered`,
     - `otpStatus === "Verified"`,
     - the linked L&F case status mirrors to the delivered terminal state,
     - a Timeline entry and Audit entry were appended,
     - a passenger `DELIVERED` notification was queued.
   - Also asserts `otpCode` did not change between assign and verify (single OTP invariant).

## Out of scope

- Notification template copy — `DRIVER_ARRIVED` template references `{otp}` and continues to interpolate the same field; no template change needed.
- OTP expiry / rotation UX. `resendOtp` keeps the existing code when present (already correct) and only mints a fresh 4-digit code if the field was cleared.
- Provider `src/lib/integrations/otp.ts` is unused by the live flow; left as-is.

## Acceptance

- Assigning a driver mints one 4-digit `otpCode`; the Passenger Portal, Delivery Details, and Driver Portal all display / compare that identical value.
- Driver enters the 4-digit code shown to the passenger → delivery flips to Delivered, and L&F, Workflow, Timeline, Audit, and passenger notifications update through the existing central helpers.
- Vitest `otp-flow` test passes.
