# Restore Passenger Portal

## Root cause (verified)

- `/passenger/$token` runs a loader that calls the `getPassengerViewByToken` server function.
- That handler does `await import("@/integrations/supabase/client.server")`, which requires `SUPABASE_SERVICE_ROLE_KEY` at first use.
- The dev sandbox `.env` (verified) contains only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and their `VITE_*` twins. `SUPABASE_SERVICE_ROLE_KEY` is a Lovable project secret so it exists in the deployed runtime, but it is not injected into the sandbox dev preview.
- With the key missing, the server function throws `Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY` (confirmed in the browser console for `/passenger/not-a-valid-token`). Because the loader throws, TanStack Router renders the default error boundary — the "This page didn't load" screen the user is seeing.
- The publishable/anon key cannot substitute for the service role here: `public.app_state` RLS requires `auth.uid() IS NOT NULL`, so anon reads return zero rows. Changing RLS is disallowed by the user, and so is DB work.
- Secondary: `TokenPortal` reads `Route.useLoaderData()` unconditionally and immediately `throw notFound()` on any non-happy shape, so a caught server error still surfaces as a broken page.

## Repair scope

No UI, no schema, no data changes. Only make the passenger route tolerant of a missing server-side read and keep the previously working staff-preview path alive.

### 1. `src/lib/passenger.functions.ts`
- Wrap the `getPassengerViewByToken` handler body in a `try/catch`. On any thrown error (missing env, network, RLS), log server-side and return `{ found: false, workflow: null, delivery: null, case: null, feedback: [] }` instead of throwing. The loader then resolves cleanly and the route can decide what to render.
- Leave `mutatePassengerView` unchanged; passenger mutations still legitimately fail without the service key, and the toast surface already handles that.

### 2. `src/routes/passenger.$token.tsx`
- Keep the server loader as the primary path.
- In `TokenPortal`, if `view.found` is false OR `view.delivery`/`view.case` are null, fall back to a client-side lookup: `useStore(s => s.workflow.find(w => w.token === token))` plus the matching delivery/case from the store. This restores the previously working staff-preview behaviour (authenticated staff already hydrate `app_state` client-side).
- Only render `TokenNotFound` when both the server view and the client store lookup fail.
- Pass through the resolved delivery/case exactly as before — no prop shape changes.

### 3. Sanity checks (no code changes expected)
- Confirm `src/routes/passenger.tsx` still exists as the pathless layout with `<Outlet />` and that `src/routes/passenger.index.tsx` owns `/passenger/`. This split is already in place; just re-verify after the edits.
- Confirm `getPassengerViewByToken` and `mutatePassengerView` are the only imports from `@/lib/passenger.functions`. No other route needs updating.
- Confirm `View Passenger Portal` in `src/routes/delivery.$deliveryId.tsx` still opens `/passenger/{token}` via `ensurePassengerToken` — no change required, this path is what the fix targets.

## Verification

- `bunx tsgo --noEmit` — must pass.
- `bunx vitest run src/lib/__tests__/otp-flow.test.ts` — must pass (unrelated regression guard).
- Playwright against `http://localhost:8080/passenger/<real-token>` — expect the portal to render using the client-store fallback (server fn returns `found:false` in the sandbox), no error boundary.
- Playwright against `http://localhost:8080/passenger/not-a-valid-token` — expect the `TokenNotFound` component ("Tracking link not found"), not the generic "This page didn't load".
- In the deployed preview where `SUPABASE_SERVICE_ROLE_KEY` is present, the server path resolves the pair directly with no fallback needed; behaviour is unchanged from the prior audit.
