## Goal

Replace the demo Administration module with a real, Supabase-backed identity and authorization system that the whole ecosystem reads from — one database, one identity, no hardcoded users, drivers or menus.

## Current state (verified)

- `src/lib/admin/data.ts` is an in-memory `useSyncExternalStore` mock: demo users, departments, stations, teams, activity, and a permission matrix derived from the static `ROLE_PERMISSIONS` table in `src/lib/roles/roles.ts`.
- `src/routes/admin.tsx` renders 7 sections driven by a `?section=` search param, with a hardcoded "signed in as Mostafa Reda".
- The sidebar (`src/components/app-shell.tsx`) lists Users / Roles / Permissions / Departments / Stations / Teams as six separate Administration entries.
- Authorization today is a hardcoded path matrix in `src/lib/rbac.ts` mapped to four enum roles (`admin, agent, coordinator, driver`) in `public.user_roles`.
- Delivery Agents are a hardcoded string array `driverPool` in `src/lib/store.ts` (line 339); the Driver Portal login is a dropdown with no authentication.
- The database has no staff profile, role-definition, permission or admin-audit tables — only `user_roles`.

## Database (new migration)

- `app_users` — one row per employee, linked to `auth.users(id)`: employee_id, full_name, username, email, mobile, department, station, team, position, status (Active/Disabled/Invited), last_login_at, user_type (`staff` | `driver`), driver_pin_hash, created/updated timestamps.
- `app_roles` — editable roles: key, name, description, is_system (protects built-ins), timestamps.
- `role_permissions` — (role_id, module, action, allowed) — the permission matrix; modules and actions exactly as listed in the request.
- `user_role_assignments` — enforces exactly one primary role per user (unique on user_id).
- `admin_audit_log` — actor, action, target, details, timestamp; surfaced in the Activity Timeline.
- Security-definer helpers: `has_permission(_user_id, _module, _action)` and `current_user_permissions()`; RLS so only users with `Administration → Manage` can write, all authenticated users can read their own permissions. GRANTs for `authenticated` / `service_role` on every new table.
- Seed: the built-in roles (Administrator, Lost & Found Officer, Delivery Coordinator, Delivery Agent) with their current effective permissions, backfill `app_users` rows for existing `auth.users`, and seed **Ahmed Mostafa** as a driver account for testing. Passenger is removed from the role vocabulary.

## Server functions (`src/lib/admin.functions.ts`)

Privileged operations run server-side after verifying the caller has Administration→Manage:
create user (Supabase Auth admin + `app_users` row), update, disable/activate, delete, reset password, reset driver PIN, assign role/department/station/team, create/edit/clone/delete role, save permission matrix cell changes. Every one writes an `admin_audit_log` row in the same call.

## Administration workspace UI

- `src/routes/admin.tsx` becomes a single workspace with four in-page tabs — **Users**, **Roles**, **Permissions**, **Activity Log** — using the existing shadcn Tabs and current design language; tab state stays in the URL search param but never leaves the module.
- **Users tab**: live directory table (Name, Employee ID, Username, Email, Mobile, Status, Last Login, Role) with search, status/role/type filters, row actions (Edit, Disable/Activate, Reset Password, Reset PIN, Delete) and a Create User dialog that also creates Delivery Agent accounts (Employee ID, Name, Mobile, Username, PIN, Station).
- **Roles tab**: create / edit / clone / delete, with assigned-user counts; system roles protected from deletion.
- **Permissions tab**: matrix — modules as rows (Executive Dashboard, Lost & Found, Baggage Tracking, Customer Feedback, Delivery Management, Driver Portal, Warehouse, QR, Workflow Monitor, Notification Center, Timeline, Reports, Import/Export, Administration), actions as columns (View, Create, Edit, Delete, Assign, Approve, Export, Print, Manage), checkbox cells with row/column bulk toggles and a role selector. Functional reference only — styling stays Smart Baggage.
- **Activity Log tab**: live `admin_audit_log` feed with actor/action/target filters.
- `src/lib/admin/data.ts` demo store is deleted; the page reads via TanStack Query against the new server functions.

## Wiring into the rest of the system

- `src/lib/rbac.ts` stops using the hardcoded path table: a permission provider loads the signed-in user's matrix once, exposes `can(module, action)`, and maps each route to a module. Sidebar items and route guards both read it, so a role change takes effect on the next query invalidation without a manual refresh.
- Sidebar: the six Administration links collapse to a single **Administration** entry.
- Driver Portal: the driver dropdown is replaced by Employee ID/Username + PIN sign-in validated by a server function against `app_users`; the delivery-agent picker in Delivery Management reads live driver accounts instead of `driverPool`, which is removed from `src/lib/store.ts`.
- Activity Timeline gains an `Administration` module source fed by `admin_audit_log`.

## Technical notes

- Workflow, Notification, Delivery and Audit engines are not modified — Administration only publishes audit events into the existing timeline pipeline.
- Auth stays Supabase email/password for staff; passengers remain token/OTP-only and are never system users.
- `public.user_roles` is kept in sync with `user_role_assignments` so existing `has_role()` checks and RLS policies keep working during the transition.

## Sequencing

1. Migration + seed/backfill.
2. Server functions and permission helpers.
3. Administration workspace rewrite.
4. RBAC provider, sidebar and route guards.
5. Driver Portal PIN auth + removal of `driverPool`.
6. Timeline audit integration.
