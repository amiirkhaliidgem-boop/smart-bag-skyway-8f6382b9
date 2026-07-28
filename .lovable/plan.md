# Production Backend — Phase 1

Clean break from the single `app_state` JSON row. Every business entity gets its own table, and the Workflow Engine moves into the database as the only writer of operational state. Single station, no storage buckets, providers stay simulated.

## Architectural decisions (confirm anything you disagree with)

1. **Status model.** One canonical `workflow_status` enum on the workflow engine. `baggage_cases.lf_status` and `deliveries.stage` become *derived, engine-written* columns — never writable by a module. L&F ownership still ends at "Ready for Delivery".
2. **Append-only event tables.** `workflow_events`, `timeline_events`, `audit_events`, `notification_events` are insert-only for all app roles (no UPDATE/DELETE grant). Notification delivery attempts live in a separate mutable `notification_attempts` outbox.
3. **One transition function.** `wf_transition(delivery_id, to_status, actor, reason, metadata)` validates the transition, updates the owning row, and writes workflow + timeline + audit + notification rows in one transaction. Staff RPCs, driver RPCs, and passenger token RPCs all call it — no second state machine.
4. **Optimistic concurrency per row.** Each mutable operational table carries `version integer` + `updated_at`. Writes pass an expected version; mismatch raises a typed conflict the UI can retry, replacing the global snapshot version.
5. **Frontend owns zero business logic.** React calls typed `createServerFn` wrappers; those call SQL functions. `src/lib/store.ts` is retired.

## Proposed schema

```text
stations (single row, config)

baggage_cases ──1:N── case_bags
     │      1:0..1
     ├── deliveries ──1:N── delivery_notes
     │        ├── otp_challenges
     │        ├── passenger_links ──1:N── passenger_feedback
     │        └── quality_incidents
     ├── workflow_events   (append-only)
     ├── timeline_events   (append-only)
     └── audit_events      (append-only)

notification_events ──1:N── notification_attempts
delivery_agents (view over app_users) ── agent_positions ── agent_routes
app_users ── user_role_assignments ── app_roles ── role_permissions
```

Key constraints: unique `pir_number`, unique `delivery_no`, unique active `passenger_links.token`, unique bag tag per case, FKs everywhere with `ON DELETE RESTRICT` on operational data, `CHECK` on enums via native Postgres enums. Indexes on every status/stage column, `created_at`, assigned agent, PIR, bag tag, and token. Time-based rules (OTP expiry, link expiry) use validation triggers, not CHECK constraints.

Views: `v_dispatch_board` (delivery + case + agent join for the Dispatch Center), `v_workflow_monitor` (live status + elapsed + SLA), `delivery_public_view` regenerated as a real projection of the normalized tables.

## New entities / rules I need approved

These do not exist today and are required for a correct production model:

- **`delivery_no` human identifier** separate from the UUID PK (operations reference "DEL-000123", not a UUID).
- **`otp_challenges` as its own table** with attempt counter, expiry, lockout after N failures — currently OTP is a plain string field with no attempt limiting.
- **`sla_policies` table** (target minutes per stage) so SLA% is data-driven instead of hardcoded in the Workflow Monitor.
- **`failure_reasons` reference table** driving "Failed" and "Returned to Airport", so reasons are reportable rather than free text.
- **`notification_attempts` outbox** with retry count and next-attempt time — the current model can't retry a failed send.
- **Assumption:** a baggage case has at most one *active* delivery, but re-delivery after a failure creates a new delivery row linked to the same case (enforced by a partial unique index on active deliveries). Say the word if re-delivery should reuse the same record.
- **Assumption:** agents are `app_users` with `user_type='driver'`; no separate agents table.

## Build order

1. **Migration 1 — foundation.** Enums, `stations`, RBAC tables (kept, cleaned), `wf_transition` scaffolding, `updated_at`/version triggers, audit trigger helper.
2. **Migration 2 — operational core.** `baggage_cases`, `case_bags`, `deliveries`, `delivery_notes`, event tables, GRANTs + RLS on every table (role-scoped: L&F reads/writes cases only, coordinators deliveries only, agents only deliveries assigned to them, admins all).
3. **Migration 3 — engine.** `wf_transition`, `lf_create_case`, `lf_bulk_status`, `schedule_delivery`, `assign_agent` (issues OTP + passenger link + queues notifications), `agent_accept/collect/start/deliver/fail`, passenger token RPCs rewritten to call `wf_transition`.
4. **Migration 4 — projections + monitoring.** Views, `delivery_public_view` regeneration trigger, `system_health` function (row counts, stuck deliveries, failed notification backlog).
5. **Migration 5 — dev seed.** Idempotent seed guarded so it can never run against a non-empty production database.
6. **Server layer.** `src/lib/*.functions.ts` per domain (cases, deliveries, agents, passenger, admin, notifications), all `requireSupabaseAuth` except the public passenger token path. Zod validation on every input. Typed conflict/permission errors.
7. **Frontend rewire.** Replace `useStore()` with TanStack Query hooks per module; delete `src/lib/store.ts` and `src/lib/persistence.ts`; drop `app_state`, `app_state_history`, and `save_app_state` in the final migration.

## Non-negotiables carried through

- Every `CREATE TABLE` ships with GRANTs, RLS enabled, and role-scoped policies in the same migration.
- Roles stay in `user_roles`/`user_role_assignments`, checked server-side via `has_role`/`has_permission` security-definer functions.
- Passenger access stays token-scoped through security-definer RPCs exposing only approved fields; `anon` gets no table grants.
- No `USING (true)` policies, no service-role RLS workarounds.
- Migrations are forward-only and numbered; each has a documented rollback statement in its description.

## What this deliberately does not include

No new features, no UI redesign, no real provider credentials, no storage buckets, no multi-station scoping. Route optimization stays in the engine layer but keeps its current nearest-neighbour implementation, now persisted to `agent_routes`.

## Risk

The clean break means each module is briefly non-functional until step 7 rewires it. I'll rewire in this order — L&F → Delivery → Agent Portal → Passenger → Admin/monitoring — and report at each boundary. Old demo data is discarded as you instructed; `app_state` is dropped only in the last migration so nothing is lost before you sign off.
