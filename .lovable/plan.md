## Confirmed audit findings

- All four email addresses exist in Supabase Auth and each has an encrypted password value.
- All four are confirmed and not banned or deleted.
- `public.user_roles` contains the expected canonical role for every account: admin, agent, coordinator, and driver.
- The three failing non-admin Auth records are malformed: GoTrue-required token fields such as `confirmation_token`, `recovery_token`, and email-change fields are `NULL`. The working administrator record has valid non-null values.
- Supabase Auth logs confirm the failure occurs before password validation: `Database error querying schema` caused by `confirmation_token` being `NULL`.
- The three non-admin records also lack the requested role metadata. Their secure authorization role rows do exist, and those rows will remain the source used for authorization.
- The login page currently formats some non-standard Auth failures as an object, producing `{}` rather than a useful message.

## Implementation plan

1. **Repair the four seeded Auth identities through the Supabase Auth Admin API**
   - Keep the working administrator account and normalize its confirmation/password/role metadata.
   - Repair the three malformed accounts through supported Auth Admin operations; if a malformed record cannot be updated because GoTrue cannot deserialize it, delete and recreate that identity through the Auth Admin API, then restore its `user_roles` row for the new user ID.
   - Explicitly set each known password, mark each email confirmed, ensure no ban is active, and set secure app metadata to the matching role.
   - Keep `public.user_roles` as the canonical authorization source; metadata is informational and will not replace server-backed role checks.
   - Re-query Auth and role data afterward to confirm existence, confirmation, enabled state, metadata, and role-row consistency.

2. **Fix authentication error presentation**
   - Add a robust error-message extractor in `src/routes/auth.tsx` that prefers Supabase `message`, then `error_description`, `code`, or status details, with a clear fallback.
   - Ensure sign-in failures display the actual Supabase message instead of `{}`.
   - Preserve role-based post-login routing.

3. **Verify every account through the real UI**
   - Use a fresh browser context for each seeded account and submit the actual `/auth` form.
   - Confirm successful login and expected landing page:
     - Administrator → `/`
     - Lost & Found Officer → `/`
     - Delivery Coordinator → `/`
     - Driver → `/driver-portal`
   - Confirm the visible sidebar modules match the required matrix for each role.
   - Attempt representative forbidden direct URLs for each non-admin role and confirm redirect to that role’s permitted default page.
   - Confirm permitted routes open correctly and sign-out returns to `/auth`.

4. **Final integrity report**
   - Report each account’s verified Auth status, role metadata, canonical role row, successful UI login, landing route, visible modules, and denied-route result.
   - Recheck Auth logs/network responses to ensure all four password grants return success and no schema-query failures remain.