## Root Cause Analysis — New L&F case disappears on refresh

**Diagnosis is confirmed by code inspection. No fix proposed.**

### Trace (step-by-step)

| # | Step | Result |
|---|------|--------|
| 1 | `PIRWizard.submit()` — `src/components/lost-found/pir-wizard.tsx:262` builds `commonPatch` and calls `addCase(...)` on the "create" branch (l. 311) | ✅ PASS |
| 2 | Validation in `canSubmit` gate before submit | ✅ PASS |
| 3 | `addCase()` — `src/lib/store.ts:940` mints `BAG-<n+1>`, prepends to `state.cases`, calls `pushAudit`, then `emit()` (l. 973) | ✅ PASS — in-memory state now contains the new case (this is why the list shows it) |
| 4 | Workflow record — none is created for L&F cases at this point (workflow only bootstraps on delivery hand-off); irrelevant to persistence | ✅ N/A |
| 5 | `emit()` — `src/lib/store.ts:746` notifies listeners and calls `scheduleRemotePush(() => state)` | ✅ PASS |
| 6 | `scheduleRemotePush()` — `src/lib/persistence.ts:113` | ❌ **FIRST FAILING STEP** — `suppressNext === true`, so the function resets the flag and **returns without arming the 250 ms push timer**. The new case is never sent to Supabase. |
| 7 | Supabase `UPDATE app_state` | ❌ never issued for this mutation |
| 8 | Refresh → `bootstrap()` in `persistence.ts:65` fetches `app_state.payload` → `applyRemote()` replaces `state.cases` with the server snapshot (which never received the new case) | ✅ works as designed — but the new case is not in the payload, so it vanishes |
| 9 | List render reads `state.cases` from the (server-truth) store | New case absent |

### Why `suppressNext` is `true` at step 6

`suppressNext` is a module-level guard in `src/lib/persistence.ts` intended to prevent the emit that immediately follows a remote apply from echoing the just-received payload back to the server. It is set by `markRemoteApply()` and consumed by the very next call to `scheduleRemotePush()`.

During normal startup it is set **twice** without ever being consumed:

1. `ensureBootstrap()` — `src/lib/store.ts:736` calls `markRemoteApply()` "so the freshly-seeded defaults aren't pushed", then calls `initPersistence(applyRemote)`.
2. `initPersistence()` → `bootstrap()` — `src/lib/persistence.ts:80` calls `markRemoteApply()` again before invoking `applyRemote(data.payload, ...)`.

Neither `applyRemote` nor `ensureBootstrap` itself calls `emit()` (they update `state` directly and fan out to `listeners` without going through the emit path). React re-renders triggered by `useSyncExternalStore` also do not call `emit()`. As a result **`suppressNext` remains `true` from bootstrap until the user performs their first mutation.**

The very first mutation after page load — in the reported bug, `addCase()` — reaches `scheduleRemotePush()`, which sees `suppressNext === true`, clears it, and returns immediately without scheduling `pushNow()`. The mutation is applied to in-memory state (so the UI shows it) but never written to `app_state`.

The `onAuthStateChange` listener in `persistence.ts:55` fires bootstrap again on `INITIAL_SESSION` / `TOKEN_REFRESHED`, each of which re-arms `markRemoteApply()` and re-arms `suppressNext`. That means the flag can also swallow later single mutations if a token refresh happens between two user actions — but the deterministic reproduction is the fresh-page-then-create-then-refresh flow described in the bug report.

### Elimination of alternative hypotheses

- **"Never written vs overwritten"** — Never written. Step 6 aborts before any DB call.
- **"`app_state` replaces it during bootstrap"** — Yes, but only because step 6 never persisted it in the first place. Bootstrap is not the bug; it correctly loads the last snapshot the server has.
- **"Persistence succeeds but loading fails"** — No. `pushNow()` is never invoked for the new case.
- **"Workflow Engine creates it only in memory"** — Not applicable; L&F case creation doesn't touch the workflow table. `addCase` correctly mutates `state.cases`.
- **"Recent L&F data-model change (Priority narrowing, dropped passenger fields, removed VIP/Rush/Fragile toggles) introduced the regression"** — No. That change trims the payload shape written by `commonPatch`, but the payload still reaches `addCase` and still lands in `state.cases`. The persistence guard predates that change and would swallow the row regardless of shape.
- **"RLS / auth denies the write"** — Not reached; the request is never sent. (Network log for this signed-in admin session shows successful reads from `app_state` but no `UPDATE`, consistent with the guard aborting.)

### Blast radius (evidence, not proposed fix)

Because `suppressNext` is consumed by exactly one call, the exact symptom is:
- The **first** post-bootstrap mutation on any given page load is dropped from persistence.
- The **second and later** mutations on the same page load push normally (assuming no `TOKEN_REFRESHED` in between), because `suppressNext` has already been cleared.

This is consistent with reports that "sometimes edits stick, sometimes they don't" and specifically that a freshly created case disappears on refresh — the create is almost always the first mutation of the session.

### First failing step — one line

`scheduleRemotePush()` in `src/lib/persistence.ts:113` — the lingering `suppressNext` flag set during `ensureBootstrap()`/`bootstrap()` swallows the push scheduled by `addCase()`'s `emit()`, so the new L&F case is never written to `public.app_state` and is gone on the next `bootstrap()` after refresh.
