# Fix: First mutation after bootstrap never persists

## Root cause (recap)

`bootstrap()` in `src/lib/persistence.ts` calls `markRemoteApply()` before applying the remote snapshot to the store, which sets `suppressNext = true` to swallow the echo emit. But `applyRemote` in the store path does not always trigger an emit (e.g. when hydrating an empty local state to matching remote state, or when the initial apply short-circuits). The `suppressNext` flag therefore lingers, and the **first real user mutation** hits `scheduleRemotePush()`, which unconditionally consumes the flag and returns without scheduling a push. The mutation lives only in memory and vanishes on refresh.

## Fix (single file: `src/lib/persistence.ts`)

Move the echo-suppression decision from "next scheduled push" to "does the snapshot actually match the last known remote payload". The compare already exists in `pushNow()` via `lastPayload`.

Change `scheduleRemotePush()`:
- Remove the early `if (suppressNext) { suppressNext = false; return; }` block. Always schedule the debounced push when signed in.

Change `pushNow()`:
- When `serialized === lastPayload` (true echo), clear `suppressNext` and return — nothing to persist.
- When the snapshot differs, clear `suppressNext` (in case it was set) and proceed with the update.

Net effect:
- Genuine echoes from `applyRemote` are still no-ops because the snapshot matches `lastPayload`.
- Genuine user mutations always diverge from `lastPayload` and are always persisted, regardless of the flag state.
- No workaround, no schema/workflow/architecture change.

## Verification

After the edit, in the running preview:
1. Hard refresh, sign in, then create a new L&F case → refresh → case still present.
2. Edit an existing case field → refresh → edit still present.
3. Delete a case (where supported) → refresh → still gone.
4. Repeat step 1 as the very first action after a fresh page load to confirm the "first mutation" path.
5. Confirm `public.app_state.version` increments after each mutation via a quick read query.

## Files touched

- `src/lib/persistence.ts` — `scheduleRemotePush()` and `pushNow()` only.

No other files, no SQL, no workflow/store changes.
