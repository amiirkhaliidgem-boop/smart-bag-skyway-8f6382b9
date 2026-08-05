# Administration — Auth Sync Root Cause + Full Module Validation

## Root cause (confirmed, not a guess)

Editing a user changes the app profile only. The sign-in identity in Supabase Auth is left at the value it had when the account was created.

Verified against live data:

| Employee ID | Current username | Sign-in identity stored in Auth | Expected |
|---|---|---|---|
| 1516 | 1516 | khaled@staff.local | 1516@staff.local |
| 1311 | 1311 | alaa@staff.local | 1311@staff.local |

Where the flow breaks:

```text
Login page: user types "1516" + password
  -> username is resolved through the login-identity lookup
  -> lookup derives the address from the CURRENT username -> 1516@staff.local
  -> Supabase Auth has no account with that address (it still holds khaled@staff.local)
  -> "Invalid login credentials"
```

Answers to the specific questions:
- Authentication failed because the login lookup and the stored Auth identity disagree.
- The username was NOT updated in the authentication provider; only the application profile row was updated.
- The username-to-identity mapping is therefore broken for any user whose username or email was edited.
- The password was NOT invalidated — it still works against the old identity.
- No session/token problem; the failure is at credential lookup.
- Yes: there is a one-way sync gap between the Users table and Supabase Auth on the edit path (the create path and the agent-PIN path do sync).

Secondary defects found while tracing the same path:
- Staff created without an email get no way to add one later that reaches Auth (same gap).
- An account can exist in the Users table with no Auth identity at all, which shows as an unexplained login failure.
- Nothing prevents two users from resolving to the same derived identity (e.g. a username collision after an edit).

## Fix

1. On save-edit, after updating the profile, push the identity to Supabase Auth: recompute the address (explicit email if given, otherwise username-derived) and, when it differs from the stored one, update the Auth user's email with confirmation already set. Password is never touched here, so existing credentials keep working.
2. Reuse the same derivation the login lookup uses, so profile and Auth cannot diverge again.
3. If the profile row has no Auth identity, create one during the edit (password for staff, PIN for agents) instead of silently saving a login-less account, and write the new id back to the profile — no orphans.
4. Guard against duplicates: before writing, check the target identity is not already used by a different Auth user, and fail with a clear message instead of creating a second account.
5. Repair the two already-drifted accounts (1516, 1311) so their Auth identity matches their current username.
6. All changes stay in the admin server functions; no UI redesign, no new features.

## Validation pass

Each Administration action is exercised end to end against the live database, and each result is recorded with: function, test performed, expected, actual, issue, root cause, fix, retest.

Covered: Create Staff User, Create Delivery Agent, Edit User (username, employee ID, full name, department, email, mobile), Change Role, Change Status (Activate / Deactivate including the Auth ban toggle), Reset Password, Reset Agent PIN, Delete User (profile + Auth + legacy role cleanup, self-delete block), Assign Permissions, Create Role, Clone Role, Edit Role, Delete Role (system-role and in-use guards), Search, Filters, Audit History, Save, Cancel, View Details, plus a sign-in retest after every mutation that touches identity.

Post-fix sign-in is retested through the real login page for an edited staff account and an edited agent account.

## Deliverable

`docs/administration-verification-report.md` with the full per-function table, bugs found, root cause, fix, retest result, PASS/FAIL per function, and a final GO / NO-GO recommendation.

## Technical notes

- Files touched: `src/lib/admin.functions.ts` (edit branch of `saveAppUser`), `src/lib/admin/identity.server.ts` (shared derivation + email sync + duplicate guard), and a one-off data repair for the two drifted accounts.
- The login lookup function stays as-is; it is correct — the write path was incomplete.