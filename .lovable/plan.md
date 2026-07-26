## Goal

The OTP Verification Card on the Passenger Portal should only appear once the delivery reaches **Out for Delivery**, and stay visible through completion. No engine, notification, OTP, timeline, or audit logic changes.

## Current state

`TrackScreen` in `src/routes/passenger.index.tsx` renders `<OtpHeroCard>` unconditionally for every stage. It already derives the current stage from the workflow (`const stage = getDeliveryStage(delivery)`), but the value is discarded (`void stage`).

## Change

Single UI-level guard in `src/routes/passenger.index.tsx`:

- Use the already-derived `stage` to compute a visibility flag: show the card only when the stage is `Out for Delivery`, `Delivered`, or a later/terminal delivery stage (so the card does not vanish mid-confirmation).
- Hidden for: Bag Located, Customs Cleared / Waiting Customs Clearance, Ready for Delivery, Scheduled, Assigned, Driver Accepted, Collected Bag.
- Wrap the `<OtpHeroCard>` `MotionSection` in that condition so the surrounding stack (Welcome, Status, Timeline, Contact) simply closes up with no empty gap.
- Remove the now-unneeded `void stage` line.

Everything else — OTP generation, the checklist, the confirm action, notifications, timeline, audit — stays exactly as-is.

## Verification

Load a passenger token at an earlier stage (no OTP card visible), then a token at Out for Delivery (card visible with the checklist and confirm button).
