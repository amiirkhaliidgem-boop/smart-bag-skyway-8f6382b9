# IAB Smart Baggage Ecosystem — Technical & Business Architecture Brief

**Audience:** IT / Infrastructure, Hosting, Security and Support teams
**Date:** 9 August 2026
**Basis:** current production codebase and the live Supabase project, inspected read-only. No code, schema, configuration, Realtime setting or data was changed to produce this document.

Anything that could not be confirmed from the code or the database is marked **UNVERIFIED**. No CPU/RAM/storage figures are invented; where sizing is not established it is stated as requiring capacity testing or provider sizing.

---

## 1. Business Overview

### What the system is

The IAB Smart Baggage Ecosystem is an enterprise web platform that runs the full life of a mishandled bag at an airport station: from the moment a Lost & Found case (PIR) is opened, through storage and hand-off, dispatch to a delivery agent, physical hand-over to the passenger with a one-time code, and the passenger-facing communication and feedback that follows.

### The business problem it solves

Mishandled-baggage operations are traditionally split between disconnected tools: a PIR/airline system, spreadsheets or WhatsApp for delivery dispatch, phone calls to drivers, and manual passenger updates. That split produces the failures the platform is built to remove:

- No single truth about the state of a bag — Lost & Found, dispatch and the driver each hold a different status.
- No audit trail of who changed what and when.
- Passengers phone the station because they have no visibility.
- No measurable SLA, no incident record, no reporting.

### Why it was created

To make one system authoritative. Every status change in the platform flows through a single Workflow Engine implemented **inside PostgreSQL**, so no module — and no user interface — can hold an independent delivery status. Everything else (screens, notifications, dashboards, driver app) is a consumer of that engine.

### Operational workflow, end to end

```text
Lost & Found case (PIR or BAG number)
   → bags registered against the case
   → case worked to "Ready for Delivery"      <-- ownership hands off here
   → Delivery order auto-created (Dispatch Center takes over)
   → Scheduled → Agent assigned (one-time code generated, passenger notified)
   → Driver accepts → Collects → Out for Delivery
   → Delivered (verified by 6-digit one-time code) | Failed → Reschedule / Return to Airport
   → Passenger feedback, quality incidents, reporting
```

Ownership rule (implemented, not aspirational): Lost & Found controls the case up to and including **Ready for Delivery**. At that point the database bootstraps a delivery record and Lost & Found becomes read-only for delivery stages, showing a hand-over banner.

### Business value

- One authoritative status shared by every role and screen.
- Automatic passenger communication instead of manual calls.
- Proof of delivery via one-time code, with a complete audit and timeline per case.
- Measurable SLA per region, with automatic breach detection and quality incidents.
- Bulk import/export for high-volume disruption days.

### Main users

| User | Role key | Responsibility |
| --- | --- | --- |
| Airport Administrator | `admin` | Full access: administration, settings, integrations, monitoring |
| Lost & Found Officer | `agent` | Create and work PIR cases, storage, hand-off to delivery |
| Delivery Coordinator | `coordinator` | Dispatch Center: scheduling, agent assignment, exceptions |
| Delivery Agent (driver) | `driver` | Driver Portal only: route, navigation, collect, deliver, one-time code |
| Passenger | — (public token) | Tracking portal and feedback; no account |

---

## 2. Business Model (operational model)

### Core operational functions

- **Lost & Found operations** — case creation (wizard or bulk import), passenger/flight/bag data, storage location, region assignment, status progression to Ready for Delivery.
- **Delivery Management / Dispatch** — KPI-driven dispatch board, scheduling, single and bulk agent assignment, failure/return handling, proof-of-delivery export.
- **Delivery Agent operations** — driver portal with an optimised stop order, navigation hand-off, stage buttons, and one-time-code completion. Bilingual (EN/AR with RTL).
- **Passenger tracking** — public tokenised portal showing current stage, and the one-time code once the bag is out for delivery.
- **Workflow automation** — the database engine performs every transition, journal entry, notification queue insert and cross-module projection.

### Supporting functions

- **Notifications** — templated bilingual SMS/WhatsApp messages queued by the engine and transported by a scheduled worker.
- **Administration and access control** — staff/driver accounts, roles, granular module permissions.
- **Settings / SLA regions** — operating parameters, SLA hours per region, notification templates, passenger portal content.
- **Integrations / API status** — configuration and health of external services.
- **Data import/export** — Excel/CSV bulk case creation and operational exports.

### Reporting / monitoring functions

- Executive dashboard (server-side aggregate), operational and lifecycle reports, timeline, audit log, notification centre, workflow monitor, delivery agent monitoring, quality incidents and passenger feedback.

### How centralisation is achieved

All modules read a projection of the same PostgreSQL tables and write only through database functions. Cross-screen synchronisation is delivered by a single shared Supabase Realtime channel plus targeted refetches. No module stores its own status.

---

## 3. System Modules

All routes are authenticated staff surfaces unless stated otherwise. Authentication is enforced in the application shell (`src/routes/__root.tsx`) and independently by Row Level Security in the database.

