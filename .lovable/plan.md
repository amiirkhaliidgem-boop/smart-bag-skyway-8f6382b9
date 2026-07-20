## Root cause

`src/routes/passenger.$token.tsx` (`TokenPortal`) renders `<TokenNotFound />` synchronously whenever `workflow`, `delivery`, or `case` is missing. On first load the server loader returns `{found:false}` in local dev (no service role) and the client store hasn't hydrated from Supabase yet, so the not-found screen flashes for a moment before the store hydrates and the real portal appears.

## Fix (scope: only `src/routes/passenger.$token.tsx`)

Gate the not-found render on a definitive "lookup finished" signal. Never render `<TokenNotFound />` until both sources have completed.

1. Track hydration state from persistence. Expose (or reuse) a "hydrated" flag on the Zustand store — set to `true` after `initPersistence` finishes its first `bootstrap()` apply (or immediately if the user is unauthenticated and there is nothing to hydrate). If a suitable flag already exists in `src/lib/persistence.ts` / `src/lib/store.ts`, reuse it; otherwise add a minimal `hydrated: boolean` flag flipped once bootstrap resolves.

2. In `TokenPortal`:
   - Read `hydrated` from the store.
   - Compute `resolved = workflow && delivery && kase`.
   - Compute `lookupFinished = view is present (loader ran) AND hydrated is true`.
   - While `!resolved && !lookupFinished` → render a branded loading screen (logo + subtle skeleton, no error copy, no layout shift vs. the real portal shell).
   - When `resolved` → render `<PassengerPortal />`.
   - Only when `lookupFinished && !resolved` → render `<TokenNotFound />`.

3. Loading screen: minimal, uses the same white background, logo, and card frame as the portal so there is no layout shift when the real content mounts. No text like "not found" or "expired". A single subtle "Loading your delivery…" line under the logo is acceptable.

4. No changes to Passenger Portal UI, no changes to server functions, no schema/SQL, no changes to other routes.

## Verification

- Fresh load of a valid `/passenger/<token>` URL (signed-in staff): shows loading → portal, never flashes not-found.
- Hard refresh: same — loading → portal.
- Invalid token: loading → not-found (after hydration completes).
- Signed-out visitor with a valid token in prod (server view resolves): loading → portal without waiting for client store.
