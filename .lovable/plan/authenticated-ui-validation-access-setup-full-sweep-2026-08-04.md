# Authenticated UI Validation — Access Setup + Full Sweep

## Where things stand

I checked the sandbox auth status for this project: it reports `external_unmanaged`, and no session is injected.

Technically: this app is connected to an **external Supabase project**, not Lovable-managed Cloud. For managed projects Lovable mints a real Supabase session and injects it into my sandbox, so my headless browser can restore it into `localStorage` and land straight inside protected routes. For an external project Lovable holds no signing key and no admin credentials for its Auth server, so no session can be minted. My browser therefore starts as an anonymous visitor and `AuthGate` in `src/routes/__root.tsx` bounces every protected path to `/auth`.

What I *can* do: drive the real login form at `/auth` with a real staff account, exactly like a human. That works over the external Supabase too, because the browser gets the session from `supabase.auth.signInWithPassword` itself. It only needs credentials I can read at runtime.

I cannot create the QA account myself: staff creation goes through admin RPCs that require an already-authenticated administrator, which is the same wall.

## What I need from you

### 1. Create a temporary QA account
Create it **from the application UI**: sign in as an administrator, go to **Administration → Staff**, and add a staff account. This path is required because the app's admin flow creates the Auth user *and* the linked staff/role/permission records in one transaction. Creating a user directly in the Supabase Auth dashboard produces an Auth user with no staff row, no role in `user_roles`, and no permission grants — `AuthGate` would show "Unable to verify your staff role" and never render a module.

Fields:
- Employee ID: `QA-TEMP-01`
- Username: `qa.readonly`
- Full name: `QA Validation`
- Department: any
- Password: a strong throwaway value
- Status: Active

### 2. Role and permissions
Role: **Administrator**.

Reason: the validation must cover Administration, Settings, Integrations, API Status, Notification Center, Workflow Monitor and Activity Timeline, which the access matrix in `src/lib/rbac.ts` restricts to admin. A Lost & Found Officer or Delivery Coordinator account can only reach part of the app, so the sign-off would be incomplete.

If you'd rather not hand out an admin account, the alternative is two accounts (admin + coordinator) or accepting an explicitly partial report. Say which you prefer.

Read-only is enforced by me, not by the role: I will only navigate, resize, screenshot and open dialogs, and I will **cancel out of every form** rather than submit. I will not create, edit, delete or transition any record. Driver Portal will be validated visually via the driver layout only, without completing deliveries.

### 3. Staff record
Yes — and creating the account through Administration does it for you. Nothing extra to link by hand.

### 4. Row Level Security
No policy changes. RLS is already correct for an authenticated admin; my browser will be a normal signed-in user and inherits exactly what that role can read.

### 5. Project Secrets — required
Yes, `QA_USER` and `QA_PASS` are required, and having a valid account alone is not enough.

Why: my automation runs in a sandbox with no way to receive a password securely at runtime unless it is stored as a project secret. Secrets are exposed to the sandbox as environment variables, so the Playwright script reads them with `os.environ[...]` and types them into the `/auth` form. They are never printed, logged, screenshotted or included in the report. A password pasted into chat would sit in the conversation transcript instead — please use the secrets form.

`QA_USER` = the username `qa.readonly` (the login form accepts username, employee ID, or email).
`QA_PASS` = the password you set.

### 6. Minimum access, summarised
One Active staff account with Administrator role created via Administration, plus its username and password stored as the `QA_USER` and `QA_PASS` project secrets. Nothing else — no service-role key, no Supabase dashboard access, no schema change.

## What I do once that's in place

Sign in through `/auth` with the QA account, then sweep every authenticated module at eight widths — 390, 430, 768, 834, 1024, 1440, 1920, 2560 — capturing screenshots at each.

Modules covered: Executive Dashboard, Lost & Found (registry + case details + PIR wizard), Delivery Management (dispatch + delivery details, all tabs), Delivery Agent Monitoring, Driver Portal, Passenger Portal (public, via a real tracking token), Reports and Quality, Activity Timeline, Workflow Monitor, Notification Center, Customer Feedback, Integrations, API Status, System Settings, Administration.

Per module I check: navigation and sidebar collapse behaviour, page header consistency, KPI grid reflow, table sticky headers / pagination / mobile card fallback, dialog and form layout at small widths, the shared date range filter (presets, From/To, grain, selected-range label, spacing) being visually identical everywhere, horizontal overflow, tap-target sizes, and console errors.

Then I fix what the sweep surfaces, re-screenshot the affected screens, and deliver a **UI Validation Report** with PASS / FAIL / FIXED per module per breakpoint, each verdict backed by a screenshot rather than code reading.

## Technical notes

- Login is driven by Playwright against `http://localhost:8080/auth`; credentials are read from `os.environ` inside the script only.
- Session persistence relies on the app's own Supabase client, so protected routes behave exactly as they do for a real operator.
- Remaining known gaps from the previous round that this sweep will also close: `src/routes/admin.tsx` and `src/routes/settings.tsx` still use bespoke containers instead of `PageHeader` / `SectionCard` / `DataTable`, and `src/routes/reports.tsx` and `src/routes/integrations.tsx` need a primitive-consistency audit.
- Delete the QA account and remove both secrets once sign-off is issued.
