# Passenger Feedback Failure — Root Cause and System Verification

## Root cause (confirmed by database inspection)

Passenger feedback submissions fail for one specific reason:

`passenger_submit_feedback` (the public, token-based function the portal calls) ends by writing a journal entry through `wf_journal_event`. That journaling function begins with a hard guard:

```text
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'
```

The Passenger Portal is deliberately anonymous — there is no signed-in user on a tracking link. So the guard raises, the whole transaction rolls back, and the feedback row inserted a few lines earlier is discarded. Nothing reaches `passenger_feedback`, `timeline_events`, or `audit_events`.

Evidence:

- `passenger_feedback` holds 9 rows, newest 2026-08-02 11:44. Delivery DEL-000011, delivered 2026-08-04, has a valid tracking link and zero feedback rows.
- The auth guard lives inside `wf_journal_event`, which is granted to `authenticated` only.

Two further defects sit behind the same flow:

- The function's `ON CONFLICT (delivery_id) DO UPDATE` collides with the `passenger_feedback_immutable` BEFORE UPDATE trigger, so any re-submission would also fail.
- Feedback never advances the workflow to `FEEDBACK_SUBMITTED`.

Frontend defect that hid all of this: `FeedbackScreen.submit()` awaits the server call with no try/catch and calls `onSubmit()` unconditionally, so the passenger always sees the "Thanks" screen even when the write failed.

## Why this appeared after the UI/UX work

It was not caused by the UI/UX standardization. The regression window (last successful feedback 2026-08-02) matches the security-definer hardening pass, when the authentication guard was added to the shared journaling function. `wf_journal_event` is shared by staff RPCs and by the anonymous passenger RPCs; hardening it for staff silently broke the one caller that has no session by design. The audit step below will list every public/anonymous RPC that reaches a guarded shared function so this class of break cannot recur.

## Fix

Database migration:

1. Add `wf_journal_public(...)` — same insert behaviour as `wf_journal_event` but with no `auth.uid()` requirement, attributing the actor as `Passenger Portal`. Callable only from SECURITY DEFINER functions. Leave `wf_journal_event` and its guard untouched for staff paths.
2. Rewrite `passenger_submit_feedback` to journal through the public variant, replace `ON CONFLICT DO UPDATE` with a conflict-safe path that reports "already submitted" instead of hitting the immutability trigger, and advance the delivery/case workflow to `FEEDBACK_SUBMITTED` through the workflow engine so Dashboard, Reports and Timeline stay consistent.
3. Apply the same public-journal fix to `passenger_report_misconduct` if `qm_raise_incident` reaches the guarded journal on the anonymous path.

Frontend (`src/routes/passenger.index.tsx`, `src/lib/passenger.functions.ts`):

- Wrap the submit in try/catch, disable the button while in flight, show the Thanks screen only on a successful result, and surface a retry message otherwise.
- Return a discriminated result from `mutatePassengerView` instead of a bare boolean the UI ignores.

## Verification and reporting

1. End-to-end feedback test on a real delivered tracking link, then confirm the row in `passenger_feedback`, entries in `timeline_events` and `audit_events`, the workflow status, and the Feedback dashboard count (9 deliveries must show 9 responses, not 18).
2. Dependency audit: enumerate every public/anonymous RPC, list which shared functions it calls, and flag any that hit an authentication guard.
3. Workflow integrity walk-through for both branches — PIR to Delivered, and PIR to Passenger Picked Up — checking case status, delivery stage, timeline, notifications, dashboard KPIs, reports and audit at each transition.
4. Authenticated regression sweep (QA account, Playwright) across Lost & Found, Delivery Management, Driver Portal, Feedback, Workflow Monitor, Timeline, Reports, API Status, Administration and Notification Center, on desktop/tablet/mobile.
5. Final Production Readiness Report: root cause, issues found/fixed, regression results, database and workflow verification, PASS/FAIL matrix, GO/NO-GO recommendation.

## Technical notes

Passenger Portal visual design stays frozen — the only portal change is error handling around submit. No table schema changes; immutability triggers and RLS denials stay as they are.  
**7. Production Hardening**

After completing the Root Cause Analysis, Workflow Verification, Database Integrity Verification, Regression Testing and End-to-End UAT:

- Verify that there are **no orphan records** anywhere in the database.
- Verify that every Workflow transition is **idempotent** (repeating the same action cannot corrupt data or create duplicates).
- Verify that every background worker (Cron Jobs, Notification Engine, Workflow Engine) can safely recover after failures or server restarts.
- Verify that all scheduled jobs, queues and retry mechanisms are functioning correctly.
- Verify there are no duplicate notifications, duplicate timeline entries, duplicate delivery records or duplicate workflow events.
- Verify all indexes, constraints and foreign keys are optimized and valid.
- Verify that no placeholder/demo/mock code remains anywhere in the project.
- Verify that Production Build is clean (no console errors, warnings or failed network requests).
- Verify that the application can safely transition from Lovable Preview to the Production Server without requiring code modifications.