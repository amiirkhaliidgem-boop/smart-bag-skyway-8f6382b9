## What I verified

- **The redesign was never applied.** `src/components/driver-shell.tsx` does not exist, and `src/routes/driver-portal.tsx` still has the old unbranded, full-width layout. So the interrupted work produced *no* file changes — nothing to de-duplicate, nothing to undo. This is a clean re-apply, not a partial merge.
- **The account linking data is healthy.** Every `auth.users` account has a matching `app_users` record with `user_id` set (checked all 7), including the agent `ahmed.mostafa`, who also has the `driver` role. So the "This account is not linked to a Delivery Agent record." message is *not* a data problem.
- **The message comes from a lookup race, not a broken link.** The portal resolves the agent once, in a single `useEffect` that calls `supabase.auth.getUser()` with no retry and no auth-state subscription. If that call resolves before the Supabase session is restored from storage — which is exactly what happens in the embedded chat preview iframe, where storage access and session hydration are slower/restricted — `uid` is empty, the effect exits early, and the portal permanently renders the "not linked" message. Opening in a normal tab after login hydrates fast enough, so it works. This also explains issue 3: the chat preview and the new tab run the *same* build; only session-hydration timing differs.
- **No separate deployment is involved.** Both surfaces serve the same dev build; there is no stale build artifact to reconcile.

## Plan

### 1. Fix agent resolution (root cause)

In `src/routes/driver-portal.tsx`:
- Subscribe to `supabase.auth.onAuthStateChange` alongside the initial `getUser()` so the lookup re-runs when the session hydrates late, instead of latching a failed first attempt.
- Keep `resolving` true while there is no session yet, so the preview shows the loader rather than the error state.
- Only show "not linked" when there is a confirmed session **and** no `app_users` record — and reword it to distinguish that from "not signed in".
- Fall back to `user_metadata.full_name` as today, unchanged.

No changes to auth, roles, routing, guards, or the store.

### 2. Apply the full UI redesign (as originally requested)

Create `src/components/driver-shell.tsx`: a sticky branded header matching `AppShell` — IAB logo, "Smart Baggage Ecosystem" / "Delivery Agent Portal" titles, agent name, language toggle, sign-out button; RTL-aware.

Rewrite the presentation layer of `src/routes/driver-portal.tsx`:
- Wrap content in `DriverShell` with a centered `max-w-[1200px]` container (kills the full-width sprawl).
- KPI cards (Stops Today / Out for Delivery / Completed) restyled with the system card, radius, spacing, and icon language.
- Route and stop cards use the shared `Card`, semantic color tokens, and system typography.
- Replace raw anchors with themed `Button` components for Navigate / Start / Complete with OTP.
- Responsive grid rules per the project's header/grid conventions; full RTL support preserved.

Business logic, OTP flow, route optimization, stage transitions, and geolocation reporting are untouched — only markup and classes change.

### 3. Verify

- Typecheck.
- Drive the portal in a headless browser as the agent account: confirm the header, container width, KPI cards, and stop actions render, and that the "not linked" state no longer appears on a hydrated session.

## Technical notes

- Root cause is a client-side session-hydration race in a one-shot effect, not RLS: the `read own record or admin` policy on `app_users` already permits the agent to read their own row.
- No database migration and no changes to `__root.tsx`, `rbac.ts`, or `permissions.tsx` are needed.
