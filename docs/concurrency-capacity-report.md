# Production Readiness Report — Concurrency, Capacity & Infrastructure

Date: 2026-08-05. Scope: Lost & Found, Delivery Management, Driver Portal,
Passenger portal, Notifications, Administration.
Method: database structure audit, authenticated multi-role concurrency matrix,
stress testing, infrastructure (API layer / connection pool) root-cause
analysis, and database integrity verification against the live project.

## 1. Verdict

**GO for multi-user production.**

All five defects found during verification (D1–D5) are fixed and re-verified.
Contested writes now resolve in ~150 ms with exactly one winner and a clean
business conflict for every loser. Fifty concurrent clients complete a full
three-tier refresh in under 5 s with zero errors; 100 concurrent clients
(300 simultaneous requests) run without pool exhaustion.

Remaining conditions: keep the read model on the roadmap before ~200
concurrent users (section 7), and repoint the two `pg_cron` workers from the
preview URL to the production URL after publishing.

## 2. Defects and resolutions

| ID | Defect | Status |
| --- | --- | --- |
| D1 | Notification worker could double-send: `SELECT` then `UPDATE` let two overlapping runs claim the same rows | **Fixed** — `notif_claim_batch_atomic` claims in one statement with `FOR UPDATE SKIP LOCKED`; the drain route calls it |
| D2 | Bag tags unique per case only, so two operators could register the same tag simultaneously | **Fixed** — uniqueness trigger with advisory locking; one pre-existing duplicate (`E5367890`) remains in historical data and is listed below |
| D3 | Inconsistent lock ordering between the L&F and Delivery engines (deadlock risk) | **Fixed** — one order everywhere: case → delivery → children |
| D4 | Contested writes hung for the full statement timeout instead of failing as a business conflict | **Fixed** — `wf_lock_case` / `wf_lock_delivery` bound every row lock at `lock_timeout = 2s` and convert a lock failure into a business conflict |
| D5 | **Production blocker.** Any conflict froze the API for ~40 s and permanently consumed a database connection; enough of them took the whole API down | **Fixed** — see below |

### D5 root cause (the real blocker)

Conflicts were raised with SQLSTATE `40001` (serialization failure). PostgREST
treats `40001` as a *retryable* condition and re-executes the request instead
of returning it. Because the conflict is deterministic — the caller's version
really is stale — every retry failed again:

- the client saw no response at all until its own 40 s timeout;
- the database log recorded dozens of `40001` errors per single request;
- each attempt left its connection `idle in transaction (aborted)`, and the
  `authenticator` role had **no** `idle_in_transaction_session_timeout`, so the
  connection never returned to the pool;
- after ~11 such requests the entire PostgREST pool was exhausted and *every*
  API call failed with `PGRST002 — could not query the database for the schema
  cache`. The API was down, not slow.

Fix, applied in three parts:

1. Every conflict now raises SQLSTATE **`PT409`**, which PostgREST returns
   directly as **HTTP 409 Conflict** — no retry, no hang. `40001` must never be
   used for a business conflict on this stack.
2. `ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '30s'`,
   so a connection left inside an unfinished transaction is always reclaimed and
   the API self-heals.
3. The client (`src/lib/store.ts`, `src/routes/__root.tsx`) recognises `PT409`;
   a *lock* conflict is retried automatically with jittered backoff (nothing was
   written), a *version* conflict surfaces a "record changed elsewhere" toast.

Before / after, same request (stale version on `lf_set_status`):

| | Latency | Result |
| --- | --- | --- |
| Before | 40 027 ms | client timeout, connection leaked |
| After | 89–193 ms | HTTP 409 `PT409` with the operator message |

## 3. Locking strategy as implemented

Optimistic concurrency (row `version` + `bump_version` trigger) enforced under
pessimistic row locks inside each transaction:

- Lock order is always **case → delivery → children**, via `wf_lock_case` and
  `wf_lock_delivery`, both bounded by `lock_timeout = 2s`.
- A lock that cannot be taken within 2 s becomes "this record is being updated
  by someone else" (`PT409`); the client retries it transparently up to twice.
- A version mismatch becomes "this record changed since you opened it"
  (`PT409`); this is never retried — it is shown to the operator.
- Stage legality is enforced by `wf_stage_allowed`, so two valid callers cannot
  drive one record down two lifecycle paths.

Structural guards: one active delivery per case, one active one-time code per
delivery, one active passenger link per delivery, one feedback per delivery,
unique PIR / case number / delivery number, incident de-duplication, and
`alloc_number` counter upserts for gap-free sequential numbering.

