## Is the backend foundation complete?

Yes for the database layer. The schema, engines and security are in place:

- Normalized tables: cases, bags, deliveries, notes, OTP challenges, passenger links/view/feedback, notifications + attempts, quality incidents, agent positions/routes, RBAC tables.
- Engines in SQL: `wf_transition` (the only writer of operational state), `wf_journal` (workflow + timeline + audit in one transaction), `wf_queue_notification`, `wf_refresh_passenger_view`, `wf_recompute_route`.
- Action RPCs: `lf_*`, `dm_*`, `agent_*`, `passenger_*`, `notif_*`.
- RLS + grants on every table, append-only journals, token-only anon access.

Not complete: the **application layer**. 32 files still import `src/lib/store.ts`, and `src/lib/persistence.ts` still reads/writes `app_state`. Only `passenger.functions.ts` and `admin.functions.ts` exist. `app_state` is still present in the database and must be dropped last.

## Phase A — Core Workflow

Server layer (new files, all `createServerFn` + `requireSupabaseAuth`, Zod-validated, thin wrappers):

```text
src/lib/cases.functions.ts        list/get cases, lf_create_case, lf_update_case,
                                  lf_set_status, lf_bulk_set_status
src/lib/deliveries.functions.ts   dispatch board, delivery detail, dm_schedule,
                                  dm_assign_agent, dm_resend_otp, dm_add_note,
                                  dm_mark_failed, dm_mark_returned, dm_close
src/lib/journal.functions.ts      timeline_events, audit_events, workflow_events feeds
src/lib/notifications.functions.ts  read-only notification_events + attempts
src/lib/agents.functions.ts       list_delivery_agents
```

Client layer: one query-hooks module per domain (`src/hooks/use-cases.ts`, `use-deliveries.ts`, …) exposing the same shapes the current screens consume, so JSX stays untouched. Loaders use `ensureQueryData`; mutations invalidate the affected keys. Realtime subscription on `deliveries` / `baggage_cases` replaces the `app_state` broadcast channel.

Screens rewired in this order, each fully off `store.ts` before the next: Lost & Found list + detail + PIR wizard + print/export → Delivery dispatch + detail + POD → Workflow Monitor → Timeline → Notification Center.

## Phase B — Operational Portals

- Delivery Agent Portal → `agent_advance`, `agent_complete_delivery`, `agent_report_position`; route list read from `agent_routes` / `agent_route_stops` (no client-side optimization).
- Passenger Portal → already on `passenger_get_view`; verify token issuance now comes from `dm_assign_agent` and remove the store-based token fallback.
- Customer Feedback → read `passenger_feedback` joined to deliveries.
- Track Baggage shared component → resolve through the new tables.

## Phase C — Administration

Users, roles, permissions, RBAC and auth onto `app_users`, `app_roles`, `role_permissions`, `user_role_assignments`, `user_roles`, `admin_audit_log`, via `admin.functions.ts` (extended) and `current_user_permissions` / `has_permission`. Import/Export and Reports move to the new tables in this phase too, since they read every domain.

## Decommission

Only after Phase C: delete `src/lib/store.ts` and `src/lib/persistence.ts`, then a final migration dropping `app_state`, `app_state_history`, `save_app_state`, and `archive_app_state_version`.

## Technical notes

- Every mutation passes the row's `version` for optimistic concurrency; a `40001` error surfaces as a "reload and retry" toast.
- No business rules move into React — screens only call RPCs and render results.
- Some current UI fields have no column yet (call logs, WhatsApp threads, warehouse/storage extras). Where a field has no home in the new schema I'll either map it to `metadata`/notes or flag it as a gap in the phase report rather than inventing a table mid-phase.
- Reporting per phase: what was migrated, what still depends on legacy code, architectural issues found, recommendations before continuing.

## Risk

Each module is briefly broken while it is rewired; the phase boundary is the checkpoint. Old demo data is not recovered — the new tables start empty apart from reference data.
