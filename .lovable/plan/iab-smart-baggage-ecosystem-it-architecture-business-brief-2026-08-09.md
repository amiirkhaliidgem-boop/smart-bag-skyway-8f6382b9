# IAB Smart Baggage Ecosystem — IT Architecture & Business Brief

Documentation only. No code, database, configuration, Realtime, or production data will be changed.

## Deliverable

One markdown document, `docs/it-architecture-brief.md`, written for the IT/infrastructure team, containing all 18 requested sections in order:

1. Business overview
2. Business model (core vs supporting vs reporting functions)
3. System modules (purpose, users, functions, data, dependencies, authenticated vs public)
4. End-to-end architecture by layer
5. Database architecture and the Case → Bag → Delivery → Driver → Passenger → Notification → Timeline/Audit flow
6. Authentication & authorization
7. Workflow Engine (single source of truth, transitions, locking, versioning, conflicts)
8. Realtime architecture (current shared-hub state)
9. Notification architecture (queue, OTP, transports, retries, workers)
10. Hosting & deployment requirements — split "Required for production" vs "Recommended"
11. Environments (dev / preview / production) and scheduled-job URL risk
12. Performance & capacity — verified vs expected vs roadmap
13. Security
14. Backup / recovery / monitoring — only what actually exists
15. External dependencies table
16. Text architecture diagram
17. Critical IT questions checklist
18. Executive summary with GO / CONDITIONAL GO / NO-GO

Every claim will be sourced from the codebase or a read-only database query. Anything not verifiable will be tagged **UNVERIFIED** inline. No invented CPU/RAM/storage numbers — sizing will be stated as requiring capacity testing or provider sizing.

## Evidence gathering (read-only)

Code reads: all route files under `src/routes`, `src/lib/store.ts`, `src/lib/realtime.ts`, `src/lib/rbac.ts`, `src/lib/permissions.tsx`, `src/lib/workflow/*`, `src/lib/notifications/*`, `src/lib/phone/egypt.ts`, `src/lib/settings/*`, all `*.functions.ts` / `*.server.ts`, `src/routes/api/public/*`, `src/start.ts`, `src/router.tsx`, `vite.config.ts`, environment variable names only (no secret values), `package.json`, and the existing reports in `docs/`.

Read-only database queries (SELECT only): table/column/foreign-key inventory, index list, RLS policy list, security-definer function list, trigger list, `cron.job` schedule list, and integration rows with secret columns excluded.

## Notes

- Secret values are never printed — only variable names and where they must be set.
- `docs/concurrency-capacity-report.md`, `docs/production-readiness.md`, and `docs/notifications-go-live.md` will be cited as the source of verified performance and go-live findings rather than restated as new measurements.
- The only file created is `docs/it-architecture-brief.md`.