## What I verified first

- `timeline_events` exists in the database and `wf_journal()` already writes to it on every L&F status change, delivery transition, notes, OTP and feedback action — but **no code reads it**. `src/routes/timeline.tsx` synthesizes events client-side from projections, which is why several L&F transitions never appear.
- Assign Officer sends `internal.assignedOfficer`, but `casePatchPayload()` in `src/lib/store.ts` silently drops it and `lf_update_case()` has no `assigned_officer_id` branch → the write is a no-op (no error, no timeline, no audit).
- `baggage_cases.assigned_officer_id` (uuid → `app_users`) already exists and is unused.
- The import template prepends a "Template Version" column; phone fields are only warnings, but the row that fails Egyptian numbers needs checking end-to-end against the actual parse path.
- PIR is required in the wizard (step validation + field) and in the import schema; `baggage_cases.pir_number` is already nullable and `next_case_no()` already produces sequential `BAG-00000X` ids.
- `LF_STATUSES` (with `Closed`) drives the status filter; `Last Updated` and the Columns toggle live in `ALL_COLUMNS` / the Columns dropdown.

## 1. Timeline becomes the system-wide event log

- Add `timeline_events` to the activity snapshot tier (`src/lib/ops.server.ts`, `ops.mapping.ts`, `ops.functions.ts` tier 2), mapped into a new `timeline` array on the store.
- Rewrite `src/routes/timeline.tsx` to render that DB feed as the primary source (module, title, detail, actor, case/delivery reference, status), keeping the existing visual design, filters and grouping. Client-side synthesis is removed so no module "writes" timeline entries in the UI layer.
- Migration: extend `wf_journal()` coverage so the modules that currently bypass it also journal — officer assignment, quality incidents, storage assignment, and import/export runs (a small `wf_journal_simple()` helper for non-transition events). Feedback, notifications, delivery and driver actions already journal and stay unchanged.

## 2. Assign Officer works and synchronizes

- Migration: add an `assigned_officer_id` branch to `lf_update_case()` (resolve by `app_users.id`), journaling through `wf_journal()` so Timeline + Audit both record it.
- Add `list_staff_officers()` (security definer, mirrors `list_delivery_agents()`) returning active non-driver staff.
- Frontend: `casePatchPayload()` maps `internal.assignedOfficer`; the Assign Officer dialogs in `lost-found.index.tsx` and `lost-found.$bagId.tsx` become a **dropdown of real staff** instead of free text. Case details and the registry column update immediately after the RPC refresh.

## 3. Import template usability

- Drop the "Template Version" column from generated templates (`src/lib/io/template.ts`) while `import-service.ts` keeps tolerating it in older files.
- Phone handling: accept local Egyptian formats (`010/011/012/015` + 8 digits) alongside international `+20…`, with normalization at parse time; keep non-matching values as warnings, never rejections.
- Make PIR non-required in the L&F import schema (see item 4).
- Test after implementation with a generated template containing local-format numbers and confirm rows import as "Imported Successfully".

## 4. PIR Number optional

- Wizard: remove the required marker and the step-4 validation; blank PIR passes.
- Store/RPC: send `null` for empty PIR; `lf_create_case()` already assigns the sequential `BAG-0000XX` case number.
- UI fallbacks: registry, case details, PIR report and exports show the Case ID when PIR is empty.
- Import: PIR optional; duplicate detection only applies when a PIR is present.

## 5. L&F UI cleanup

- Status filter and any selector use `LF_OWNED_STATUSES` plus the read-only downstream ones, with `Closed` removed from user-facing lists (kept in the engine enum and mapping).
- Remove the `Last Updated` column and the Columns toggle; ship one fixed layout: PIR/Case, Passenger, Flight, Bag Tag, Current Status, Assigned Officer, Priority, Created Date, Actions.

## 6. End-to-end validation

Run a scripted UAT case through L&F → Ready for Delivery → assign agent → accept → collect → out for delivery → 6-digit OTP → Delivered, plus officer assignment and a bulk import, then query `timeline_events`, `audit_events`, `notification_events`, `workflow_events` and the projections to confirm each step is recorded. Deliver a written report covering Timeline, Audit, Notifications, Passenger Portal, Dashboard and Reports, and confirming no schema or Workflow Engine regressions.

## Technical notes

Two migrations (timeline journaling helper + `lf_update_case` officer branch and `list_staff_officers`). Frontend edits: `ops.server.ts`, `ops.mapping.ts`, `ops.functions.ts`, `store.ts`, `timeline.tsx`, `lost-found.index.tsx`, `lost-found.$bagId.tsx`, `pir-wizard.tsx`, `io/template.ts`, `io/registry.ts`, `io/validation.ts`. No changes to the delivery lifecycle, RLS model or passenger portal design.
