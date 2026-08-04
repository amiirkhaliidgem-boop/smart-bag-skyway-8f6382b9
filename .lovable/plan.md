# BAG Sequence Integrity — Root Cause & Enterprise Fix

## What actually happened (verified against the live database)

Confirmed by reading the live data and function definitions:

- Cases on record: BAG-000001 … BAG-000011, then BAG-000018. Numbers 12–17 were consumed but never became cases.
- `next_case_no()` returns `'BAG-' || lpad(nextval('pir_no_seq'), 6, '0')`.
- `lf_create_case()` calls `next_case_no()` **inside the INSERT's VALUES list**, so the number is drawn *before* PostgreSQL checks the unique constraint on `pir_number`.

### Root cause

This is expected PostgreSQL behaviour, not a database bug — and it is an application design problem.

`nextval()` is deliberately non-transactional: it never rolls back, so concurrent sessions can never receive the same value. Every failed attempt therefore permanently burns a BAG number. Six attempts failed on the duplicate PIR (`baggage_cases_pir_number_key`), so six numbers were lost. The retry pattern in the UI (operator edits the PIR and presses Create again) makes each retry consume another number.

Contributing factor: the Create button in the PIR wizard is only disabled by form validity, not by an in-flight flag, so a double click issues two create calls; the loser burns a number. The CSV importer calls the same function per row, so every rejected row burns one too.

Not causes (checked and excluded): identity columns, triggers, the Workflow Engine, optimistic UI updates, and transaction rollback of the row itself (the row does roll back — only the counter does not).

### Business impact

BAG numbers are operational case identifiers printed on PIR reports and quoted to passengers and airlines. Gaps look like lost or deleted cases during audits and reconciliation, even though nothing was lost.

## The fix (proper solution, not a workaround)

**1. Validate before allocating.** `lf_create_case()` will check for a conflicting `pir_number` up front and raise a clear, business-readable error ("PIR number X already exists on case BAG-0000NN") before any number is drawn. Same for duplicate bag tags. This removes the dominant cause of gaps and gives operators a usable message instead of a raw constraint error.

**2. Gapless, transaction-safe counter.** Replace the sequence with a counter table (`public.number_counters(key, current_value)`) read via `UPDATE ... RETURNING` inside the same transaction as the insert. Properties:
- No duplicates — the row lock serialises allocation.
- No gaps — the increment rolls back with the transaction if the insert fails.
- Safe concurrency — the second writer waits on the row lock and then gets the next value.
- Allocation happens as the *last* step before the insert, so the lock is held for microseconds; at airport case volumes (tens per day) there is no throughput concern.

The counter is seeded from the current maximum in use (11), so numbering continues at BAG-000012 with no risk of collision with BAG-000018. `case_no` keeps its unique constraint as the final guarantee. `next_case_no()` keeps its name and signature — nothing else in the system has to change.

**3. Same treatment for delivery numbers and incident numbers**, which use identical `nextval` patterns and have the same exposure.

**4. Client-side double-submit guard** in the PIR wizard: the Create button disables while a create call is in flight.

## Verification of the whole create flow

After the fix I will exercise, with evidence: create via wizard (complete and incomplete), duplicate PIR rejection with the friendly error, duplicate bag tag handling, concurrent create, CSV import with rejected rows, and confirm for each that the sequence advanced by exactly the number of cases actually created. Then confirm the created case produces its Timeline entry, Audit event, `PIR_CREATED` workflow event, notification queue entry where applicable, and appears in the Dashboard KPIs.

## Full authenticated end-to-end UAT

Using the QA account and Playwright, a PASS/FAIL/FIXED matrix across Authentication, Dashboard, Lost & Found (create/edit/status), Workflow Engine, Delivery Management, Driver Portal, Notifications, Timeline, Reports, Feedback, Administration, API Status and Integrations — each checked for UI, business logic, database effect, workflow transition, timeline, notifications, audit log, error handling and responsive behaviour at 390/768/1440/2560px.

## Technical summary

- Migration: `number_counters` table + `alloc_number(key, prefix, width)` helper; rewrite `next_case_no()`, `next_delivery_no()`, `next_incident_no()` to use it; seed counters from current max values; drop reliance on `pir_no_seq`, `delivery_no_seq`, `incident_no_seq`.
- Migration: pre-flight duplicate checks and clear `RAISE EXCEPTION` messages in `lf_create_case()`.
- `src/components/lost-found/pir-wizard.tsx`: in-flight submit guard.
- `src/lib/store.ts`: surface the server's business error text to the operator instead of swallowing it.
