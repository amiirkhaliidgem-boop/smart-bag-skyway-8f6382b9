## Findings (verified, no code changed)

**1. Is the project connected to the right Supabase project?**
Yes. `supabase/config.toml` and `.env` both point at project ref `sxjuhoghypsbuqquhxib` (the external Supabase project this app is connected to). Connectivity is fine — auth calls and app data reads work.

**2. Which environment variables are actually missing?**
Checked the running server environment:

```text
SUPABASE_URL                 present
SUPABASE_PUBLISHABLE_KEY     present
VITE_SUPABASE_*              present
LOVABLE_API_KEY              present
SUPABASE_SERVICE_ROLE_KEY    MISSING   <-- cause of the error
SUPABASE_DB_URL              MISSING   (not used by app code)
```

The auto-populated `.env` only carries the URL, project id and publishable/anon key. Service-role keys are never written there — they must come from project secrets injected into the server runtime. The secret listed on the Supabase side is not the same thing as a runtime secret available to this app's server functions, which is why it looks configured but resolves to undefined.

**3. Does the Administration backend require it?**
Yes, unavoidably. `src/lib/admin.functions.ts` performs privileged work that RLS deliberately blocks for normal users:
- reading `app_users` (including PIN hashes), `app_roles`, `role_permissions`, `admin_audit_log`
- `supabaseAdmin.auth.admin.createUser / updateUserById / deleteUser` — the Auth Admin API only accepts the service role key
- writing role assignments and audit rows

`src/integrations/supabase/client.server.ts` reads `process.env.SUPABASE_SERVICE_ROLE_KEY` and throws the exact message you saw when it's absent.

**4. Why does everything work until you open Administration?**
The admin client is lazily created behind a Proxy — nothing touches it at boot. Sign-in, the sidebar, and all other modules use the browser/anon client, so they never need the key. The moment the Administration page runs its `getAdminWorkspace` server function, the first property access on `supabaseAdmin` constructs the client, the env check fails, and the thrown error surfaces as the banner in your screenshot. So the failure is scoped to exactly the one module that needs elevated privileges.

## Fix (configuration only — no code changes)

1. Get the key: Supabase Dashboard → project `sxjuhoghypsbuqquhxib` → **Project Settings → API Keys** → copy the **`service_role`** key (the secret one, not `anon`/publishable).
2. In Lovable, save it as a project secret named exactly `SUPABASE_SERVICE_ROLE_KEY`. I'll open the secure secret form for you on approval — you paste the value there; it is never stored in code or in `.env`.
3. The server runtime picks up the new secret (dev server restart), after which Administration loads.
4. Verify: open Administration → Users tab lists real rows; Roles/Permissions/Activity Log populate.

## Technical notes

- No application code is modified by this plan. `client.server.ts`, `guard.server.ts` and `admin.functions.ts` stay exactly as they are.
- The key stays server-only: it is read inside handlers via `await import("@/integrations/supabase/client.server")`, so it never enters the client bundle.
- Do not add it as a `VITE_` variable — that would expose an RLS-bypassing key to the browser.
- If Administration still errors after the secret is saved, the next check is whether the pasted key belongs to project ref `sxjuhoghypsbuqquhxib` (a key from another project fails with an auth error, not this env error).
