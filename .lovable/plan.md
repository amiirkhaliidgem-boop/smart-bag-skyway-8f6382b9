## Where things actually stand

Verified by reading the code, not assumed:

- `src/lib/store.ts` (1019 lines) is already a read-through projection over PostgreSQL: `refreshOps()` pulls `loadOpsSnapshot`, and every mutation (`lf_*`, `dm_*`, `agent_*`) goes through `callOpsRpc`. `app_state` is no longer read or written.
- `src/lib/admin.functions.ts` already exposes the full Phase C RBAC surface: `getAdminWorkspace`, `saveAppUser`, `setUserStatus`, `deleteAppUser`, `resetUserCredential`, `assignUserRole`, `saveRole`, `deleteRole`, `savePermissions`, `touchLastLogin`.
- The remaining work is not "migrate screens" — it is a set of **no-op stubs and dead bindings** left behind by the Phase A rewrite:
  - `driverPool` is an empty array (`store.ts:374`), and `src/lib/admin/agents.ts` still reads it — agent pickers can render empty.
  - Stubs that silently do nothing: `addCaseDocument`, `removeCaseDocument`, `updateDelivery`, `addDelivery`, `setNotificationStatus`, `drainPendingNotifications`, `addFeedback`, `addQualityIncident`, `addCallLog`, `logIoAudit`, `setStation`, `transitionWorkflow`.
  - `src/lib/__tests__/otp-flow.test.ts` still calls the old synchronous store API and cannot pass.

## Phase B — Operational portals

1. **Delivery Agent portal** (`src/routes/driver-portal.tsx`): keep the UI as-is; confirm every action routes to `agent_advance` / `agent_complete_delivery` / `agent_report_position`, and that the route list reads `agent_routes` / `agent_route_stops` from the snapshot rather than any client-side optimizer. Remove the client `routing/optimize.ts` call path if it is still in play.
2. **Agent directory**: replace `driverPool` with a real source backed by the `list_delivery_agents()` RPC, surfaced through the ops snapshot so assignment dialogs (dispatch, bulk assign) show live agents.
3. **Passenger portal / Track Baggage**: `passenger.$token.tsx` is already on `passenger_get_view`; point `src/components/tracking/track-baggage.tsx` and `passenger.index.tsx` at the same resolver so there is one lookup path.
4. **Feedback + quality**: wire `addFeedback` to `passenger_submit_feedback` and `addQualityIncident` to a real write (new `quality_incidents` insert path), so the read-only dashboards have real producers.

## Phase C — Administration

1. Point `src/routes/admin.tsx` fully at `admin.functions.ts` (it largely is); remove any residual store reads for users/roles.
2. Persist admin-side settings that are currently stubs: `setStation` → `stations` table; `logIoAudit` → `admin_audit_log`; notification state changes → read-only (the outbox owns them, so the stubs get deleted rather than implemented).
3. Contact Center call logs and case documents have **no production tables**. Two options — I'll default to (a) unless you say otherwise:
   - (a) leave them explicitly out of scope and mark the surfaces as non-persistent in the UI, or
   - (b) add `call_logs` and `case_documents` tables + RLS in a migration.

## Decommission

Delete the dead stubs from `store.ts`, delete or rewrite `src/lib/__tests__/otp-flow.test.ts` against the RPC layer, and drop `app_state`, `app_state_history`, `save_app_state`, `archive_app_state_version` in a final migration.

## System-wide validation (after Phase C)

1. **Static**: typecheck + lint + `rg` sweep proving no module imports a removed stub and no file references `app_state`.
2. **Database**: Supabase linter + security scan; confirm RLS and GRANTs on every table; confirm no `SECURITY DEFINER` function is executable by `anon` unless intentionally public.
3. **End-to-end workflow run** driven through the live app with a real signed-in session: create a PIR → set Ready for Delivery → confirm auto-created delivery → schedule → assign agent (OTP + passenger token minted) → agent accepts / collects / starts → OTP-verified delivery → feedback. After each step, assert the state is identical in L&F, Dispatch, Delivery Details, Workflow Monitor, Timeline, Audit, Notifications, Agent Portal, and Passenger Portal.
4. **RBAC matrix**: sign in as each role (admin, L&F officer, coordinator, agent) and verify sidebar visibility plus direct-URL guards.
5. **Runtime consistency**: same route in preview iframe and a fresh tab must render identical data after refresh.
6. **Report**: a written validation report listing what passed, what is unverified, and any remaining architectural gaps.

## Technical notes

- Every mutation keeps passing the row `version` for optimistic concurrency; `40001` surfaces as a reload-and-retry toast.
- No business rules move into React — screens call RPCs and render.
- UI is frozen: this phase changes data sources, not layout.
