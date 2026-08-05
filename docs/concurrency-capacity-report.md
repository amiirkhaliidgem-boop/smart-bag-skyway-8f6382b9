# Multi-User Concurrency & Capacity Report

Date: 2026-08-05. Scope: Lost & Found, Delivery Management, Driver Portal,
Passenger links, Administration. Method: database structure audit, live
concurrency probes against the project database, a double-run test of the
notification worker, and parallel browser sessions on the passenger portal.

## 1. Verdict

**Does the system support multiple concurrent users? Yes** — the write path is
genuinely concurrency-safe. Every state change goes through a SECURITY DEFINER
RPC that takes a row lock and checks a version number, so lost updates,
duplicate records and duplicate workflow transitions are prevented at the
database, not in the UI.

Three defects were found. Two are low impact; one (duplicate notifications from
overlapping worker runs) must be fixed before a live SMS/WhatsApp transport is
connected.

**Recommendation: GO for multi-user production, conditional** on fixing D1
before enabling a real notification transport.

## 2. Locking strategy as implemented

Optimistic concurrency with pessimistic row locks inside each transaction:

- `wf_transition` and `wf_assert_version` do `SELECT ... FROM deliveries WHERE
  id = ? FOR UPDATE`, then compare the caller's `p_expected_version` against the
  stored `version`. A mismatch raises SQLSTATE `40001`.
- `lf_set_status` and `lf_update_case` do the same on `baggage_cases`.
- The client sends the version it last read (`src/lib/store.ts`), and
  `src/routes/__root.tsx` turns a `40001` into a "This record changed elsewhere —
  reload and retry" toast. Conflicts are visible to the operator, not silent.
- A `bump_version` trigger increments `version` on every row update, so a stale
  editor can never win.
- Stage legality is enforced by `wf_stage_allowed`, so even two valid callers
  cannot drive the record down two different lifecycle paths.

Structural guards backing the same rules:

| Guard | Index / constraint |
| --- | --- |
| One active delivery per case | `deliveries_one_active_per_case_idx` (partial unique) |
| One active one-time code per delivery | `otp_one_active_per_delivery_idx` |
| One active passenger link per delivery | `passenger_links_active_per_delivery_idx` |
| One feedback per delivery | `passenger_feedback_one_per_delivery_idx` |
| Unique PIR, case number, delivery number | unique constraints |
| Quality incident de-duplication | `quality_incidents_dedupe_uidx` |
| Sequential numbering | `alloc_number` single-statement upsert on a counter row |

`alloc_number` increments inside the caller's transaction, so concurrent
callers serialise on the counter row: no duplicate and no gap.

## 3. Concurrent-editing scenarios

| Scenario | Behaviour | Result |
| --- | --- | --- |
| Two agents open the same case | Both read freely; no lock held while viewing | Safe |
| Two agents change the same status | Row lock + version check; second gets `40001` and a reload toast | Safe |
| Two dispatchers assign the same delivery | `dm_assign_agent` asserts version under `FOR UPDATE`; loser rejected. The one-time code is re-issued only by the winner | Safe |
| Two supervisors edit the same record | Last writer must hold the current version, otherwise rejected | Safe |
| Driver updates while L&F edits the same case | Both succeed only if neither is stale; L&F is additionally blocked once the case leaves "Ready for Delivery" | Safe, but see D3 (lock ordering) |
| Passenger acts while delivery transitions | Passenger writes are token-scoped RPCs on separate tables (`passenger_feedback`, `passenger_links`), de-duplicated by unique index | Safe |
| Two imports with the same PIR / bag tag | PIR is protected by a unique index; bag tag is not globally unique (D2) | Partial |

## 4. Defects found

**D1 — Notification worker can double-send (must fix before go-live).**
`src/routes/api/public/notifications/drain.ts` claims work with a `SELECT`
followed by a separate `UPDATE ... state='sending'`. Two overlapping runs both
see the same rows. Verified live: two simultaneous POSTs each returned
`{"claimed":7}` for the same seven events. Today nothing is sent (no transport
configured), so the impact is nil — but with Twilio or WhatsApp connected this
sends every message twice. `pg_cron` fires the drain every 2 minutes via
`pg_net` (fire-and-forget), so a run slower than 2 minutes overlaps the next.
Fix: claim atomically — a single `UPDATE ... SET state='sending' WHERE id IN
(SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *` in one SQL statement.

**D2 — Bag tags are unique per case, not globally.** `lf_create_case` rejects a
bag tag already registered on another case, but that is a read-then-write check
and the only unique index is `case_bags (case_id, bag_tag)`. Two operators
registering the same tag on two new cases at the same instant will both succeed.
Fix: add a global unique index on `case_bags(bag_tag)` (as a migration, after
confirming no existing duplicates).

**D3 — Inconsistent lock ordering between the two engines.** `lf_set_status`
locks `baggage_cases` and then writes `deliveries`; `wf_transition` locks
`deliveries` and then writes `baggage_cases`. A Lost & Found status change and a
delivery transition on the same case, executed at the same instant, can
deadlock. PostgreSQL detects this and aborts one side (`40P01`), which the UI
shows as a rejected operation, so there is no data corruption — but the operator
sees an unexplained failure. Fix: lock the case row first in `wf_transition`
too, giving both engines the same order.

No other duplicate-record, duplicate-timeline or duplicate-notification path was
found: `wf_transition` only queues a message when the workflow status actually
changes, and `qm_raise_incident` de-duplicates on `dedupe_key` with a matching
unique index.