| Module | Route(s) | Purpose | Main users | Access |
| --- | --- | --- | --- | --- |
| Executive Dashboard | `/` | KPIs, charts, live operational overview | admin, agent, coordinator | Authenticated |
| Lost & Found | `/lost-found`, `/lost-found/$bagId` | Case list, PIR wizard, case details, bulk actions, import/export | admin, agent | Authenticated |
| Storage | `/storage` | Storage zone/shelf/position control | admin, agent | Authenticated |
| QR Scan | `/qr-scan` | Bag tag scanning entry point | admin, agent | Authenticated |
| Delivery Dispatch | `/delivery`, `/delivery/$deliveryId` | Dispatch board with KPIs; 7-tab delivery console | admin, coordinator | Authenticated |
| Delivery Agent Monitoring | `/agent-monitoring` | Read-only live agent positions and routes | admin, coordinator | Authenticated |
| Driver Portal | `/driver-portal` | Agent workspace: optimised stops, navigation, stage actions, one-time code | admin, driver | Authenticated |
| Passenger Portal (public) | `/passenger/$token` | Tokenised passenger tracking, one-time code, feedback | Passengers | **Public** |
| Passenger (staff view) | `/passenger`, `/tracking` | Staff-side tracking/lookup | admin (+ agent/coordinator for `/tracking`) | Authenticated |
| Workflow Monitor | `/workflow-monitor` | Live transition monitor | admin | Authenticated |
| Notification Center | `/notifications` | Queue, attempts, states, templates in action | admin | Authenticated |
| Timeline | `/timeline` | Cross-module chronological event feed | admin | Authenticated |
| Reports | `/reports` | Operational and lifecycle reporting, quality management | admin, agent | Authenticated |
| Feedback | `/feedback` | Passenger CSAT dashboard | admin, agent | Authenticated |
| Administration | `/admin` | Staff/driver accounts, roles, module permissions, audit | admin | Authenticated |
| Settings | `/settings` | General, SLA regions, notification templates, portal content, security | admin | Authenticated |
| Integrations | `/integrations` | Integration Center: credentials, enable/disable, test | admin | Authenticated |
| API Status | `/api-status` | Health/latency samples of internal APIs and integrations | admin | Authenticated |
| Data I/O | `/data-io` | Import/export console | admin, agent | Authenticated |
| Contact Center | `/contact-center` | Placeholder surface (coming-soon component) | admin | Authenticated |
| Auth | `/auth` | Unified sign-in with role-based redirect | everyone | **Public** |
| Public API routes | `/api/public/notifications/drain`, `/api/public/system/health-sweep` | Scheduled workers | pg_cron | **Public URL, key-protected** |

### Engines (not screens)

| Engine | Where it lives | Function |
| --- | --- | --- |
| Workflow Engine | PostgreSQL functions (`wf_*`, `lf_*`, `dm_*`, `agent_*`) | Every state transition, validation, locking, journalling, notification queueing |
| Notification Engine | `notification_events` + `notification_templates` + drain worker | Bilingual message rendering, outbox queue, retries |
| Audit / Timeline | `audit_events`, `workflow_events`, `timeline_events`, `admin_audit_log` | Append-only history (all mutations denied to clients) |
| Route Optimisation | `src/lib/routing/optimize.ts` + `wf_recompute_route`, `agent_routes`, `agent_route_stops` | Nearest-neighbour stop ordering from the station origin |
| Quality Management | `quality_incidents`, `qm_*` functions, `qm_sweep_sla` cron | Incident capture and SLA breach sweep |

Module-to-module communication happens **only** through the database: a screen calls an RPC, the engine writes the canonical rows, and every other screen learns about it via Realtime or its next refetch.

---

## 4. End-to-End Architecture

```text
Browser (staff, driver, passenger)
   │  HTTPS
   ▼
TanStack Start application (React 19, SSR + client) — hosted by Lovable
   ├── TanStack Router (file-based routes in src/routes)
   ├── TanStack Query (server-state cache)
   ├── Operational store (src/lib/store.ts) — read-only projection, no business rules
   └── Shared Realtime hub (src/lib/realtime.ts)
   │
   ├── Server functions (createServerFn, run server-side only)
   └── Public server routes (src/routes/api/public/*)
   │  HTTPS
   ▼
Supabase (managed) — project sxjuhoghypsbuqquhxib
   ├── Auth (email/password; JWT bearer)
   ├── PostgREST Data API + RPC
   ├── PostgreSQL (normalised schema, RLS on every table, workflow functions)
   ├── Realtime (WebSocket, postgres_changes)
   └── Storage — NOT USED (zero buckets, verified)
   │
   ├── pg_cron  → pg_net → HTTPS back into the app's /api/public/* workers
   └── External transports (Twilio / SMS gateway / WhatsApp) — configured but currently disabled
```

| Layer | Technology (verified) |
| --- | --- |
| Frontend framework | React 19 + TanStack Start v1 on Vite 7, TypeScript |
| Styling / UI | Tailwind CSS v4, Radix UI (shadcn-style components), Framer Motion, Lucide icons |
| Routing | TanStack Router, file-based (`src/routes`), generated `routeTree.gen.ts` |
| Server state | TanStack Query v5 |
| Application store | `src/lib/store.ts` — `useSyncExternalStore` projection cache in three tiers (core / activity / secondary) |
| Server functions | `createServerFn` in `src/lib/*.functions.ts` (admin 11, settings 9, system 7, ops 5, passenger 3, reports 3, dashboard 2) |
| Server runtime | Nitro build targeting Cloudflare Workers (Lovable default target) |
| Auth transport | Bearer JWT attached client-side (`attachSupabaseAuth`), validated server-side (`requireSupabaseAuth` → `auth.getClaims`) |
| Database | Supabase PostgreSQL, 32 public tables, 12 enum types, ~120 functions |
| Extensions installed | `pg_cron` 1.6.4, `pg_net` 0.20.4, `pgcrypto` 1.3, `uuid-ossp` 1.1, `pg_stat_statements` 1.11, `supabase_vault` 0.3.1, `plpgsql` |
| Realtime | Supabase Realtime, one shared channel `app_sync` |
| Object storage | **Not used** — no storage buckets exist |
| Excel/CSV | `xlsx` library, client-side generation |

### External integrations — actual state

Read live from `public.integrations`:

| Integration | Provider | Enabled | Status |
| --- | --- | --- | --- |
| Cloud Database | Supabase (PostgreSQL) | yes | connected (last success 09 Aug 2026 10:40 UTC) |
| Google Maps Platform | Google | no | not_configured |
| SMS Gateway | (unset) | no | not_configured |
| WhatsApp Business | Meta Cloud API | no | not_configured |
| Email Provider | SMTP | no | not_configured |
| Odoo ERP | Odoo | no | not_configured |
| Mobile Platform | IAB Mobile | no | not_configured |

