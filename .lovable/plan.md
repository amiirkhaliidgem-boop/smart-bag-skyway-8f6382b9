# Stability RCA and Production Migration Plan

## Executive conclusion

The application is unstable because its operational source of truth was changed from normalized database records into one shared Supabase row: `public.app_state(id='global')`. Every signed-in browser loads the entire JSON payload, mutates it locally, and writes the whole payload back.

That design creates three connected failure modes:

1. **Data can be overwritten:** concurrent or not-yet-hydrated clients perform last-write-wins replacement of the complete application state.
2. **Modules can drift:** internal modules read the JSON snapshot, while the public Passenger Portal and feedback features also read projection tables. Those projections can retain records that are no longer present in the overwritten master snapshot.
3. **Preview contexts can disagree:** each browser context has its own Supabase session, in-memory store, version counter, debounce timer, and realtime subscription. Their local states can differ temporarily and one can overwrite the other.

No new feature work should proceed until the stabilization acceptance tests below pass.

## Verified RCA

### 1. Data loss

- The live `app_state` row currently contains **8 cases, 4 deliveries, and 4 workflow records**, at version **5**.
- `delivery_public_view` still contains **24 delivery projections**. Twenty are absent from the current `app_state` payload.
- This proves the records did not disappear because of a UI filter. The singleton master snapshot was replaced with a smaller payload, while an older projection retained evidence of prior deliveries.
- `src/lib/persistence.ts` updates `app_state` using only `id='global'`. It computes `version + 1` in the browser but does not require the database version to still match. Two clients can therefore read version N and both write version N+1; the later write silently removes the earlier client’s changes.
- A client can initialize with seeded/default store data before the authoritative snapshot has safely completed hydration. There is a hydration indicator, but it is not enforced as a hard precondition for every write. This makes a smaller seed/default payload capable of replacing live data.
- On a failed push, the client records the payload as its latest value before Supabase confirms persistence, so failures can also be mistaken for successful saves.
- The 250 ms single-timer debounce can discard a real mutation when a remote echo already occupies the timer slot.

**Root cause:** whole-document client writes without server-side concurrency control, combined with unsafe hydration/debounce behavior.

### 2. Module synchronization

- L&F, Delivery, Workflow Monitor, Notifications, Timeline, and most Feedback data are arrays inside the same client-side JSON store.
- Passenger Portal data is served from `passenger_links`, `delivery_public_view`, and `passenger_feedback`, synchronized from the JSON payload through database functions/projections.
- The current 24-versus-4 delivery mismatch confirms these sources are no longer consistent.
- Workflow rules are implemented both in TypeScript and in passenger-facing PL/pgSQL functions. They are separate implementations and can evolve differently.
- Empty remote arrays can fall back to seeded defaults during `applyRemote`, allowing stale workflow data to be resurrected instead of honoring an authoritative empty state.
- Business audit data is an editable JSON array rather than an append-only database log; it can be overwritten with the rest of the snapshot.

**Root cause:** one mutable JSON aggregate plus secondary projections, with no database-enforced relationships or single transactional workflow engine.

### 3. Runtime inconsistency between Chat Preview and New Tab

- Supabase authentication is persisted in browser `localStorage`. Embedded preview storage and top-level-tab storage can hydrate at different times or be partitioned by browser rules.
- Session, role lookup, permission lookup, store bootstrap, and realtime connection are separate asynchronous steps. Route guards can resolve differently depending on timing.
- Each context has independent module-level values for `localVersion`, `lastPayload`, suppression state, and its realtime channel.
- HMR can preserve or recreate the embedded preview’s in-memory state while a new tab performs a clean bootstrap.
- Both contexts point to the same Supabase project; the repository does not show competing project URLs. The divergence is therefore session/bootstrap/concurrency related, not evidence of two configured databases.

**Root cause:** origin/context-dependent auth hydration layered over unsafe client-side state ownership.

### 4. Access-control regression contributing to instability

- Migration `20260718011555...sql` revoked authenticated execution of `public.has_role(...)`, while current RLS policies on administration tables call `has_role` for authorized access.
- Runtime evidence included permission-denied responses for role/agent helper functions. This can make role and delivery-agent resolution fail or fall back differently across sessions.
- `app_state` itself is writable by any authenticated account, so a Delivery Agent or other low-privilege signed-in account can technically replace the complete operational snapshot despite UI route restrictions.

**Root cause:** database grants/RLS do not consistently match application RBAC, and UI authorization is carrying responsibilities that must be enforced in the database.

## Stabilization implementation

### Phase 0 — Freeze and preserve evidence

1. Freeze feature development and operational writes during recovery.
2. Export the current `app_state`, `delivery_public_view`, `passenger_links`, feedback, RBAC, and audit-related records.
3. Preserve Supabase backup/PITR availability and identify the last known-good timestamp.
4. Do not delete the 20 orphan projection rows; treat them as recovery evidence.
5. Produce a reconciliation report keyed by Delivery ID, Bag ID, PIR, and tracking token. Mark records as fully recoverable, partially recoverable, or backup-required.

