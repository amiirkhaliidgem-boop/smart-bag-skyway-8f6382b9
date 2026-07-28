Remediation plan derived from the Production Readiness Review. No new features — hardening only. Each block is independently shippable.

## Block 1 — Critical: scale-safe data reads

The operational snapshot pulls 17 tables with no pagination and will silently truncate at PostgREST's 1000-row cap.

- Add explicit bounds and server-side filtering to `src/lib/ops.server.ts`: cap `baggage_cases` and `deliveries` to open/active records plus a recent window, cap journals to the last N, and return a `truncated` flag per collection.
- Surface the flag in the UI as a "showing most recent N" notice rather than silently hiding rows.
- Split the monolithic snapshot into module-scoped server functions (`loadDispatchSnapshot`, `loadLostFoundSnapshot`, `loadAdminSnapshot`) so a dispatcher click no longer refetches Lost & Found, feedback, quality and route tables.

## Block 2 — Critical: real notification delivery

- Add a Twilio/WhatsApp adapter behind the existing adapter registry (no engine changes; provider chosen by env).
- Add a server route at `src/routes/api/public/notifications/drain.ts` that verifies a shared secret, calls `notif_claim_batch`, dispatches through the adapter, and reports back via `notif_record_result`.
- Schedule it with pg_cron against the stable project URL.
- Keep the simulated adapter as the default when no provider secret is set.

## Block 3 — High: security hardening (migration)

- `REVOKE EXECUTE ... FROM anon` on every staff-only SECURITY DEFINER function: all `lf_*`, `dm_*`, `agent_*`, `notif_*`, plus `agent_owns`, `current_app_user_id`, `is_ops_staff`. Keep anon execute only on `passenger_get_view`, `passenger_submit_feedback`, `passenger_report_misconduct`, and `login_identity_for_username`.
- Add a throttle table + check inside the passenger RPCs (per-token attempt counter with a short window) and record `view_count` / `last_viewed_at` on each successful view.
- Enable leaked-password protection in Supabase Auth settings.

## Block 4 — High: stop the public-route auth error

- Gate `boot()` in `src/lib/store.ts` so it only hydrates once an authenticated session exists, and never on `/passenger/*`. Removes the recurring `Unauthorized: No authorization header provided` console error.

## Block 5 — Medium: indexes and route engine

- Migration adding covering indexes for the 14 unindexed foreign keys listed in the review.
- Rewrite `wf_recompute_route` to avoid the per-call temp table and delete-loop (single ordered pass in SQL), since it runs on every agent position report.

## Block 6 — Medium: consolidate authorization

- Retire the static path→role matrix in `src/lib/rbac.ts` in favour of the live permission matrix in `src/lib/permissions.tsx`, keeping one code path for sidebar visibility and route guards.

## Block 7 — Low: cleanup

- Remove the demo QR lookup string, the "Demo PIN: 1234" i18n strings, the unused `src/lib/integrations/otp.ts` stub (its `verify()` returns true unconditionally), the client-side `src/lib/routing/optimize.ts` now owned by the database, and the dead `contact-center-full.tsx`.
- Refresh `.lovable/plan.md` to reflect the completed migration.

## Technical notes

- Blocks 3 and 5 are pure migrations and can ship together.
- Block 1 changes the snapshot contract, so the store selectors and any component reading `driverPool` must be updated in the same change.
- No UI/layout changes anywhere in this plan.