**Important for IT:** no messaging transport is currently connected. Notifications are being generated and queued correctly but not physically sent; they remain `queued` (not failed) and will send once credentials are entered in the Integration Center. Navigation from the Driver Portal uses a plain Google Maps deep link, which needs no API key; the Google Maps *Platform* integration (for geocoding/route quality) is not configured.

### Scheduled jobs (pg_cron, verified live)

| Job | Schedule | Action |
| --- | --- | --- |
| `drain-notification-outbox` (id 3) | every 2 minutes | HTTPS POST to `/api/public/notifications/drain` |
| `api-health-sweep` (id 4) | every 5 minutes | HTTPS POST to `/api/public/system/health-sweep` |
| `sla-breach-sweep` (id 5) | every 15 minutes | `SELECT public.qm_sweep_sla();` in-database |

**Risk (verified, must be fixed at go-live):** jobs 3 and 4 currently point at the **preview** host `project--75f669c5-…-dev.lovable.app`. Production scheduling must be repointed to the production URL after publishing.

---

## 5. Database Architecture

32 tables in `public`. Row Level Security is **enabled on all 32**. Most operational tables carry a single policy that permits reads to authorised staff and **denies INSERT/UPDATE/DELETE outright** — writes are only possible through `SECURITY DEFINER` workflow functions.

### Main tables

| Domain | Tables |
| --- | --- |
| Cases & bags | `baggage_cases`, `case_bags`, `stations`, `sla_regions` |
| Delivery | `deliveries`, `delivery_notes`, `failure_reasons`, `otp_challenges` |
| Agents / routing | `app_users`, `agent_positions`, `agent_routes`, `agent_route_stops` |
| Passenger-facing | `passenger_links`, `passenger_view`, `passenger_feedback` |
| Notifications | `notification_templates`, `notification_events`, `notification_attempts` |
| History (append-only) | `workflow_events`, `timeline_events`, `audit_events`, `admin_audit_log` |
| Access control | `app_roles`, `role_permissions`, `user_role_assignments`, `user_roles` |
| Platform | `system_settings`, `integrations`, `integration_events`, `api_health_checks`, `quality_incidents`, `number_counters` |

### Key relationships

```text
stations 1─┬─* baggage_cases *─1 sla_regions
           │        │ 1
           │        ├──* case_bags            (one row per physical bag, unique bag_tag)
           │        └──1 deliveries           (exactly one delivery per case, verified 0 violations)
           │                 │
           │                 ├──* otp_challenges       (one active code)
           │                 ├──* delivery_notes
           │                 ├──1 passenger_view       (denormalised passenger projection)
           │                 ├──* passenger_links      (tokenised public access)
           │                 ├──* notification_events ──* notification_attempts
           │                 └──* workflow_events / timeline_events / audit_events
app_users 1─┴─* deliveries.assigned_agent_id, agent_positions, agent_routes ──* agent_route_stops
app_users *─* app_roles  (via user_role_assignments) ; app_roles 1─* role_permissions
```

All primary keys are UUIDs except the append-only event tables (`audit_events`, `timeline_events`, `workflow_events`, `notification_attempts`, `integration_events`, `api_health_checks`), which use bigint identities, and `number_counters` / `system_settings`, which are keyed by text.

### Indexes

114 indexes across the public schema. The heaviest-read tables are the most indexed: `deliveries` (16, 3 unique), `baggage_cases` (12, 3 unique), `audit_events` (6), `quality_incidents` (6), `agent_route_stops` (5), `case_bags` (5), `notification_events` (5), `timeline_events` (5), `passenger_feedback` (5). Uniqueness is enforced on case numbers, delivery numbers, bag tags per case, agent route stop sequence, passenger link tokens, role keys and usernames/employee IDs.

### Access model

- Every table: RLS enabled.
- Reads: gated by `is_ops_staff()`, `current_app_user_id()`, `has_permission()` or `agent_owns()`, written as scalar sub-selects so they evaluate once per request rather than once per row.
- Writes: denied at the policy level on operational tables; performed by `SECURITY DEFINER` functions that first call `wf_require()` for role checks.
- Passenger access: no direct table access at all. The portal calls `passenger_get_view(token)`, `passenger_submit_feedback(...)` and `passenger_report_misconduct(...)`, all `SECURITY DEFINER`, all keyed by an opaque token.

### Triggers and integrity protections

~30 non-internal triggers, principally: `bump_version()` (optimistic concurrency counters), `set_updated_at()`, `deny_mutation()` (hard block on append-only journals), `case_bags_tag_unique()` (bag tag collision guard), `otp_validate_expiry()`, and `wf_block_pickup_delivery()` (prevents delivery actions on Airport Pickup cases). An event trigger `rls_auto_enable()` enables RLS automatically on any newly created table; its EXECUTE privilege has been revoked from `PUBLIC`, `anon` and `authenticated`.

Sequential business numbers (`CASE-…`, `DLV-…`, `INC-…`) come from `alloc_number()` over `number_counters`, which is fully locked down (no policies, no client access).

### Concurrency / locking

- `wf_lock_case()` / `wf_lock_delivery()` take a bounded row lock with a 2-second `lock_timeout`.
- A lock that cannot be taken is converted into a **business conflict raised as SQLSTATE `PT409`**, so PostgREST answers HTTP 409 immediately. `40001` is deliberately never used, because PostgREST retries serialization failures and leaks pooled connections.
- Every mutable row carries a `version` column; RPCs accept `p_expected_version` and reject stale writes.
- The client retries *lock* conflicts twice with jittered backoff, and surfaces *version* conflicts to the operator instead of silently overwriting.
- The notification worker claims rows with `FOR UPDATE SKIP LOCKED` (`notif_claim_batch_atomic`), so overlapping runs cannot double-send.

### Primary data flow