## 4. Authenticated multi-role concurrency matrix

Four temporary accounts (Officer, Dispatcher, Administrator, Driver) with real
production roles drove genuinely simultaneous RPCs; all accounts and data were
deleted afterwards.

| Scenario | Winners | Conflicts | Unexpected |
| --- | --- | --- | --- |
| Officer vs Administrator — same case status change | 1 | 1 (`PT409`) | 0 |
| Dispatcher vs Administrator — assign same delivery | 1 | 1 (`PT409`) | 0 |
| Driver stage advance vs Dispatcher mark-failed | 1 | 1 (`PT409`) | 0 |
| 4 writers, different cases (full parallelism) | 4 | 0 | 0 |

Every contested write produced exactly one winner, one clean conflict, no hang,
no deadlock, no duplicate row and no illegal stage.

## 5. Stress testing

| Test | Winners | Conflicts | Errors | Wall time | p50 / max |
| --- | --- | --- | --- | --- | --- |
| 5 writers, same case | 1 | 4 | 0 | 147 ms | 102 / 142 ms |
| 10 writers, same case | 1 | 9 | 0 | 213 ms | 164 / 211 ms |
| 25 writers, different cases | 25 | 0 | 0 | 698 ms | 503 / 688 ms |

## 6. Performance work carried out

The connection pool (PostgREST caps at 11 connections) was being saturated by a
client-side fan-out of ~12 parallel snapshot reads per session.

- Three fan-in RPCs (`ops_core_rows`, `ops_activity_rows`, `ops_secondary_rows`)
  collapse each tier into a single round-trip: ~24 → 3 connections per client.
- RLS policies rewritten to scalar sub-selects (initplans) so `is_ops_staff()`
  and `current_app_user_id()` are evaluated once per request, not once per row;
  staff and agent policies merged; index added on `deliveries(assigned_agent_id)`.
  Server-side `ops_core_rows`: **391 ms → ~180 ms**.
- Store tuning: realtime debounce 150 ms → 750 ms, background tabs defer
  refetching until visible, and post-write refreshes touch only the Core and
  Activity tiers.

| Load | Full 3-tier refresh (before) | After |
| --- | --- | --- |
| 50 concurrent users | 18.8 s | **~4.7 s**, 0 errors |
| 100 concurrent clients (300 requests) | pool exhaustion (`PGRST003`) | stable, 0 errors |

Passenger tracking (`passenger_get_view`) stays sub-linear: 73 ms p50 at 1 call,
108 ms p50 / 190 ms max at 50 parallel calls, zero errors.

## 7. Capacity

| Concurrent users | Expected behaviour |
| --- | --- |
| 10–25 | Comfortable; sub-second interactions. |
| 50 | Verified good: full refresh < 5 s, no errors, no pool pressure. |
| 100 | Verified stable at 300 simultaneous requests. Realtime fan-out is the cost driver as data grows. |
| 200+ | Requires the read-model work below: server-side pagination per screen, row-level realtime updates instead of tier re-pulls, and covering indexes for list sorts. |

## 8. Database integrity verification

Checked across all live data after the runs:

| Check | Result |
| --- | --- |
| Orphan deliveries | 0 |
| Cases with more than one delivery | 0 |
| Multiple active one-time codes / passenger links | 0 / 0 |
| Duplicate case numbers / delivery numbers | 0 / 0 |
| Passenger-view drift vs delivery stage | 0 |
| Stage ↔ workflow-status mismatch | 2 rows, both `Delivered` + `FEEDBACK_SUBMITTED` — a legitimate post-delivery status, not a defect |
| Duplicate bag tags | 1 historical duplicate (`E5367890`, two cases) predating the D2 guard; new duplicates are now blocked |
| Leaked API connections after all tests | 0 |

All QA cases, deliveries, journals and temporary accounts created during
verification were deleted; the database contains only real operational data
(20 cases, 15 deliveries).

## 9. Remaining risks

- **Low:** the one historical duplicate bag tag; correct it operationally when
  the right owner is known.
- **Medium (roadmap, not blocking):** whole-table snapshot read model beyond
  ~100 concurrent users.
- **Action after publishing:** repoint the two `pg_cron` workers (notification
  drain, health sweep) from the `-dev` preview URL to the production URL.

## 10. GO / NO-GO

**GO.** The concurrency, locking and API-layer blockers are resolved and
re-verified end to end under multi-role and stress conditions.