## 5. Measurements

Passenger tracking RPC (`passenger_get_view`) under parallel load, measured from
this environment against the live database:

| Parallel calls | p50 | max | Errors |
| --- | --- | --- | --- |
| 1 | 73 ms | 73 ms | 0 |
| 10 | 86 ms | 105 ms | 0 |
| 25 | 95 ms | 146 ms | 0 |
| 50 | 108 ms | 190 ms | 0 |

Latency grows sub-linearly to 50 concurrent readers — the database tier is not
the near-term constraint.

Signed-in client snapshot cost (current data volume: 20 cases, 15 deliveries,
204 timeline, 195 audit, 110 notification rows):

| Tier query | Time | Payload |
| --- | --- | --- |
| cases | 66 ms | 29 KB |
| deliveries | 64 ms | 15 KB |
| workflow_events | 74 ms | 70 KB |
| timeline_events | 84 ms | 82 KB |
| audit_events | 72 ms | 74 KB |
| notification_events | 105 ms | 155 KB |
| **Total per full refresh** | | **~424 KB** |

Parallel browser sessions on the passenger portal (development server, so these
numbers reflect unbundled dev assets and are pessimistic versus production): 5
sessions 4.3 s p50, 15 sessions 9.9 s p50, 25 sessions 15.4 s p50 — all 25
rendered correctly with zero console errors. The growth is asset serving by the
single dev process, not database contention.

A staff-authenticated browser stress test (PIR creation, assignment, driver
stage advance) could not be executed: this project uses an external Supabase
project, so Lovable cannot mint a staff session for automation. Those paths were
verified by database-level audit and by the locking analysis above instead. See
section 8 for the load test that would close this gap.

## 6. Capacity assessment

The binding constraint is the read model, not the write path. Every signed-in
client loads whole-table snapshots (limits: 500 cases, 500 deliveries, 900
workflow events, 800 timeline, 500 audit, 500 notification rows), and a realtime
subscription on `deliveries`, `baggage_cases` and `notification_events` makes
**every** client re-pull the affected tier whenever **any** user changes
anything. Cost therefore scales with users x data volume x change rate, not with
the work being done.

| Concurrent users | Expected behaviour |
| --- | --- |
| 10 | Comfortable. Sub-second interactions, ~0.4 MB per client per refresh burst, negligible database CPU. No action needed. |
| 25 | Still good. A busy minute (say 20 changes) fans out to ~25 x 0.4 MB per debounced burst; page interactions stay responsive. Watch egress. |
| 50 | Degradation begins as data grows. Snapshot payloads reach the row limits, refresh bursts overlap, and clients spend visible time re-parsing. Response times remain acceptable but the UI feels "reloading". |
| 100 | Not recommended without the changes in section 7. Realtime fan-out dominates: each write triggers up to 100 full-tier refetches; connection-pool pressure and browser memory (whole dataset held per tab) become the failure mode before database CPU does. |

Per-dimension notes:

- **Database load.** Writes are short, single-row, lock-held-briefly transactions
  — they scale far past 100 users. Reads are the load, and they are repetitive
  full-table scans of small tables served from cache.
- **Memory.** Each tab holds the entire snapshot in JavaScript memory; that is
  fine at today's volume and becomes the limiting factor once the tables reach
  their 500/900-row caps.
- **CPU.** Server-side CPU is dominated by JSON serialisation of snapshots, not
  by business logic.
- **Network.** ~0.4 MB per client per refresh is the number to watch; at 100
  users and a high change rate this is the first thing to saturate.
- **Background workers.** The drain worker is single-instance by schedule but not
  by construction (D1).

## 7. Recommended scaling strategy

1. Fix D1 (atomic claim with `FOR UPDATE SKIP LOCKED`) before connecting a live
   transport. Blocking.
2. Add the global bag-tag unique index (D2) and align lock ordering (D3).
3. Replace whole-table snapshots with server-side filtered, paginated queries per
   screen. This single change moves the ceiling from ~50 to several hundred users.
4. Make realtime granular: refresh the changed row instead of re-pulling the tier,
   or subscribe only to rows visible on the current screen.
5. Add covering indexes for the list screens' sort/filter columns once pagination
   lands (`deliveries(stage, updated_at)`, `baggage_cases(lf_status, updated_at)`,
   `timeline_events(occurred_at)`).
6. Move the notification drain to a queue-style claim with visibility timeout, and
   keep it idempotent per event.
7. Publish the app and repoint the two `pg_cron` workers from the `-dev` preview
   URL to the production URL.

## 8. Risks before production

- **Blocking:** D1, once any SMS/WhatsApp transport is enabled.
- **Medium:** the snapshot read model at >50 concurrent users, and the workers
  still pointing at the preview URL.
- **Low:** D2 and D3.
- **Unvalidated:** staff-authenticated multi-user load. To close it, run an
  authenticated load test with real staff accounts (dispatcher, agent, driver)
  against the published environment — 25/50/100 virtual users performing PIR
  creation, status change, assignment and driver completion for 15 minutes —
  measuring server-function latency, database CPU, connection count and realtime
  message rate. That requires credentials this environment does not have.

## 9. GO / NO-GO

**GO** for multi-user production at up to approximately 50 concurrent users,
conditional on fixing D1 before a live notification transport is connected.
**NO-GO** at 100 concurrent users until the read model is paginated and realtime
refresh is made granular.