```text
lf_create_case()      → baggage_cases + case_bags (+ audit, timeline)
lf_set_status(Ready)  → wf_open_delivery() → deliveries row + passenger link + passenger_view
dm_schedule()         → stage Scheduled
dm_assign_agent()     → stage Assigned + 6-digit otp_challenges row + notification_events(queued)
                        + wf_recompute_route() → agent_routes / agent_route_stops
agent_advance()       → Driver Accepted → Collected → Out for Delivery (notification each step)
agent_complete_delivery(code) → verifies otp_challenges → Delivered
                        → passenger_view refresh, feedback link, closing notification
every step            → workflow_events + timeline_events + audit_events (append-only)
pg_cron drain worker  → notification_events → SMS/WhatsApp adapter → notification_attempts
```

Current live volumes (informational): 29 cases, 20 deliveries, 164 notification events, 24 notification templates, 6 staff/agent records, 11 auth users, 5 SLA regions, 1 station.

---

## 6. Authentication & Authorization

### Mechanism

Supabase Auth with email/password credentials issuing JWTs. The browser client persists the session; every server-function call attaches `Authorization: Bearer <token>` through a global client middleware, and the server validates it with `supabase.auth.getClaims(token)` before any data access. The database independently enforces RLS using the same identity — a forged or missing token fails twice over.

### Identity model

- `auth.users` — the credential record (11 rows).
- `public.app_users` — the operational staff profile (employee ID, username, full name, department, station, team, position, status, user type), linked by `user_id`.
- Staff sign in with a **username**, resolved to the underlying login identity by `login_identity_for_username()`; e-mail is optional for staff accounts.
- Delivery Agents additionally have a PIN (`driver_pin_hash` / `driver_pin_salt`), salted SHA-256 with constant-time comparison (`src/lib/admin/pin.server.ts`).

### Roles and permissions

Two layers, both live:

1. **Legacy role matrix** (`src/lib/rbac.ts`) — four roles (`admin`, `agent`, `coordinator`, `driver`) mapped to route prefixes. Used as a fallback for accounts with no managed permission records.
2. **Granular RBAC** — `app_roles` → `role_permissions` (module × action) → `user_role_assignments`, evaluated by `has_permission()` and `current_user_permissions()` in the database and mirrored in the UI via `useLivePermissions`.

Roles are stored in dedicated tables (`user_roles`, `user_role_assignments`), never on the profile row, and are read through `SECURITY DEFINER` helpers (`has_role`, `has_permission`, `is_ops_staff`) to avoid recursive RLS. Delivery Agents are hard-confined to `/driver-portal` regardless of any other grant.

### Admin access

Administration screens are admin-only in the UI and re-checked server-side (`src/lib/admin/guard.server.ts`) before any privileged operation. Privileged operations use the service-role client, loaded lazily inside handlers so it never reaches the browser bundle. Administrative changes are recorded in `admin_audit_log` (append-only).

### Account lifecycle

Accounts are created, edited, suspended and re-credentialed from the Administration module. Profile edits (including username changes) are synchronised into Supabase Auth in the same operation, so credentials never drift from the profile.

### Public access

Only two public surfaces exist: `/auth` and `/passenger/{token}`. The passenger portal has no session; it exchanges an opaque token from `passenger_links` for a narrowly projected view through `passenger_get_view()`. Tokens support expiry and revocation columns and record `view_count` / `last_viewed_at`. The application store explicitly refuses to hydrate on `/passenger/*`, so no authenticated read is ever attempted from a public page.

### The two scheduled worker endpoints

`/api/public/notifications/drain` and `/api/public/system/health-sweep` are publicly routable but reject any request that does not present the project publishable key in an `apikey` header. **UNVERIFIED / recommendation:** the publishable key is a weak shared secret for this purpose; a dedicated worker secret would be stronger (see §17).

---

## 7. Workflow Engine (critical section)

### Why it is the single source of truth

The engine is not application code — it is a set of `SECURITY DEFINER` PostgreSQL functions, and RLS **denies direct INSERT/UPDATE/DELETE** on `baggage_cases`, `deliveries`, `otp_challenges`, `passenger_view` and every journal table. There is therefore no path, from any client, any screen, or any future mobile app, that can change an operational status without going through the engine. `src/lib/store.ts` states this explicitly and contains no business rules.

### Stages and transitions

Nine canonical delivery stages: Ready for Delivery → Scheduled → Assigned → Driver Accepted → Collected → Out for Delivery → Delivered | Delivery Failed → Returned to Airport. Legality is decided by `wf_stage_allowed(from, to)`; Lost & Found status and workflow status are derived from the stage by `wf_stage_lf()` and `wf_stage_workflow()`, so the three vocabularies can never disagree.

### What one transition does, atomically

`wf_transition(delivery, to_stage, reason, metadata, expected_version)`:

1. Locks the delivery (`wf_lock_delivery`, 2 s timeout).
2. Asserts the caller's role (`wf_require`).
3. Asserts the expected version (`wf_assert_version`) — optimistic concurrency.
4. Validates the transition (`wf_stage_allowed`).
5. Writes the new stage plus derived case status and the stage timestamp.
6. Journals to `workflow_events`, `timeline_events` and `audit_events` (`wf_journal`).
7. Queues the passenger notification (`wf_queue_notification*`).
8. Refreshes `passenger_view` and, where relevant, the agent route.

All of it in one transaction: either every consequence happens or none does.

### Simultaneous edits by different roles

If a Coordinator assigns an agent while a Lost & Found Officer edits the same case and the driver taps "Collected":

- Whoever acquires the row lock first wins and completes normally.
- A caller that cannot take the lock within 2 seconds gets `PT409` → HTTP 409. Nothing was written, so the browser silently retries twice with jittered backoff; the operator usually sees nothing.
- A caller whose `version` no longer matches gets a *version* conflict, which is **not** retried — the UI shows "This record changed elsewhere — reload and retry", so no one silently overwrites a colleague.
- An illegal transition (e.g. Collected before Assigned) is rejected by validation regardless of ordering.

