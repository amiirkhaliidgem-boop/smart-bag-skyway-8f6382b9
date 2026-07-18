# Single-Source-of-Truth Migration

## Root cause (verified)

`src/lib/store.ts` is a Zustand store persisted to `window.localStorage` under a single key. Every module (L&F, Delivery, Driver, Passenger, Workflow, Timeline, Audit, Notifications, OTP, Tracking tokens) reads and writes this in-memory object. Supabase is connected but **unused** for any domain data. Two browser contexts = two independent datasets. This is why Preview and Open-in-New-Tab disagree — and it will remain broken across users/devices until the domain moves server-side.

## Target architecture

- **Single source of truth: Supabase**. All operational tables live in `public.*` with RLS.
- **Workflow Engine on the server**: status transitions happen inside `createServerFn` handlers that write to `workflow_events` + the owning row atomically. No module maintains independent state.
- **Client is a view**: routes read via server functions (or Supabase realtime for live tabs). No `localStorage` for domain data. `useStore` becomes a thin cache backed by server queries via TanStack Query.
- **Passenger portal**: reads a specific delivery by tracking token via a public, token-scoped server fn — no session needed, no `anon` blanket policy on the base table.
- **Driver portal**: reads own assignments via `requireSupabaseAuth` (or a signed driver token for the demo PIN flow).

## Schema (one migration)

Tables in `public` (all with GRANTs + RLS + policies + `updated_at` triggers):

- `baggage_cases` — PIR data (passenger, airline, flight, address, bag tags, incomplete flag, current `lf_status`).
- `deliveries` — one row per case handed over at "Ready for Delivery"; stage, driver, otp_code, tracking_token, notes, priority.
- `workflow_events` — append-only log: `case_id`, `delivery_id?`, `from_status`, `to_status`, `actor`, `role`, `reason`, `created_at`. This IS the workflow engine's ledger.
- `timeline_entries` — human-readable events per case/delivery.
- `audit_log` — actor/role/action/target rows for compliance.
- `notifications` — channel, template, locale, rendered body, status, related case/delivery.
- `tracking_tokens` — token → delivery_id (unique), used by `/passenger/{token}`.
- `driver_assignments_history` — reassign trail.

Policies:
- Authenticated staff (via `user_roles`) can read/write within their role.
- `anon` gets **no** direct SELECT on base tables. Passenger reads happen through a token-scoped server fn that projects safe columns only.
- Realtime enabled on `baggage_cases`, `deliveries`, `workflow_events`, `notifications`.

## Server functions (replace store mutators 1:1)

Under `src/lib/*.functions.ts`:

- `createCase`, `updateCase`, `setLfStatus`
- `handoverToDelivery` (fires when `lf_status → Ready for Delivery`; creates `deliveries` row + tracking token in one transaction via SQL function)
- `assignDriver` / `bulkAssignDrivers` (generates single 4-digit OTP, inserts workflow event, queues DRIVER_ASSIGNED notification)
- `driverStartTrip`, `driverMarkDelivered` (verifies OTP server-side against stored value)
- `sendNotification`, `resendOtp` (never regenerates unless expired)
- `getCase`, `listCases`, `getDelivery`, `listDeliveries`, `getPassengerViewByToken` (public, token-only)

Every mutator writes: owning row + `workflow_events` + `timeline_entries` + `audit_log` in one SQL function so nothing can drift.

## Client changes

- Delete the `localStorage` persist layer in `src/lib/store.ts`.
- Replace `useStore(selector)` call sites with TanStack Query hooks that call the server fns. Keep a small Zustand slice only for pure UI state (open dialogs, filters).
- Subscribe to Supabase Realtime in `__root.tsx` (or per-route) to invalidate queries — this is what makes Preview and Open-in-New-Tab reflect the same data live.
- Remove the seed-on-first-load block. Ship demo data via a seed migration instead (idempotent `INSERT ... ON CONFLICT DO NOTHING`).

## Workflow Integrity Audit (after migration)

Automated test suite `src/lib/__tests__/workflow-integrity.test.ts` covering each transition end-to-end against a test Supabase schema:

1. Create case → `lf_status=Open`, workflow_event row, timeline row, audit row.
2. Progress to `Ready for Delivery` → delivery row auto-created, tracking token minted, L&F becomes read-only for stage changes.
3. Assign driver → OTP generated once, DRIVER_ASSIGNED notification queued, workflow_event `Assigned`.
4. Passenger portal (by token) sees same OTP; driver portal does not.
5. `driverStartTrip` → stage `Out for Delivery` mirrored to L&F status; OUT_FOR_DELIVERY notification.
6. `driverMarkDelivered(otp)` → server verifies OTP against stored value; stage `Delivered`; DELIVERED notification; case closes.
7. Reassign / fail / cancel paths write history and audit.
8. Two concurrent sessions (Preview + New Tab) see the same state after each transition via realtime.

## Scope of file changes (high level)

- New: 1 Supabase migration, ~10 `*.functions.ts` files, realtime hook, integrity tests.
- Rewritten: `src/lib/store.ts` (thin), every route under `src/routes/lost-found.*`, `src/routes/delivery.*`, `src/routes/driver-portal.tsx`, `src/routes/passenger*.tsx`, `src/routes/timeline.tsx`, `src/routes/notifications.tsx`, `src/routes/workflow-monitor.tsx`.
- Removed: `localStorage` persist code, in-file seed data, ETA remnants (already scrubbed).

## What I need from you before I start

1. **Confirm this scope.** This is the correct fix, but it is large — every operational route touches Supabase after this.
2. **Auth model for staff.** Do staff (dispatcher, coordinator, agent) sign in with Supabase email/password already, or should I add a minimal sign-in flow as part of this migration? Without staff auth, RLS collapses to "everyone can edit everything," which defeats the point.
3. **Demo/seed data.** Keep the current demo cases (moved into a seed migration) or start empty?

Once confirmed I will run the migration, land the server functions, rewire the client, and ship the integrity test.
