## Goal

One login screen for everyone. After sign-in the system decides the destination from the assigned role — the user never picks a portal.

- Administrator / Lost & Found Officer / Delivery Coordinator → internal app (their role's default landing page)
- Delivery Agent → Delivery Agent Portal only

## Current state (verified)

- Staff sign in on `/auth` with Username-or-Email + password (real Supabase session, RBAC enforced by `AuthGate` + live permissions).
- Delivery Agents do **not** have accounts. `/driver-portal` renders its own separate PIN screen backed by `driverPinLogin`, and there is exactly one agent record today (`ahmed.mostafa`, EMP-DA001) with a PIN and no linked account.
- Because `/driver-portal` is behind the session gate, that second login screen is effectively unreachable — this is the root of the split-login problem.

## Approach

Delivery Agents become real accounts (as chosen), so the single permission system stays the only source of truth.

### 1. Agent accounts

- Administration continues to create agents with Username / Employee ID + PIN, but the PIN now also becomes their sign-in password. PIN is enforced as **6–8 digits** in the create/edit/reset forms and in the server validators.
- Creating or resetting an agent PIN provisions/updates a matching account using an internal identity derived from the username (`username@agent.local`), assigns the `driver` role, and links `app_users.user_id`.
- The existing agent has a 4–8 digit PIN with no account; an admin must reset their PIN once (6–8 digits) to activate sign-in. I'll surface a clear "PIN reset required" hint on that record.

### 2. Single login page

- `/auth` stays the only login screen. The identifier field accepts **Username, Employee ID, or Email**; the second field is Password/PIN.
- Identity resolution is extended to also match Employee ID and agent accounts, so an agent typing their Employee ID + PIN signs in on the same form.
- The separate PIN card inside the Delivery Agent Portal is removed; the portal renders for the signed-in agent directly.

### 3. Automatic redirect

- After sign-in the role decides the landing route: `driver` → `/driver-portal`; all other roles → their existing default landing page. No portal chooser anywhere.
- The Delivery Agent Portal binds to the signed-in agent's own record instead of a locally-typed name.

### 4. Session protection

- The existing route guard already blocks disallowed paths; it is tightened so an agent hitting any internal URL (`/admin`, `/lost-found`, `/delivery`, `/reports`, `/workflow-monitor`, …) is redirected straight back to `/driver-portal` rather than to a generic landing page.
- Agent-only navigation: the app sidebar/chrome is not shown for the agent portal.
- Access control keeps flowing from role/permission records — no hardcoded page lists added.

## Technical notes

- Migration: extend `login_identity_for_username` to resolve staff **and** driver accounts and to match on `employee_id` as well as `username`; keep it security-definer, returning only the internal identity string.
- `src/lib/admin.functions.ts`: PIN schema `\d{6,8}`; on create/PIN-reset call the Auth Admin API to create/update the agent's user and upsert the `driver` row in `user_roles`; keep the PIN hash for backwards compatibility.
- `src/lib/rbac.ts`: `defaultPathForRole('driver')` already returns `/driver-portal`; add the same driver-first rule to the permission-driven landing (`firstAllowedPath`) so managed accounts redirect identically.
- `src/routes/auth.tsx`: single form, resolve identity → `signInWithPassword` → role lookup → redirect.
- `src/routes/driver-portal.tsx`: delete `DriverLogin`, derive the agent from the session (`app_users` row for `auth.uid()`), keep the EN/AR toggle and the rest of the portal untouched.
- `driverPinLogin` is retired from the UI once the portal no longer has its own login.

## Out of scope

No visual redesign of the login page or the Agent Portal; no changes to delivery workflow, notifications, or the Passenger Portal.
