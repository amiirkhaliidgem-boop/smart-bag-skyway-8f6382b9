# Infrastructure RCA: PostgREST pool saturation, then full re-validation

## What the live database already shows

Read before writing this plan (not assumptions):

- `max_connections = 60`. Right now: 30 total sessions, 3 active, 16 idle,
  2 idle-in-transaction, and **11 belonging to the PostgREST role**
  (`authenticator`). The pool is healthy at rest — it drained since the last run —
  so saturation is load-driven, not a permanent leak.
- `pg_stat_statements` ranks the top consumers by total time, and they are all
  **unfiltered whole-table snapshot reads**, not workflow RPCs:

```text
deliveries            4391 calls   mean 27ms   max 3482ms   total 120s
otp_challenges        2374 calls   mean 30ms   max 3094ms   total  72s
audit_events          2531 calls   mean 28ms   max  550ms   total  70s
workflow_events       2354 calls   mean 27ms   max  487ms   total  63s
timeline_events       2162 calls   mean 19ms   max  323ms   total  40s
notification_events   1610 calls   mean 24ms   max  691ms   total  39s
baggage_cases         4345 calls   mean  7ms   max  226ms   total  31s
```

Every signed-in client loads three snapshot tiers (`loadOpsCore`,
`loadOpsActivity`, `loadOpsSecondary` in `src/lib/ops.functions.ts`), and each
tier issues several `LIMIT`-only selects over whole tables. That is roughly a
dozen pooled connections held per client sign-in / refresh, growing with row
count. The workflow RPCs are not the top of the list — the read model is.

## The working hypothesis to prove or disprove

Saturation comes from **fan-out, not slow locks**: N users x ~12 snapshot
queries x growing tables, each holding a pooled connection for tens to
thousands of milliseconds. Once the PostgREST pool is fully checked out, even
trivial reads queue and return `PGRST003`, which is what the D4 hangs actually
were.

## Investigation (evidence for every item asked)

1. **Pool configuration** — read the effective PostgREST pool size and
   timeouts (`db-pool`, `db-pool-timeout`, `db-max-rows`, statement timeout per
   role) plus `max_connections`, `superuser_reserved_connections`, and any
   Supavisor/pooler layer in front; report the real numbers, and say plainly
   which of them this project can change and which are tier-fixed.
2. **Live connection census under load** — sample `pg_stat_activity` every
   second during a controlled load run: totals by role, state, wait event, and
   longest-running query, so "current active connections" and "max concurrent"
   are measured rather than estimated.
3. **Longest-open requests** — rank by `state_change`/`query_start` age during
   the run, separating real work from pool queueing.
4. **Slowest RPCs vs slowest statements** — two separate tables from
   `pg_stat_statements`: workflow RPC entry points, and raw statements
   (currently dominated by the snapshot selects above).
5. **Connection-holding audit** — walk every mutating RPC and confirm none does
   network I/O, sleeps, or waits while holding a connection; confirm the
   notification drain claim/send split does not hold a DB connection across the
   provider HTTP call (`src/routes/api/public/notifications/drain.ts`).
6. **Realtime and polling contribution** — enumerate every subscription and
   every interval timer in the app (store realtime channels, passenger
   `/passenger/$token` polling, dashboard refreshes, health sweep cron) and
   measure how many pooled requests per minute each generates per open tab.
7. **Endpoint leak check** — verify every server function and API route
   releases its client, and that no path opens a Supabase client per request in
   a loop.
8. **Saturation threshold** — ramp concurrent authenticated clients
   (1/5/10/25/50) and find the point where P95 latency knees and `PGRST003`
   first appears. That number is the honest concurrency ceiling.

## The fix (scoped after evidence, shaped now)

Expected shape, confirmed or corrected by the measurements:

- **Cut the read model down.** Snapshot tiers stop pulling whole tables:
  server-side column projection, row caps with explicit ordering, and
  time-windowing on the event tables (`audit_events`, `workflow_events`,
  `timeline_events`, `notification_events`, `otp_challenges`) so payload and
  connection-hold time stop growing with history.
- **Collapse fan-out.** Where a tier issues many selects, fold them into a
  single set-returning RPC so one client refresh costs one pooled connection
  instead of a handful.
- **Indexing.** Confirm supporting indexes for every ordered/windowed read and
  add what is missing.
- **Throttle background traffic.** Align polling intervals and realtime
  invalidation so an idle tab costs near zero, and refetches coalesce.
- **Pool sizing recommendation.** State the recommended PostgREST pool size and
  client timeout for the tier, with the arithmetic behind it.

## Then, and only then, the re-validation

Run in this order, each with recorded evidence:

1. Concurrency matrix — Officer vs Officer, Officer vs Dispatcher, Dispatcher
   vs Admin, Driver vs Dispatcher; same case and different cases; status
   changes, assignment, transitions, feedback, timeline, notifications, audit.
2. Stress — 5 and 10 writers on one case, 25 across different cases; response
   times, lock duration, retry counts, contention, workflow consistency.
3. Workflow integrity across every case and delivery.
4. Database integrity — orphans, invariants, numbering, bag-tag uniqueness.
5. End-to-end UAT, both journeys plus the failure/return path.
6. Regression — typecheck, build, and every screen touched.

## QA data cleanup

After validation, remove all QA artefacts in dependency order and verify zero
rows remain: QA feedback, QA notifications, QA audit events, QA timeline and
workflow events, QA deliveries and their links/codes, then the QA cases
themselves (the ~30 `QA…` records). Real operational data is untouched; a
before/after count per table goes in the report.

## Final report

`docs/concurrency-capacity-report.md` becomes the Production Readiness Report:
infrastructure RCA with the pool numbers, current vs recommended pool config,
average request duration, slowest RPCs, slowest SQL, measured saturation
threshold, bottleneck analysis, D1-D4 resolution, concurrency and stress
results, workflow and database verification, UAT and regression results, a
PASS/FAIL matrix, and one GO / NO-GO.

## Technical notes

- Read-model changes touch `src/lib/ops.server.ts` / `ops.functions.ts` and the
  store's snapshot consumers; no workflow semantics change.
- Any index or RPC change ships as a migration.
- Load harness and samples live under `/tmp/browser/`; only the report is
  committed.
