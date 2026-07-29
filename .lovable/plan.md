## Root cause

The Delivery Agent Portal's Verify OTP dialog is the only remaining 4-digit surface:

- `src/routes/driver-portal.tsx` (`OtpDialog`): input is `maxLength={4}`, so a 6-digit code is truncated to the first 4 characters (visible in your screenshot: `7544` of `754496`).
- The same dialog verifies **client-side**: `if (code.trim() === d.otpCode)`. The agent-side snapshot does not reliably carry the passenger OTP, so even an untruncated code compares against an empty/stale value and shows "Invalid OTP". The database function `agent_complete_delivery(p_delivery, p_code)` is the authoritative verifier and is currently only reached when the client-side check passes.
- `src/lib/i18n/driver.ts`: placeholders say "4-digit code" / "رمز من 4 أرقام".
- `src/lib/store.ts` → `driverMarkDelivered` swallows RPC errors via `reportError`, so a rejected OTP would look like a silent no-op instead of an error toast.

The 6-digit generation, storage in `otp_challenges`, and the Passenger Portal display are already correct. No hardcoded `1234` exists anywhere in `src/`.

## Changes (no design changes)

1. **`src/routes/driver-portal.tsx` — Verify OTP dialog**
   - `maxLength={6}`, keep digits-only input; Confirm button disabled until exactly 6 digits are entered.
   - Drop the client-side `code === d.otpCode` comparison entirely. Submit calls `driverMarkDelivered(deliveryId, { code })` and awaits the result.
   - On success: success toast, close dialog. On rejection/error: keep the dialog open and show the invalid-OTP toast. Same markup/classes as today.

2. **`src/lib/store.ts` — `driverMarkDelivered`**
   - Return a `{ ok: boolean; error?: string }` result (or rethrow) instead of silently swallowing, so the dialog can distinguish a wrong code from success. Refresh the snapshot after a successful call so the portal moves the stop to Completed.

3. **`src/lib/i18n/driver.ts`**
   - Placeholder text → "6-digit code" / "رمز من 6 أرقام". No other copy changes.

4. **Sweep for other 4-digit assumptions** across `src/` (inputs, slices, regexes, templates) and fix any found. Current sweep shows only the items above; `src/lib/integrations/otp.ts` already generates 6 digits.

## End-to-end validation (after the fix)

Drive one delivery through the full lifecycle with the real portals plus SQL verification:

Ready for Delivery → Assigned → Driver Accepted → Collected → Out for Delivery → agent enters the real 6-digit OTP → Delivered → Closed.

For the OTP step specifically, confirm in the database that:
- `otp_challenges` row moves to `Verified`;
- `deliveries.stage = Delivered` with `delivered_at` set;
- `workflow_events`, `timeline_events`, `admin_audit_log`/`audit_events` all record the transition;
- `passenger_view` flips to Delivered and stops exposing the OTP;
- `notification_events` contains the Delivered notification;
- the linked `baggage_cases` row reaches Delivered/Closed.

Then check the live Passenger Portal token renders Delivered, and confirm a wrong code is rejected without advancing any state. Test data created for the run is removed afterwards.