Stress-verified: 5 and 10 concurrent writers on the same case produced exactly 1 winner and 4/9 clean conflicts, 0 errors, 0 deadlocks, 0 duplicate rows and 0 illegal stages.

---

## 8. Realtime Architecture (current implementation)

### Shared hub

`src/lib/realtime.ts` owns a **single** Supabase channel named `app_sync`. Consumers call `subscribeRealtime(tables, handler)` and receive an idempotent unsubscribe function.

- **Ref-counting:** the channel opens on the first subscriber and is torn down with `supabase.removeChannel()` when the last one leaves. Re-renders, route changes and tab refocus cannot accumulate duplicates.
- **Per-table dispatch:** handlers register only the tables they depend on, so a settings event never triggers an operational refresh and a delivery event never wakes a settings-only consumer.
- **Tables bound:** `deliveries`, `baggage_cases`, `notification_events`, `workflow_events`, `quality_incidents`, `passenger_feedback`, `system_settings`, `sla_regions`, `notification_templates`.

### Consumers

| Consumer | Tables | Effect |
| --- | --- | --- |
| Operational store | deliveries, baggage_cases, notification_events | Debounced (750 ms) tier refresh; deferred entirely while the tab is hidden |
| Executive dashboard | baggage_cases, deliveries, workflow_events, quality_incidents, passenger_feedback | Invalidates the `executive-dashboard` query |
| Settings hook (5 mount points) | system_settings, sla_regions, notification_templates | One shared listener instead of one channel per instance |

Result: 1 WebSocket topic per tab instead of the previous 3–5.

### Remaining polling, and why

| Surface | Interval | Reason |
| --- | --- | --- |
| Passenger portal (`/passenger/$token`) | 5 s, stops at terminal stages | Anonymous page with no session — it cannot join the authenticated hub |
| Public settings query | 60 s + refetch on focus | Same reason; settings change rarely |
| Agent monitoring | 15 s | `agent_positions` GPS data is not carried by the hub |
| API status / integrations | 30 s / 60 s | Health sampling, not operational state |
| Workflow monitor | 30 s | Re-renders relative timestamps only; no fetch |

### Known limitation — must be checked before go-live

**Verified finding:** the Supabase Realtime publication (`supabase_realtime`) currently contains only `notification_events`, `notification_templates`, `sla_regions` and `system_settings`. The operational tables the hub subscribes to — `baggage_cases`, `deliveries`, `workflow_events`, `quality_incidents`, `passenger_feedback` — are **not in the publication**, so those `postgres_changes` events are not being broadcast today. Operational screens still converge, because every write triggers an immediate local tier refresh and other tabs pick changes up on focus/refetch, but true cross-user push for cases and deliveries requires adding those tables to the publication (`ALTER PUBLICATION supabase_realtime ADD TABLE …`). This is a configuration change and was deliberately **not** made while producing this document.

Other limitations: the store's hub subscription is released on `beforeunload` (module singleton, one per tab); realtime fan-out is the main cost driver as data grows beyond ~100 concurrent users.

**Realtime is a synchronisation transport only.** No business rule, validation, status derivation or notification decision depends on it. If Realtime were completely unavailable, the system would remain correct — screens would simply refresh on action, navigation or focus rather than instantly.

---

## 9. Notification Architecture

### Generation

Nothing in the application decides to send a message. The Workflow Engine calls `wf_queue_notification()` / `wf_queue_notification_key()` inside the transition transaction, renders the bilingual template (`notification_templates`, 24 rows, EN + AR subject/body per trigger, `wf_fill_template` for placeholders) and inserts a `notification_events` row in state `queued`.

### Outbox and worker

`notification_events` is a durable outbox with `state`, `attempt_count`, `next_attempt_at`, `last_attempt_at`, `sent_at`, `provider`, `provider_message_id`, `failure_reason`. Every physical send attempt is recorded in `notification_attempts`.

The single transport worker is `POST /api/public/notifications/drain`, called by pg_cron every 2 minutes:

1. Verifies the `apikey` header.
2. Claims up to 20 events atomically with `notif_claim_batch_atomic` (`FOR UPDATE SKIP LOCKED`, max 5 attempts) — overlapping runs cannot double-send.
3. Resolves a channel adapter: Integration Center configuration first, legacy Twilio environment credentials second.
4. If no transport is configured the event is **left queued with its attempt budget intact** — an unconfigured channel is an operator task, not a delivery failure.
5. Otherwise sends, then records the result and any provider error verbatim.

### One-time code (OTP)

Generated in the database by `dm_assign_agent()` as a 6-digit code in `otp_challenges` (state, attempts, max_attempts, issued/expires/verified/locked timestamps, validated by `otp_validate_expiry`). It is delivered to the passenger by notification and shown in the passenger portal **only from "Out for Delivery" onwards**. Completion is `agent_complete_delivery(delivery, code)` — verification happens in the database, never in the driver's browser. `dm_resend_otp()` reissues.

### Recipient validation

`src/lib/phone/egypt.ts` is the single source of truth, used identically by the PIR wizard, bulk import and the Notification Center: exactly 11 digits, starting 010/011/012/015; `+20`, `0020`, spaces, dashes and letters are rejected with a specific operator message. Conversion to E.164 (`+20…`) happens only in the transport adapter at send time.

### Auditability

Every queued event, every attempt, and every workflow transition that caused them is retained; `notification_events`, `notification_attempts` and the journals are append-only (client mutations denied). The Notification Center exposes the whole chain to administrators.

### Current state

No SMS/WhatsApp/Email transport is configured, so messages accumulate as `queued` (164 events at time of writing) and will flush automatically once credentials are entered.

---

## 10. Hosting & Deployment Requirements

### Required for production

