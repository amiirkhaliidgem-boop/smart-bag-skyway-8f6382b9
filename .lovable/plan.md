## Root cause (confirmed)

`src/lib/store.ts` → `ensureWorkflow()` (lines 758–778) mutates `state.workflow` when it bootstraps a new record but never calls `emit()`. Every other state mutation in this file goes through `emit()`, which triggers `scheduleRemotePush()` to persist the snapshot to Supabase `app_state`. Because the bootstrap path skips `emit()`, the new workflow (and its passenger tracking token) lives only in the current tab's memory. Another tab / device / refresh hits `TokenPortal`, looks up the token in the freshly hydrated store, finds nothing, and renders "Tracking link not found".

## Fix (single, minimal change)

In `src/lib/store.ts`, inside `ensureWorkflow()`, after appending the new record to `state.workflow` and BEFORE `return rec`, call `emit()` so the new workflow + token is persisted through the exact same path used by every other workflow update.

```ts
state = { ...state, workflow: [...state.workflow, rec] };
emit(); // persist newly bootstrapped workflow (incl. passenger token) to Supabase
return rec;
```

Nothing else changes:
- `ensurePassengerToken()` untouched.
- Token generation untouched (tokens are only generated when the record does not yet exist, so they never change afterwards).
- No UI, no Passenger Experience, no schema, no SQL, no re-scan.
- Existing SMS/WhatsApp links continue to work because the token value is unchanged — it's just now written to Supabase.

## Verification

Using the running preview, sign in as staff and:

1. Open L&F case backing `DEL-50001` → click "View Passenger Portal" → confirm portal renders that passenger's data (Workflow created ✔, Token persisted ✔, View Passenger Portal ✔).
2. Hard refresh the portal tab → still renders same passenger (Browser refresh ✔).
3. Copy the URL, open in a fresh incognito/second browser context → renders same passenger (Direct URL ✔).
4. Repeat 1–3 for `DEL-50023` and confirm it shows a different passenger than `DEL-50001` (Different passenger opens different data ✔).
5. Cross-check Supabase `app_state.payload.workflow` contains both records with their tokens after step 1.

If any step fails, stop and report the exact failing function rather than layering more fixes.