### Phase 1 — Stop further loss in the current architecture

1. Add a hard persistence state machine: `uninitialized → loading → hydrated → saving/error`. No remote write is allowed before `hydrated`.
2. Replace unconditional browser updates with an authenticated server function/database operation that performs optimistic concurrency: update only when `version = expectedVersion`.
3. On conflict, refetch and present/retry a deterministic merge; never silently overwrite.
4. Mark `lastPayload` and increment local version only after a confirmed database write.
5. Replace the single debounce slot with a trailing queued save so mutations arriving during a pending save are not discarded.
6. Make remote applies side-effect-free: they must not schedule a write-back, generate defaults, or resurrect empty arrays.
7. Surface persistence/realtime failures in the UI and retain a retryable pending mutation rather than only logging a warning.
8. Tighten temporary `app_state` RLS so only explicitly authorized staff workflows can read/write it; Delivery Agents must not have blanket update access.
9. Repair only the function grants required by current RBAC and agent-list flows, using least privilege. Keep internal-only SECURITY DEFINER functions revoked from public/anon.

### Phase 2 — Recover and reconcile data

1. Restore the last known-good `app_state` snapshot from PITR/backup if available.
2. Reapply newer valid records by reconciling projection rows, passenger links, feedback, and audit evidence rather than replacing the snapshot blindly.
3. If PITR is unavailable, reconstruct only fields supported by surviving records and report unrecoverable fields explicitly.
4. Regenerate public projections from the reconciled source and verify one-to-one Delivery ID/token mappings.
5. Validate counts and references across L&F, Delivery, Workflow, Agent Portal, Passenger Portal, Timeline, Notifications, Feedback, and Audit.

### Phase 3 — Move to the production data model

Replace `app_state` as the source of truth with normalized tables:

```text
baggage_cases 1 ─── 0..1 deliveries
     │                    │
     │                    ├── driver_assignments
     │                    ├── delivery_stops / route plans
     │                    ├── passenger_links
     │                    ├── otp_challenges
     │                    └── feedback
     │
     ├── case_bags
     ├── workflow_events
     ├── notifications
     ├── timeline_events
     └── audit_events

app_users ─── user_role_assignments ─── app_roles ─── role_permissions
```

Implementation rules:

- Stable UUID primary keys; unique PIR, Delivery ID, active tracking-token constraints where business rules require them.
- Foreign keys for all relationships and indexes on operational search/status/date/assignment columns.
- A canonical current status on the owned entity plus immutable workflow events.
- One server-side workflow transition function/service executes status validation, entity updates, assignment changes, OTP creation, notifications, timeline events, and audit events in one database transaction.
- No direct browser writes to protected workflow tables; React calls authenticated TanStack server functions.
- Passenger RPCs call the same workflow transition engine rather than maintaining a second state machine.
- Realtime subscribes to normalized record changes for UI refresh only; it never owns persistence.
- Business audit/workflow events are append-only and cannot be updated or deleted by normal application roles.
- Retain public passenger access through narrow token-scoped RPCs/views that expose only approved fields.

### Phase 4 — Security and production hardening

1. Define RLS by role and record responsibility for every operational table; do not rely on hidden menus or route guards.
2. Keep roles in dedicated role tables and verify admin decisions server-side.
3. Revoke default function execution, then explicitly grant only required RPCs to `anon` or `authenticated`.
4. Add rate limiting/lockout and audit events for username/PIN authentication attempts.
5. Use structured server errors, retries for transient failures, observability, alerting, and correlation IDs.
6. Enable managed backups/PITR, document restore drills, retention, RPO, and RTO.
7. Add migration rehearsals, rollback procedures, staging, and production smoke tests.
8. Load-test concurrent dispatcher/agent/passenger transitions before go-live.

## Required verification before feature work resumes

- Two simultaneous authenticated sessions update different cases without either update being lost.
- Refresh, embedded preview, and new tab show identical record counts and statuses after clean bootstrap.
- A stale client receives a version conflict and cannot overwrite newer data.
- A failed save remains visibly pending/retryable and is not marked persisted.
- L&F handover creates exactly one linked delivery transactionally.
- Agent actions update Delivery, Workflow, Timeline, Notifications, Passenger projection, and Audit atomically.
- Passenger OTP completion uses the same transition rules and cannot produce an invalid state.
- Delivery Agents cannot read or update unrelated operational/admin records through direct Data API calls.
- Public token access exposes only the intended passenger fields.
- Reconciliation totals and orphan counts are zero, or every remaining exception is documented and approved.
- Backup restore and rollback are tested in staging.

## Recovery limitation

The surviving 20 delivery projections contain useful recovery evidence, but they do not necessarily contain every original case, workflow, notification, note, and audit field. Complete restoration requires a Supabase backup/PITR snapshot from before the overwrite. Without that, recovery must be conservative and any non-reconstructable fields must be reported rather than invented.