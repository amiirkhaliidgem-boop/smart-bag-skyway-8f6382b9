# D4 — Enterprise Concurrency Fix, then full re-validation

## 1. Root cause (verified against the live database)

What was observed: two writers targeting the *same* case; the second one sat
waiting, and the database showed the first session as `idle in transaction
(aborted)` holding a `transactionid` lock.

Confirmed by reading the function bodies and the live role/GUC settings:

- `lf_set_status` and `lf_update_case` open with
  `SELECT ... FROM baggage_cases WHERE id = ? FOR UPDATE`.
  `wf_transition` / `wf_assert_version` (after the D3 fix) also take the parent
  case row `FOR UPDATE` first. Lock ordering is therefore already consistent —
  D4 is **not** a lock-ordering bug and **not** a deadlock.
- The blocking wait is a plain row-lock wait: writer B waits on writer A's
  `transactionid` until A's transaction *ends*. Nothing releases a row lock
  early in PostgreSQL — not `RETURN`, not an exception — only COMMIT/ROLLBACK.
- **The real defect: no bounded lock wait.** Live settings show
  `lock_timeout = 0` globally, and the `authenticated` role carries only
  `statement_timeout = 8s` (no `lock_timeout`). So a contended writer waits the
  full statement timeout and then dies with `57014 query canceled` — a raw
  infrastructure error, not a business conflict. The UI's conflict matcher in
  `src/routes/__root.tsx` only recognises `40001`/"version", so the operator
  gets "Operation rejected" after an 8-second freeze.
- **Secondary amplifier: nothing bounds an abandoned transaction.**
  `idle_in_transaction_session_timeout = 0`. A client (or a test harness) that
  errors mid-transaction and stops without rolling back keeps every row lock it
  holds forever — exactly the `idle in transaction (aborted)` state seen. Under
  PostgREST each RPC is its own auto-committed transaction, so this is
  reachable mainly from external/psql sessions, but it is unbounded today and
  must be capped.
- The long hold time inside a single RPC is real work, not a leak:
  `lf_set_status` → `wf_open_delivery` → link creation, passenger-view refresh
  and notification queueing all run while the case row is still locked.

So: correct locking, correct ordering, **no timeout policy and an over-long
critical section**. That is what gets fixed.

## 2. The fix

1. **Bounded lock acquisition.** Every case/delivery-mutating RPC gets
   `SET lock_timeout = '2s'` in its function definition, so a contended writer
   fails fast instead of hanging for the statement timeout.
2. **Lock failure becomes a business conflict.** Each RPC wraps its locking
   section in an exception block that catches `lock_not_available` (55P03) and
   re-raises `40001` with a clear operator message ("This record is being
   updated by someone else — retry in a moment"). Version conflicts keep
   raising `40001` exactly as today, so optimistic locking is untouched.
3. **Shorter critical section.** In `lf_set_status`, the version check and the
   status write stay under the lock; the follow-on side effects that do not
   need the case lock (passenger-view refresh, notification queueing) are moved
   to the end of the transaction after the case row work completes, cutting the
   window other writers can collide with.
4. **Abandoned transactions can no longer hold locks.**
   `idle_in_transaction_session_timeout` set for `authenticated` and `anon`
   (and a matching `lock_timeout`), so a stalled client is reaped.
5. **Retry-safe client.** `src/lib/store.ts` gains a single retry helper: a
   *lock* conflict is retried automatically up to 2 times with jittered
   backoff (safe — the write never started); a *version* conflict is never
   retried and surfaces the reload toast. `src/routes/__root.tsx` learns the
   new codes so 55P03/57014 never show as a raw error again.
6. **Full lock-order audit.** Every `FOR UPDATE` in every workflow RPC is
   listed and confirmed to follow case → delivery → children, with any
   exception corrected in the same migration.

## 3. Concurrency validation (re-run in full)

Authenticated sessions for Officer, Dispatcher, Administrator and Driver
(temporary QA accounts, deleted at the end) drive real RPCs simultaneously:

```text
Officer vs Officer        same case status change
Officer vs Dispatcher     handover vs assignment
Dispatcher vs Admin       assignment vs case edit
Driver vs Dispatcher      stage advance vs reassign / mark failed
different cases           full parallelism, no interference
plus                      passenger feedback, timeline, notifications, audit
```

Pass criteria: one winner per contested write, every loser a clean conflict
within ~2s, no hang, no deadlock, no duplicate rows or events, no illegal
stage, and one timeline/audit/notification entry per real transition.

## 4. Stress testing

5 and 10 simultaneous writers on the *same* case, and 25 writers across
*different* cases. Measured: response time distribution, lock wait duration,
retry counts and success rate, database contention, and post-run workflow
consistency.

## 5. Re-run every verification

End-to-end UAT (both journeys plus the failure/return path), regression
(typecheck, build, and the screens touched), workflow integrity across every
case and delivery, database integrity (orphans, invariants, numbering, bag-tag
uniqueness), production hardening, and capacity re-measurement.

## 6. Final report

`docs/concurrency-capacity-report.md` rewritten as the final Production
Readiness Report: root cause analysis, D1–D4 resolution, concurrency and
stress results, regression and UAT results, workflow and database
verification, performance summary, a PASS/FAIL matrix, and one GO / NO-GO.

## Technical notes

- Migration: recreate `lf_set_status`, `lf_update_case`, `lf_set_region`,
  `wf_transition`, `wf_assert_version`, `wf_open_delivery`, `dm_*` and
  `agent_*` mutating RPCs with `SET lock_timeout='2s'` and a 55P03→40001
  handler; `ALTER ROLE authenticated/anon SET idle_in_transaction_session_timeout`.
- No schema change, no behaviour change to the version protocol.
- App changes limited to `src/lib/store.ts` (retry helper) and
  `src/routes/__root.tsx` (conflict message mapping).
