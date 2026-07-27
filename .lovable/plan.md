## Answer first: what Position actually does today

I checked every use of `position` in the codebase. It is stored on `app_users`, typed in `AdminUser`, edited in the Create/Edit User dialog, and included in the admin search text. That is all.

It does **not** affect permissions (those come only from `role_permissions` via the assigned Role), workflow transitions, approval hierarchy, or any report. Same for **Station** and **Team** — Station is only carried along on the delivery-agent record and never displayed in the Delivery Agent Portal or Dispatch Center.

Recommendation: **remove all three** (Station, Team, Position). Role stays the sole access controller, Department stays as the organisational grouping. If you later want a "Supervisor vs Officer" distinction that actually does something, the correct way is a separate Role (e.g. "Lost & Found Supervisor") with its own permission matrix — not a free-text label.

## The one real constraint: Supabase Auth requires an email

Staff sign-in goes through Supabase Auth, which will not create an account without an email address. So "no email" has to mean *no email the operator has to type*.

Approach: when a staff account is created without an email, the system generates an internal identity `<username>@staff.local` behind the scenes. The operator never sees or types it. Sign-in changes from "Email + Password" to **"Username or Email + Password"** — the login page resolves the username to the internal identity before authenticating. Anyone with a real corporate email can still be given one and can sign in with either.

## What changes

**1. Create/Edit User dialog** (`src/routes/admin.tsx`)
- Required for Staff: Employee ID, Username, Full Name, Department, Role, Status, Password (on create).
- Optional: Email, Mobile.
- Remove the Station, Team and Position fields entirely.

**2. Server validation** (`src/lib/admin.functions.ts`)
- Drop the "Staff accounts require an email address and a password" rule; require only Username + Password on create.
- Generate the internal `<username>@staff.local` identity when Email is blank, and store `email` as null so the UI keeps showing it as empty.
- Remove `station` / `team` / `position` from the input schema, the insert/update payload and the returned workspace shape.
- Editing a user's username does not change the already-created auth identity (kept stable to avoid breaking sign-in); noted in the dialog.

**3. Sign-in page** (`src/routes/auth.tsx`)
- Field relabelled "Username or Email". If the value has no `@`, it is resolved to the internal identity before `signInWithPassword`.
- A small public server function does the username → identity lookup (returns nothing identifying, just the login identity or a generic failure).

**4. Data model cleanup**
- Remove `station` / `team` / `position` from `AdminUser` and `STATIONS` from `src/lib/admin/modules.ts`, and from the delivery-agent directory type in `src/lib/admin/agents.ts`.
- Database columns are left in place (nullable, unused) so nothing breaks; a follow-up migration can drop them once you confirm.

## Technical notes

- Uniqueness: Username becomes the operational login key, so it must be unique — a unique index on `app_users.username` is added, and the save function returns a clear "Username already in use" message.
- Employee ID uniqueness is enforced the same way.
- Delivery agents are unaffected: they keep signing in to the Delivery Agent Portal with Username/Employee ID + PIN.
- Permission resolution (`current_user_permissions`, `has_permission`) is untouched — Role remains the only source of access.
