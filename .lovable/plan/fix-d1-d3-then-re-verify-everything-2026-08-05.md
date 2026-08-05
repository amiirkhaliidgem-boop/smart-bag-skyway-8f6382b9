# Fix D1-D3, then re-verify everything

Three defects get fixed, then the full verification suite is re-run — including the
authenticated multi-role concurrency test that could not be executed last time.
The Production Readiness Report is only updated at the end, with the final call.

## Part 1 — The fixes

### D1: Notification worker can send twice (blocking)

Today the worker reads a batch of pending messages, then marks them "sending" in a
second step. Two overlapping runs both read the same batch. Proven live.

Fix: a new database function claims and marks in a single statement using
`FOR UPDATE SKIP LOCKED`, so a second run already in flight picks up different
rows, or none. The worker (`src/routes/api/public/notifications/drain.ts`) calls
that function instead of the select-then-update pair; nothing else about its
behaviour changes. The claim only takes rows still queued or failed, so a row
already being worked cannot be re-taken.

### D2: Bag tags unique per case only

A cross-case duplicate already exists in the data — tag `E5367890` is registered
on two different cases — so the index cannot simply be added. Proposed sequence:
I show you the two cases, you confirm which registration is wrong, we correct that
one row, then add a global unique index on non-empty bag tags. Nothing is deleted
without your confirmation. If you would rather leave the existing duplicate alone,
the alternative is an index covering new rows only, which is weaker — I recommend
cleaning the one row.

### D3: Deadlock risk from inconsistent lock order

`lf_set_status` locks the case then the delivery; `wf_transition` locks the
delivery then the case. Fix: `wf_transition` and the delivery RPCs that update the
case row lock the parent case row first, giving both engines one lock order.
Behaviour is unchanged; only the ordering inside the transaction moves.

## Part 2 — Re-verification

### A. Authenticated multi-role concurrency (the missing evidence)

Real staff sessions can be minted in this environment through the Supabase Auth
Admin API, so this test is now possible without you handing over any passwords.
Four temporary QA accounts are created — Lost & Found Officer, Dispatcher,
Administrator, Delivery Agent — each carrying the same roles your real staff use,
and all four are removed at the end of the run.

Each role then drives its real operations concurrently against the same records:

```text
same case      Officer changes status      vs  Admin edits the case
same case      Officer hands over          vs  Dispatcher assigns a driver
same delivery  Dispatcher reassigns driver vs  Driver accepts / advances stage
same delivery  Dispatcher marks failed     vs  Driver completes with the code
all four       20 parallel writes across 5 cases, repeated
```

Pass criteria, verified in the database afterwards:
- Exactly one winner per contested write; every loser rejected with a version
  conflict, never silently overwritten.
- No case or delivery left in an illegal stage; no skipped lifecycle step.
- One delivery per case, one active code per delivery, one active link per delivery.
- Timeline, audit and workflow events show one entry per real transition — no
  duplicates, no gaps.
- No deadlock, which also regression-checks D3.

### B. Concurrency verification (full re-run)

Repeat the earlier probes plus a specific D1 re-test: two simultaneous worker runs
must now claim disjoint sets of messages. Re-measure passenger tracking latency at
1/10/25/50 parallel calls and confirm no regression from the lock-order change.

### C. Database integrity verification

Orphan checks across every foreign key; the one-active-delivery, one-active-code
and one-active-link invariants; numbering sequences with no duplicates or gaps;
the operational-reference fallback still consistent for cases without a PIR; and
the new bag-tag index holding.

### D. Workflow integrity verification

Walk every case and delivery in the database and confirm case status, delivery
stage and workflow status agree, that every recorded transition is legal under the
stage rules, and that each transition produced its timeline, audit and
notification rows.

### E. End-to-end UAT

Full journeys in the browser, signed in as the QA roles: create a case with and
without a PIR number, hand over at Ready for Delivery, schedule, assign a driver,
driver accepts, collects, goes out for delivery, completes with the one-time code,
passenger portal reflects each step, feedback submitted. Plus the Airport Pickup
journey and the failure / return-to-airport path.

### F. Regression testing

Typecheck and build, then a pass over the screens touched by the fixes and the
screens that read notification state: Dispatch Center, Delivery Details, Lost &
Found list and details, Driver Portal, Passenger Portal, Notifications, Timeline,
Audit, Quality Management, Reports and the Executive Dashboard.

## Part 3 — Final report

`docs/concurrency-capacity-report.md` is updated in place with the fixed status of
D1-D3, the new authenticated multi-role evidence, refreshed measurements, and a
single final GO / NO-GO recommendation with the capacity numbers behind it.

## Technical notes

- D1: migration adding an atomic claim function (SECURITY DEFINER, `FOR UPDATE
  SKIP LOCKED`, EXECUTE granted to `service_role` only) plus an edit to the drain
  route handler.
- D2: migration adding a partial unique index on `case_bags(bag_tag)` where the
  tag is non-empty, after the existing duplicate is resolved.
- D3: migration replacing `wf_transition` with an identical body that takes
  `SELECT ... FROM baggage_cases WHERE id = <case> FOR UPDATE` before locking the
  delivery row.
- QA accounts are created and deleted through the Auth Admin API inside the test
  run; no long-lived test credentials are left behind.