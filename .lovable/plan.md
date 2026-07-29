## Root cause (verified against the live database)

The Workflow Engine is **not** broken. I queried `DEL-000001` and everything downstream of `agent_advance`/`wf_transition` is correct:

```text
deliveries.stage      = Out for Delivery
deliveries.status     = OUT_FOR_DELIVERY   started_at = 07:11:35Z
passenger_view.stage  = Out for Delivery   updated_at = 07:11:35Z
passenger_view.otp    = 754496 (Sent)
```

So `wf_transition()` did run `wf_journal`, `wf_queue_notification` and `wf_refresh_passenger_view` correctly.

The failure is in the **passenger portal client**, in `src/routes/passenger.$token.tsx`:

- `synthesizeFromView()` never sets `delivery.stage`. The portal renders from `getDeliveryStage(delivery)`, which then falls back to legacy status mapping.
- It feeds `view.status` (a workflow enum, e.g. `OUT_FOR_DELIVERY`, `DELIVERED`) into `normaliseDeliveryStatus()`, which only matches human labels (`"Out For Delivery"`, `"Delivered"`). Every real value hits `default:` and returns `"Pending"`.

Net effect: the portal shows the pre-assignment stage forever, the OTP card stays hidden (it is gated on stage ≥ Out for Delivery), and the feedback view never unlocks after Delivered — even though the DB is perfectly in sync.

## Fix

1. **`src/routes/passenger.$token.tsx`** — pass `view.stage` straight through as `delivery.stage` (the DB already returns the canonical `delivery_stage` value), and rewrite `normaliseDeliveryStatus`/`statusToCaseStatus` to map from the workflow enum *and* the stage label, with no silent `default → Pending`. Also derive the L&F stepper status and the delivered flag from the same stage value.
2. **OTP visibility** — keep the server-side rule as the single gate: `passenger_get_view()` exposes `otp_code` only when stage = `Out for Delivery`; extend it to keep exposing while the delivery is `Out for Delivery` or `Delivery Failed` (retry attempt) and to return `NULL` once `Delivered`/`Returned to Airport`. Client keeps rendering the OTP card only when `otpCode` is non-null, so the DB stays authoritative.
3. **Feedback eligibility** — the portal switches to the feedback view on `stage === "Delivered"`; with the mapping fixed this works. Confirm `passenger_submit_feedback` still returns true only for a live, non-revoked link.

## Full-chain verification (after the fix)

Drive the real RPCs against a test delivery and assert every side-effect table for each transition:

```text
Assigned → Driver Accepted → Collected Bag → Out for Delivery
        → OTP verify → Delivered → Feedback submitted
```

For each step check: `deliveries` (stage, workflow_status, the matching `*_at` timestamp, version bump), `workflow_events`, `timeline_events`, `audit_events`, `passenger_view` (stage + otp + updated_at), `notification_events` (queued for DRIVER_ASSIGNED / OUT_FOR_DELIVERY / DELIVERED only), `otp_challenges` state, and `passenger_feedback`.

Then run the portal itself in a headless browser against the live token and screenshot it at Assigned, Out for Delivery (OTP digits visible) and Delivered (feedback form), confirming the polling picks up each change within ~5s.

## Notes

No new routes, no schema changes beyond the one `passenger_get_view` OTP-window tweak, and no changes to the frozen portal visual design.
