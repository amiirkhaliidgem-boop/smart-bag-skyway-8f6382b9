# Multi-User Concurrency & Capacity Verification

Goal: produce an evidence-based verdict on whether the system is safe for many simultaneous users, plus a capacity report and a GO / NO-GO recommendation. This is a verification exercise: the only code written is throwaway test scripts plus one report document. No product behaviour changes unless a defect is found — those would be raised as a separate follow-up.

## What is already confirmed

Reads done while preparing this plan (not assumptions):

- Every delivery write goes through `wf_transition` / `wf_assert_version`, which take `SELECT ... FOR UPDATE` on the delivery row and reject a stale `p_expected_version` with SQLSTATE 40001. The frontend passes the version it loaded (`src/lib/store.ts`), so optimistic locking is already in place for deliveries and cases.
- `alloc_number` increments a counter row in a single upsert, so BAG / DEL / incident numbers cannot collide under concurrency.
- `lf_create_case` rejects duplicate PIRs and duplicate bag tags.
- `qm_raise_incident` de-duplicates on `dedupe_key`, and `wf_transition` only queues a notification when the workflow status actually changes.

The gaps that still need proving: (a) whether the duplicate checks are backed by real unique indexes or only by read-then-write logic that two concurrent sessions can both pass, (b) whether the notification outbox can double-send, (c) what the UI does when a version conflict is returned, and (d) actual capacity.

## Phase 1 — Database concurrency audit

Query the live database for: unique indexes and constraints backing PIR number, bag tag, delivery number, passenger link token, notification event keys and `dedupe_key`; foreign keys and their delete rules; and lock ordering inside each workflow RPC. Flag any duplicate guard that relies on a read-then-write check without a matching unique index, and any RPC that locks `deliveries` and `baggage_cases` in inconsistent order (a deadlock risk).

## Phase 2 — Concurrency simulation at the SQL layer

Drive genuinely simultaneous sessions against the database and check outcomes:

- two sessions assigning different agents to the same delivery
- two sessions moving the same case through a status change
- two sessions creating a case with the same PIR / same bag tag
- driver completing a delivery while dispatch edits the same record
- passenger feedback submitted while the delivery is transitioning
- the notification drain worker running twice at once over the same queue

Expected result for each: exactly one winner, the loser gets a clean conflict error, and no duplicate row / duplicate timeline entry / duplicate queued message. Any deviation is recorded as a defect with its root cause.

## Phase 3 — Browser-level stress test (Playwright)

Run parallel authenticated browser contexts against the running app covering Lost & Found case creation, status change, dispatch assignment, driver portal stage advance and code verification, passenger tracking page loads, and dashboard refreshes. Verify each operation lands, and that conflicting operations surface a readable "record changed, reload" message rather than a silent overwrite or a stack trace. Capture screenshots of any conflict UI.

## Phase 4 — Capacity assessment

Measure what can be measured: per-RPC latency, the cost of the three snapshot tiers each signed-in client loads, and query timings from the database's own statement statistics. From those measurements, project behaviour at 10, 25, 50 and 100 concurrent users — response time, database connection and CPU pressure, realtime fan-out, and payload size per client. Where a number cannot be measured from inside this environment (real CPU/memory headroom of the hosted database tier, edge worker concurrency), the report says so explicitly and states what infrastructure load test would settle it.

The snapshot-tier read model is the most likely bottleneck: every signed-in client pulls whole-table snapshots, so cost grows with users x data volume rather than with the work being done. Phase 4 quantifies that instead of assuming it.

## Phase 5 — Report

Write `docs/concurrency-capacity-report.md` containing: the concurrency verdict per module (Lost & Found, Delivery Management, Driver Portal, Passenger links, Administration), the locking strategy as implemented (optimistic version guards + row locks) documented properly, the results tables from Phases 2 and 3, the capacity projections, identified bottlenecks, pre-production risks, a scaling strategy (read model, pagination, indexing, worker isolation, caching), and a GO / NO-GO recommendation with any blocking conditions.

## Technical notes

- Concurrency scenarios run as parallel database sessions and parallel Playwright browser contexts; no product source file is modified.
- Test artefacts live under `/tmp/browser/concurrency/`; only the report is added to the repository.
- Any defect found (missing unique index, unhandled 40001 in the UI, a double-send path in the outbox) is listed in the report with a proposed fix, and fixed only after you approve that follow-up.