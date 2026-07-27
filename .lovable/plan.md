## Goal

Turn `/timeline` into the live operational history of the whole ecosystem: every event derived from real records only, simplified filters, and a full detail view. Presentation/integration only — no engine changes.

## Current state (verified)

`src/routes/timeline.tsx` already reads live store slices (`cases`, `deliveries`, `workflow`, `notifications`, `feedback`, `qualityIncidents`, `audit`) — so the page is not wholly demo. But `buildEvents()` fabricates events that no engine ever produced:

- `EV-STORE-*` / `EV-QR-*` — "Bag Registered in Storage" and "QR Code Generated", invented from `case.createdAt` whenever `storage` is non-null.
- `EV-LOCATED-*` — "Bag Located ... at Cairo International Airport" (also violates the neutral-terminology rule already applied elsewhere).
- `EV-QRSCAN-*` — "QR Code Scanned", timestamped from an unrelated workflow history entry.
- `EV-OTPGEN-*` — "OTP Generated", timestamped from `history[0]` rather than any real OTP timestamp.

Two real sources are also missing: `callLogs` (Contact Center / passenger-portal misconduct callbacks) and `ioAudit` (import/export events), plus `case.lfHistory` (L&F status transitions) is never read — L&F transitions only appear if a delivery record exists.

## Changes (all in `src/routes/timeline.tsx`)

### 1. Event sources — real records only

Remove the four synthesized generators above. Rebuild the event set from:

| Source | Store slice | Timestamp |
|---|---|---|
| PIR created | `cases[].createdAt` | createdAt |
| L&F status transitions | `cases[].lfHistory[]` | entry `at` |
| Workflow transitions (incl. OTP verified, delivered) | `workflow[].history[]` | entry `at` |
| Delivery lifecycle milestones | `deliveries[].acceptedAt / collectedAt / deliveredAt` (only when present) | that field |
| Delivery internal notes | `deliveries[].notes[]` | note `at` |
| Notifications | `notifications[]` | createdAt |
| Contact Center calls | `callLogs[]` | at |
| Passenger feedback | `feedback[]` | at |
| Quality incidents | `qualityIncidents[]` | at |
| Audit entries | `audit[]` (skip the two already surfaced) | at |
| Import/Export audit | `ioAudit[]` | at |

Everything merged, de-duplicated by id, sorted newest-first. Module attribution: L&F, Delivery, Delivery Agent, Passenger, Workflow, Notifications, Feedback, Quality, Contact Center, Audit, Storage. Storage events only surface if a real storage record/transition exists — no fabrication.

Each event carries: timestamp, type/title, module, passenger, PIR, delivery ID, bag ID, workflow status, responsible employee/delivery agent, and description — all read from the source record, no placeholder strings.

### 2. Filters

Remove: **Delivery ID**, **PIR Number**, **Passenger** selects (and their state + reset lines).

Keep: **Search**, **Module**, **Workflow Status**, **Delivery Agent**, **Date Range**. Keep **Employee** only if you want it — see question below; the request lists it under neither keep nor remove.

Search becomes the universal reference lookup: matches title, description, actor/agent, passenger, PIR, delivery ID, bag ID, bag tag, and passenger tracking token, case-insensitively.

Date range switches to the shared `DateRangeFilter` component used by L&F / Delivery / Feedback for consistency.

### 3. Detail panel

Selecting an event shows the full field set (timestamp, type, module, passenger, PIR, delivery ID, workflow status, responsible person, description) plus related notifications, feedback, quality incidents, and audit entries, as today. Add the raw source record fields relevant to the event type (e.g. notification provider/attempts, call direction/duration, incident severity/status).

### 4. Untouched

`src/lib/store.ts`, workflow, notification, delivery, audit engines and all templates. No schema changes, no new routes.

## Technical notes

- Event ids stay deterministic and source-derived (`EV-LFH-<bagId>-<i>`, `EV-CALL-<id>`, …) so selection survives re-renders and realtime updates.
- Since the store already re-renders on Supabase realtime pushes, the timeline updates live with no extra polling.
- The 200-row render cap stays, with the "refine filters" hint.
