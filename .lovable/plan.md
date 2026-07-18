
## Goal

Enforce role-based access so each seeded account (admin, agent, coordinator, driver) only sees and reaches its permitted modules. All four accounts must sign in successfully; unauthorized routes redirect; the sidebar reflects the role.

## Role → Module Matrix

| Module (route) | admin | agent (L&F) | coordinator | driver |
|---|---|---|---|---|
| Executive Dashboard `/` | ✓ | ✓ | ✓ | – |
| Lost & Found `/lost-found/*` | ✓ | ✓ | – | – |
| Storage `/storage`, QR `/qr-scan` (Warehouse Ops) | ✓ | ✓ | – | – |
| Reports `/reports` | ✓ | ✓ | – | – |
| Import/Export `/data-io` | ✓ | ✓ | – | – |
| Delivery Management `/delivery/*` | ✓ | – | ✓ | – |
| Driver Portal `/driver-portal` | ✓ | – | – | ✓ |
| Passenger Experience (`/tracking`, `/contact-center`, `/feedback`) | ✓ | – | – | – |
| Operations Center (`/workflow-monitor`, `/notifications`, `/timeline`) | ✓ | – | – | – |
| Administration `/admin` | ✓ | – | – | – |
| System (`/integrations`, `/api-status`, `/settings`) | ✓ | – | – | – |
| Public `/passenger/$token`, `/auth` | everyone (unauthenticated OK) |

Driver's landing route after sign-in: `/driver-portal` (since `/` is not permitted for driver).

## Implementation

### 1. `src/lib/rbac.ts` (new)
- Export `AppRole = 'admin'|'agent'|'coordinator'|'driver'`.
- Export `ROUTE_ACCESS`: array of `{ match: (pathname) => boolean, roles: AppRole[] }` covering every top-level route above. Admin implicitly allowed on all.
- Export `canAccessPath(pathname, role): boolean`.
- Export `defaultPathForRole(role)`: admin/agent/coordinator → `/`, driver → `/driver-portal`.
- Export `useCurrentRole()` hook: fetches `user_roles` for current `auth.uid()`, subscribes to auth changes, caches in module state, returns `{ role, loading }`. First role wins (admin > others) if multiple.

### 2. `src/routes/__root.tsx` — AuthGate extension
- After session ready, load role via `useCurrentRole()`.
- While role loading: show "Loading…".
- If signed in and current pathname is not public and not allowed for role → `navigate({ to: defaultPathForRole(role), replace: true })`.
- If no role row exists for the user → treat as unauthorized: sign out and redirect to `/auth` with a toast "No role assigned. Contact administrator."
- Provide role via React context so children (sidebar, pages) can read without re-querying.

### 3. `src/components/app-shell.tsx` — Sidebar filtering
- Consume role from context.
- Filter `navSections` items using `canAccessPath(item.to, role)`. Drop sections that become empty.
- `UserMenu`: also show role label next to email.

### 4. Route-level guards (defense in depth)
Add a small `<RequireRole roles={[...]}>` wrapper (reads role context; if denied renders a 403 panel with a Home link). Wrap the page components in these route files:
- `/lost-found`, `/lost-found/$bagId` → `['admin','agent']`
- `/storage`, `/qr-scan` → `['admin','agent']`
- `/reports`, `/data-io` → `['admin','agent']`
- `/delivery` (layout), `/delivery/$deliveryId` (via layout) → `['admin','coordinator']`
- `/driver-portal` → `['admin','driver']`
- `/tracking`, `/contact-center`, `/feedback`, `/workflow-monitor`, `/notifications`, `/timeline`, `/admin`, `/integrations`, `/api-status`, `/settings` → `['admin']`
- `/` (Executive Dashboard) → `['admin','agent','coordinator']` (driver bounced by AuthGate to `/driver-portal`)

The gate in `__root.tsx` handles redirects for direct URL entry; `RequireRole` guarantees pages never render when a redirect races or fails.

### 5. Action-level protection
Extend `RequireRole` with `<RoleGate roles>{children}</RoleGate>` helper and `useHasRole()` hook. Wrap sensitive action buttons where cross-role pages exist. In practice all currently-cross-role screens are already segmented by route, so this step is limited to hiding admin-only affordances (e.g., "Sign out" stays visible; delete/reset controls in `/admin`, `/settings`, `/integrations` are already inside admin-only routes and covered by route guards).

### 6. Sign-in redirect
- `src/routes/auth.tsx`: after successful sign-in, look up role and `navigate({ to: defaultPathForRole(role), replace: true })` instead of hard-coded `/`.

## Verification (manual, per account)

For each of `admin@iab.aero`, `lf.officer@iab.aero`, `dispatch@iab.aero`, `driver@iab.aero`:
1. Sign in — succeeds, lands on the correct default path.
2. Sidebar shows only allowed sections per matrix.
3. Manually enter a forbidden URL (e.g., driver → `/delivery`) — redirected to their default path.
4. Sign out returns to `/auth`.

Report the outcome for all four accounts.

## Files touched
- new: `src/lib/rbac.ts`
- edit: `src/routes/__root.tsx`, `src/components/app-shell.tsx`, `src/routes/auth.tsx`
- edit (wrap component in `RequireRole`): the route files listed under Route-level guards.
