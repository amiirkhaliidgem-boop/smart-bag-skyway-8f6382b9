## Root cause (confirmed against the live database)

`dm_assign_agent()` fails on **every** call with `40001 – "This record changed since you opened it. Reload and try again."`, and because the whole function is one transaction, everything it did before the failure is rolled back.

Why:

1. `dm_assign_agent()` first runs `UPDATE public.deliveries SET assigned_agent_id = …, assigned_at = now()`.
2. The `deliveries_bump` BEFORE-UPDATE trigger runs `bump_version()`, so `version` goes from N to N+1.
3. The function then calls `wf_transition(..., p_expected_version := N)` — the version the UI read from the snapshot.
4. `wf_transition()` re-reads the row, sees `version = N+1 <> N`, and raises the optimistic-concurrency error.
5. Rollback wipes the agent assignment, the OTP insert, and the `passenger_links` insert that had already run inside the same call.

Evidence in the current data: 1 delivery exists (`DEL-000001`, stage `Ready for Delivery`, `assigned_agent_id = NULL`, `version = 0`), while `passenger_links`, `otp_challenges`, and `notification_events` are all empty — exactly the fingerprint of a rolled-back assign. `passenger_view` has its row because `wf_open_delivery()` writes it without any pre-update.

So: no RLS problem, no failed migration, no missing grant, no broken `wf_refresh_passenger_view()`. The engine logic is correct; the version handshake is self-defeating.

The same self-invalidating pattern exists in three more functions and will fail the same way whenever the UI passes an expected version:
- `dm_schedule()` — updates `scheduled_for` before the transition.
- `dm_mark_failed()` — updates `failure_reason_id` / `failure_note` before the transition.
- `agent_advance()` when `p_to = 'Scheduled'` — clears the agent before the transition.

Secondary finding: the tracking token is only minted at assignment. A delivery that exists but has not been assigned yet has no `passenger_links` row, so "View Passenger Portal" legitimately has nothing to open. That is the button error in the screenshot for `DEL-000001`.

## Fix (database only — no UI changes)

One migration that reworks the workflow engine:

1. **Version check before any write.** Add an internal helper `wf_assert_version(p_delivery, p_expected_version)` that locks the delivery row and compares versions. Call it as the *first* statement in `dm_assign_agent`, `dm_schedule`, `dm_mark_failed`, `dm_mark_returned`, and `agent_advance`, then pass `NULL` as the expected version into `wf_transition` so the check is not re-evaluated against the already-bumped row.
2. **`dm_assign_agent` ordering.** Keep it as: role check → agent validity check → version assert → agent update → expire old OTPs → issue new 6-digit OTP → ensure `passenger_links` row → `wf_transition('Assigned')`, which in turn refreshes `passenger_view` and queues SMS + WhatsApp.
3. **Mint the tracking token at delivery creation.** Move the "ensure a live `passenger_links` row" step into a small `wf_ensure_passenger_link(p_delivery)` function and call it from `wf_open_delivery()` as well as `dm_assign_agent()`. Every delivery then has a portal link from the moment Lost & Found hands it over, and re-assignment reuses the existing token.
4. **Backfill.** Create the missing `passenger_links` row for the existing `DEL-000001` and refresh its `passenger_view` so the current UAT record is immediately openable.

## Verification after the migration

Run as a real coordinator/admin session:
- Assign the agent (Ahmed Mostafa) to `DEL-000001` and confirm, by querying the database, that the delivery has `assigned_agent_id` + `assigned_at` set and `stage = 'Assigned'`.
- Confirm one row in `otp_challenges` (state `Sent`, 6 digits, 24h expiry), one in `passenger_links` (non-revoked, 30-day expiry), `passenger_view` updated with the new stage, and two rows in `notification_events` (sms + whatsapp) carrying the `/passenger/<token>` link.
- Call `passenger_get_view(token)` and confirm it returns the passenger record (OTP correctly hidden until `Out for Delivery`).
- Open "View Passenger Portal" in the preview and confirm the portal renders.
- Re-run the schedule and mark-failed paths to confirm the version handshake no longer self-invalidates.