| Area | Requirement |
| --- | --- |
| Frontend + server functions | The application is one deployable unit (TanStack Start, Nitro/Cloudflare Workers target). Currently hosted by **Lovable**; publishing produces `*.lovable.app`. Self-hosting is possible but is a separate exercise. |
| Compute | Serverless/edge; no persistent process, no local filesystem, no native binaries, no child processes. Sizing is provider-managed — **no CPU/RAM figures can be stated without capacity testing.** |
| Database | Supabase PostgreSQL project `sxjuhoghypsbuqquhxib`, with `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`, `pg_stat_statements`. Plan/tier sizing must be confirmed with Supabase against expected concurrency. |
| Connection capacity | PostgREST currently caps at 11 pooled connections; verified adequate to ~100 concurrent clients after the fan-in RPC work. Higher concurrency requires a pool/plan review. |
| Network | Outbound HTTPS from Supabase (pg_net) to the app host; outbound HTTPS from the app host to Supabase and to SMS/WhatsApp providers. |
| HTTPS/SSL | Mandatory end to end. Provided automatically on `*.lovable.app`; a custom domain issues its own certificate. |
| DNS / domain | A production domain must be chosen and pointed at the published app before the cron workers are repointed. |
| Environment variables | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, plus browser copies `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. |
| Secrets (server-only) | `ADMIN_SERVICE_ROLE_KEY` (Supabase service role), `INTEGRATION_CONFIG_SECRET` (encrypts integration credentials at rest), `LOVABLE_API_KEY` (platform-managed). `QA_USER` / `QA_PASS` exist from testing and **should be removed before production**. |
| Scheduled workers | Three `pg_cron` jobs must remain enabled; jobs 3 and 4 must be repointed from the `-dev` preview URL to production. |
| External connectivity | At least one SMS or WhatsApp transport must be connected for passenger messaging to physically send. |
| Access management | Supabase dashboard access restricted to named administrators; service-role key held only as a platform secret. |

### Recommended / future improvement

- Dedicated worker secret for `/api/public/*` instead of the publishable key.
- External uptime monitoring and alerting on the two worker endpoints and on `notification_events` queue depth.
- Centralised log shipping and retention beyond the provider defaults.
- Documented restore drill (see §14).
- Staging Supabase project separate from production (today one project serves all environments).
- WAF / rate limiting in front of the public passenger portal.
- Server-side pagination and row-level realtime updates before exceeding ~100 concurrent users.

---

## 11. Environments

| Environment | Application host | Database | Notes |
| --- | --- | --- | --- |
| Development | Local Vite dev server (`bun dev`, port 8080) | **The same Supabase project** | Developer machines talk to live data |
| Preview / Staging | `id-preview--75f669c5-…lovable.app` and the stable `project--75f669c5-…-dev.lovable.app` | **The same Supabase project** | Preview requires a Lovable login unless a share link is issued |
| Production | Not published yet — no `*.lovable.app` production URL and no custom domain exist | **The same Supabase project** | Publishing is a prerequisite for the domain and for repointing cron |

**Deployment flow:** changes land in the preview build automatically; frontend/server changes go live only when "Publish → Update" is clicked. Database migrations and Supabase changes apply immediately to the single shared project — there is no separate staging database.

**Known risks (both verified):**

1. There is exactly **one database** behind development, preview and production. A development mistake touches production data. Separating environments requires a second Supabase project and is a project decision, not a code change.
2. The notification drain and health sweep cron jobs currently call the **preview** host. If preview is ever paused, rebuilt or access-restricted, passenger notifications stop silently. This must be repointed at go-live.

---

## 12. Performance & Capacity

### Verified measurements (from `docs/concurrency-capacity-report.md`, re-run after the fixes)

| Test | Result |
| --- | --- |
| 5 writers, same case | 1 winner, 4 conflicts, 0 errors, 147 ms wall |
| 10 writers, same case | 1 winner, 9 conflicts, 0 errors, 213 ms wall |
| 25 writers, different cases | 25 winners, 0 conflicts, 0 errors, 698 ms wall |
| 50 concurrent users, full 3-tier refresh | 18.8 s → **~4.7 s**, 0 errors |
| 100 concurrent clients, 300 requests | pool exhaustion (`PGRST003`) → **stable, 0 errors** |
| Passenger view, 50 parallel calls | 108 ms p50 / 190 ms max, 0 errors |
| `ops_core_rows` server time | 391 ms → ~180 ms |

Optimisations that produced these numbers: three fan-in RPCs collapsing ~24 client connections into 3; RLS policies rewritten as scalar sub-selects; an index on `deliveries(assigned_agent_id)`; realtime debounce raised to 750 ms with hidden-tab deferral; post-write refreshes limited to the Core and Activity tiers. The later Realtime consolidation cut each tab from 3–5 channels to 1 and the passenger portal's settings polling from 720 to 60 requests/hour.

### Expected behaviour

| Concurrent users | Expectation |
| --- | --- |
| 10–25 | Comfortable, sub-second interactions |
| 50 | Verified good |
| 100 | Verified stable |
| 200+ | Requires the roadmap work below |

### Future scaling roadmap (not blocking)

Server-side pagination per screen instead of whole-table snapshots; row-level realtime updates instead of tier re-pulls; covering indexes for list sorts; a PostgREST pool/plan review.

---

## 13. Security

| Control | Implementation |
| --- | --- |
| Authentication | Supabase Auth, JWT bearer; validated server-side on every server function |
| Authorization | Four-role matrix plus granular module×action RBAC in the database; drivers hard-confined to their portal |
| RLS | Enabled on all 32 public tables; writes denied on operational tables; reads scoped by security-definer helpers |
| Privilege escalation | Roles stored in dedicated tables, never on the profile; role checks always via `SECURITY DEFINER` functions |
| Public/tokenised access | Passenger portal has no table access; opaque token → `passenger_get_view()` with a narrow projection; tokens support expiry/revocation and are usage-tracked |
| Secrets | Server-only environment secrets; integration credentials encrypted at rest with `INTEGRATION_CONFIG_SECRET`; service-role client lazy-loaded inside handlers so it never enters a browser bundle |
| API exposure | Only two public endpoints, both key-checked; everything else requires a bearer token |
| Database access | No direct client SQL; all writes through vetted functions; `number_counters` fully inaccessible to clients |
| Audit logging | `audit_events`, `workflow_events`, `timeline_events`, `admin_audit_log`, `integration_events`, `notification_attempts` — all append-only |
| One-time code security | Generated and verified server-side, bounded attempts, expiry and lock states, never validated in the browser |
| Session handling | Session in browser storage; token refreshed by the Supabase client; sign-out clears state and redirects |
| PIN handling | Salted SHA-256 with constant-time comparison |

### Production security considerations

- Remove the `QA_USER` / `QA_PASS` secrets and any residual test accounts.
- Replace the publishable-key check on `/api/public/*` with a dedicated worker secret.
- **UNVERIFIED:** password policy, MFA and session lifetime are Supabase Auth dashboard settings that were not inspected; IT should review them.
- **Recommended:** driver PINs would be better protected by a slow KDF (bcrypt/argon2) than SHA-256, though salting and constant-time comparison are already in place.

---

## 14. Backup, Recovery, Monitoring

### What exists today

- **In-application health monitoring:** the health sweep writes `api_health_checks` every 5 minutes; the API Status screen shows uptime/latency; `integration_events` records every integration action.
- **Application error capture:** `src/lib/error-capture.ts` and `src/lib/lovable-error-reporting.ts` report runtime errors; server errors render a safe error page and are logged to the platform.
- **Full operational audit trail** in the database (append-only).

### What does NOT exist / could not be verified

- **Database backups: UNVERIFIED.** Supabase performs automated backups according to the project's plan, but the retention, point-in-time-recovery availability and the last successful backup were **not confirmed** and no backup has been restored or tested. Do not assume backup coverage until IT confirms it in the Supabase dashboard.
- **Disaster recovery: not configured.** No documented RTO/RPO, no secondary region, no tested restore procedure.
- **No external monitoring or alerting.** If the drain worker stops, nothing pages anyone — it is only visible on the API Status screen.
- **No log retention policy** beyond provider defaults.

### What IT must provide

Confirmed backup plan with stated RPO/RTO; a rehearsed restore; uptime and endpoint monitoring with alerting; queue-depth alerting on `notification_events`; log shipping and retention; an incident/on-call process.

---

## 15. External Dependencies

| Dependency | Purpose | Required for core operation? | Configuration / secret required? |
| --- | --- | --- | --- |
| Supabase (Auth, PostgreSQL, PostgREST, Realtime) | Identity, data, workflow engine, sync | **Yes — hard dependency** | Yes: `SUPABASE_URL`, publishable key, `ADMIN_SERVICE_ROLE_KEY` |
| Lovable hosting | Serves the app and the server functions | **Yes (current architecture)** | Managed; `LOVABLE_API_KEY` |
| pg_cron + pg_net | Notification drain, health sweep, SLA sweep | **Yes** for automated notifications and SLA breaches | Job definitions must point at the production URL |
| SMS gateway / Twilio | Physical SMS delivery of status + one-time code | Yes for passenger messaging; the workflow itself still completes without it | Yes — not configured today |
| WhatsApp Business (Meta Cloud API) | Alternative message channel | No (optional channel) | Yes — not configured today |
| Email / SMTP provider | Email notifications | No | Yes — not configured today |
| Google Maps deep links | Driver navigation hand-off | Yes for navigation; needs no key | No |
| Google Maps Platform API | Geocoding / richer routing | No — not used today | Yes — not configured |
| Odoo ERP | Future ERP integration | No | Yes — not configured |
| IAB Mobile Platform | Future mobile app | No | Yes — not configured |
| Google Fonts / Fontshare CDNs | Web fonts | No (cosmetic) | No |
| Supabase Storage | — | **Not used** (no buckets) | No |

---

## 16. Deployment Architecture Diagram

```text
                    Internet
   ┌──────────────┬──────────────┬────────────────┐
   │ Staff        │ Delivery     │ Passengers     │
   │ browsers     │ agents       │ (public link)  │
   └──────┬───────┴──────┬───────┴───────┬────────┘
          │ HTTPS        │ HTTPS         │ HTTPS
          ▼              ▼               ▼
  ┌──────────────────────────────────────────────────┐
  │  Web Application  (TanStack Start / React 19)    │
  │  SSR + client · TanStack Router · Query · Store  │
  │  Shared Realtime hub  ("app_sync", ref-counted)  │
  └───────────────┬──────────────────────────────────┘
                  │
  ┌───────────────▼──────────────────────────────────┐
  │  Application / Server Functions (edge runtime)   │
  │  createServerFn (ops, admin, settings, reports,  │
  │  system, passenger, dashboard)                   │
  │  Public routes: /api/public/notifications/drain  │
  │                 /api/public/system/health-sweep  │
  └───────────────┬──────────────────────────────────┘
                  │ HTTPS (bearer JWT / service role)
  ┌───────────────▼──────────────────────────────────┐
  │                   Supabase                       │
  │  ├── Auth            (JWT, staff + agent)        │
  │  ├── PostgreSQL      (32 tables, workflow fns)   │
  │  ├── RLS             (enabled on every table)    │
  │  ├── RPC / Functions (wf_*, lf_*, dm_*, qm_*)    │
  │  ├── Realtime        (postgres_changes)          │
  │  └── Storage         (NOT USED)                  │
  │  Extensions: pg_cron · pg_net · pgcrypto ·       │
  │              uuid-ossp · pg_stat_statements      │
  └───────┬──────────────────────────┬───────────────┘
          │ pg_cron + pg_net         │
          │ every 2 / 5 / 15 min     │
          ▼                          ▼
  back into /api/public/*     in-database qm_sweep_sla()
          │
          ▼
  ┌──────────────────────────────────────────────────┐
  │  External transports (NOT CONFIGURED TODAY)      │
  │  SMS gateway · WhatsApp Cloud API · SMTP · Odoo  │
  └──────────────────────────────────────────────────┘
  Google Maps deep links open directly from the driver's device.
```

---

## 17. Critical IT Questions — pre-production checklist

**Hosting & deployment**

1. Does the app stay on Lovable hosting, or must it be self-hosted? If self-hosted, on what platform (the build targets an edge/Workers runtime)?
2. Who owns the publish action, and what is the change-approval process for production releases?
3. Is a rollback procedure defined?

**Domain, DNS, SSL**

4. What is the production domain, and who controls its DNS?
5. Who owns certificate lifecycle if a custom domain is used?

**Environment & secrets**

6. Where are `ADMIN_SERVICE_ROLE_KEY` and `INTEGRATION_CONFIG_SECRET` escrowed, and what is the rotation policy?
7. Confirm removal of `QA_USER` / `QA_PASS` and all test accounts before go-live.
8. Will a separate Supabase project be created for staging/development, or is a single shared database accepted as a business risk?

**Database**

9. Which Supabase plan/tier, and has it been sized against expected concurrency?
10. Who has Supabase dashboard and SQL access in production, and under what approval?
11. Is Point-in-Time Recovery available and enabled on the plan?

**Backup & recovery**

12. What are the agreed RPO and RTO?
13. When will the first restore drill be performed, and by whom?

**Monitoring & logging**

14. What tool monitors the two worker endpoints, and who is paged on failure?
15. Is there an alert on notification queue depth and on SLA breach volume?
16. What is the log retention period and where are logs shipped?

**Network & security**

17. Is any IP allow-listing or WAF required in front of the public passenger portal?
18. Should `/api/public/*` move to a dedicated worker secret (recommended)?
19. What password policy, MFA requirement and session lifetime should be configured in Supabase Auth?
20. Is a penetration test required before go-live?

**Scheduled jobs**

21. Who repoints cron jobs 3 and 4 from the preview URL to production, and when?
22. Who owns cron job health going forward?

**External services**

23. Which SMS provider and which sender ID will be used, and who holds the account?
24. Is WhatsApp Business required at launch or later?
25. Are outbound calls to the provider permitted from the hosting network?

**Realtime**

26. Approve adding `baggage_cases`, `deliveries`, `workflow_events`, `quality_incidents` and `passenger_feedback` to the `supabase_realtime` publication (see §8) so cross-user push works as designed.

**Scaling & support**

27. What is the expected peak concurrent user count in year one?
28. Who provides L1/L2 support, and what is the escalation path to the development team?

---

## 18. Executive Summary

**What the system does.** It runs mishandled-baggage operations end to end for an airport station — Lost & Found case management, hand-off to delivery, dispatch and agent assignment, driver execution with one-time-code proof of delivery, passenger self-service tracking, automated bilingual notifications, and full audit, SLA and reporting.

**Current architecture.** A single React 19 / TanStack Start application (SSR + edge server functions) over a managed Supabase project. PostgreSQL is the authoritative system: 32 tables with RLS on every one, writes permitted only through a `SECURITY DEFINER` Workflow Engine that validates, locks with bounded timeouts, enforces row versions, journals to three append-only histories and queues notifications inside one transaction. Cross-screen synchronisation uses one shared, ref-counted Realtime channel. Three `pg_cron` jobs drive the notification outbox, health sweeps and SLA breach detection. No object storage is used.

**Production readiness.** The application and data layers are production-grade: concurrency, locking and pool-saturation blockers were resolved and re-verified (50 users < 5 s full refresh; 100 concurrent clients stable; every contested write produced exactly one winner and zero corruption). What is not ready is *operational* rather than architectural.

**What IT must provide.** Production domain, DNS and certificates; confirmed Supabase plan and backup/PITR posture with a rehearsed restore; monitoring, alerting and log retention; secret custody and rotation; an SMS (and optionally WhatsApp) account; a decision on environment separation; and ownership of the scheduled jobs.

**Remaining technical risks.**

| Risk | Severity | Note |
| --- | --- | --- |
| Cron workers point at the preview URL | **High** | Notifications stop silently if preview changes. Repoint at publish. |
| No messaging transport configured | **High** | 164 messages are queued and unsent; passengers get nothing today. |
| Operational tables missing from the Realtime publication | **Medium** | Cross-user push for cases/deliveries is not actually broadcasting; screens still converge on action/focus. |
| Backup/DR unverified, no restore drill | **Medium** | Must be confirmed, not assumed. |
| One database for dev/preview/production | **Medium** | A development mistake touches live data. |
| No external monitoring/alerting | **Medium** | Worker failure is silent. |
| QA secrets still present | **Low** | Remove before go-live. |
| Whole-table snapshot read model beyond ~100 users | **Low (roadmap)** | Pagination + row-level realtime when scale demands. |
| One historical duplicate bag tag predating the uniqueness guard | **Low** | Operational correction. |

**Verdict: CONDITIONAL GO.**

The software is ready. Go-live is conditional on five items, none of which require code changes:

1. Publish to production and repoint pg_cron jobs 3 and 4 to the production URL.
2. Connect an SMS (and/or WhatsApp) transport in the Integration Center.
3. Confirm the Supabase backup/PITR posture and complete one restore drill.
4. Stand up monitoring and alerting for the two worker endpoints and the notification queue.
5. Remove QA secrets and test accounts, and confirm Supabase Auth password/MFA/session settings.

Add the five operational tables to the Realtime publication in the same maintenance window to restore full cross-user live sync. There are no code-level deployment blockers.

---

*Prepared read-only from the codebase and the live Supabase project on 9 August 2026. Items marked UNVERIFIED require confirmation by IT in the Supabase dashboard or hosting console.*