## Diagnostic report

I queried the database directly before drawing any conclusion.

**Evidence**

1. `select ... from api_health_checks group by api_key` returns **zero rows**. No health sample has ever been recorded for any API.
2. All seven probe target tables exist (`workflow_events`, `notification_events`, `passenger_view`, `agent_routes`, `quality_incidents`, `timeline_events`, `deliveries`) — the probes themselves are valid.
3. `cron.job` contains **only** `drain-notification-outbox` (every 2 min). There is **no scheduled job** calling `/api/public/system/health-sweep`, so the sweep endpoint that exists in code has never been invoked.
4. `integrations` rows: all six external slots have `secrets_ciphertext = NULL`, `status = 'disabled'`; `cloud_database` is `connected`.

**Why the seven internal APIs show "Degraded"**

The status rule in `buildApiHealth` is:

```text
samples in last 24h == 0  →  internal  → "degraded"
                             external unconfigured → "not_configured"
```

So "Degraded" here does **not** mean anything failed. It is the display of *"considered configured, but zero heartbeats in the last 24 hours"*. This matches the screenshot exactly: Latency —, Uptime —, Errors 0, Last heartbeat —.

| API | Current | Root cause | Category | Expected | Required to become Operational | Fix type |
|---|---|---|---|---|---|---|
| Workflow API | Degraded | No sample ever recorded | Missing heartbeat (no scheduler) | Operational | Run a sweep + schedule it | Config + small code |
| Notification API | Degraded | Same | Missing heartbeat | Operational | Same | Config + small code |
| Passenger API | Degraded | Same | Missing heartbeat | Operational | Same | Config + small code |
| Delivery Agent API | Degraded | Same | Missing heartbeat | Operational | Same | Config + small code |
| Quality Management API | Degraded | Same | Missing heartbeat | Operational | Same | Config + small code |
| Reporting API | Degraded | Same | Missing heartbeat | Operational | Same | Config + small code |
| Database API | Degraded | Same (probe is valid, never run) | Missing heartbeat | Operational | Same | Config + small code |
| Google Maps / SMS / WhatsApp / Email / Odoo | Not configured | No credentials stored | Missing credentials | Not configured until credentials entered | Admin enters credentials in Integration Center | Configuration only |
| Mobile Platform | Not configured | No credentials, **and** the sweep skips any integration whose `secrets_ciphertext` is NULL — Mobile Platform has no required secret, so it can never be probed even once configured | Code defect | Operational once bundle IDs are set | Change the sweep's "configured" test | Code change |

**Two additional real defects found**

- `cloud_database` writes its samples under the key `cloud_database`, but the monitored key is `database`. Those samples are orphaned and never displayed.
- No cron job exists for the health sweep, so even after one manual run the page would go Degraded again after 24 h.

Nothing is being hidden or forced anywhere; the page is honestly reporting "no heartbeat".

## Fixes to implement

1. **Schedule the sweep** — add a `pg_cron` job (every 5 minutes) posting to `/api/public/system/health-sweep` with the project apikey, mirroring the existing notification drainer job. This is what makes internal APIs genuinely Operational and keeps them honest: if a probe starts failing, the page turns Down/Degraded on its own.
2. **Fix the sweep's "configured" test** in `runHealthSweep` (`src/lib/system/integrations.server.ts`): probe an integration when it has secrets **or** when its definition declares no required secret fields (Mobile Platform), instead of the current NULL-ciphertext-only check.
3. **Fix the orphaned database samples** — map the `cloud_database` integration probe onto the monitored `database` key so its latency/uptime is actually shown rather than discarded.
4. **Distinguish "never probed" from "degraded"** in `buildApiHealth`: an internal API with zero samples is `degraded` with an explicit `lastError` of "No heartbeat recorded yet — awaiting first health sweep", so the card explains itself instead of showing a bare badge. Status logic otherwise unchanged; degraded still means >20% failures in 24 h, down still means the latest probe failed.
5. **Run one sweep immediately** after the changes and verify each internal API reports Operational with a real latency and heartbeat, reading back `api_health_checks` from the database to confirm.

External providers stay `Not configured` until credentials are entered — no change to that behaviour.

## Technical notes

- Files touched: `src/lib/system/integrations.server.ts` (sweep gating, key mapping, no-heartbeat message), plus one migration creating the cron job.
- No change to `probes.server.ts` probe logic — the probes are correct.
- No UI restructuring; the API Status card may gain the explanatory "awaiting first sweep" line it already has a slot for (`lastError`).
