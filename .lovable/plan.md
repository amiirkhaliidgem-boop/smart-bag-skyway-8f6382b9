# Customer Feedback — duplicate rows root cause and fix

## Root cause (verified against the database)

The database is clean. There is no duplicate data, no bad JOIN, no double write:

- `passenger_feedback` contains exactly **9 rows**, one per completed delivery
  (`count = 9`, `count(distinct delivery_id) = 9`).
- Each row joins to exactly one delivery (DEL-000001, 3, 4, 5, 6, 7, 8, 9, 10).

The duplication is created **in the Customer Feedback screen only**. That screen
merges two copies of the same 9 records:

1. The operational snapshot already loads `passenger_feedback` into app state
   (`buildSecondarySnapshot`), mapping each record to a human delivery code such
   as `DEL-000009`.
2. The screen then runs a *second* direct query against `passenger_feedback` and
   appends any row it considers "not already known".

The de-duplication check compares the snapshot rows' **delivery code**
(`DEL-000009`) against the raw query's **delivery UUID**
(`bbfbe820-aa67-...`). Those never match, so every record is appended a second
time — as the blank row showing a UUID in the Delivery ID column, with
Passenger and PIR as `—`. Hence 9 records rendering as 18 responses, and KPIs
(Total Responses, Avg Rating, Issue Resolved, Today) counting each record twice.

## The fix

Remove the redundant second read instead of masking rows in the UI:

- Delete the extra `passenger_feedback` query and the merge/"extra rows" branch
  from the feedback dashboard. The snapshot already contains every feedback
  record, correctly joined to its delivery and case.
- Make the snapshot mapping carry the delivery reference explicitly so the
  dashboard resolves PIR, Delivery ID, agent, airline and flight from the
  delivery id rather than guessing via bag id. This also fixes rows where those
  columns showed `—`.
- Key the row list by the feedback record id, and add a defensive de-dup by
  record id in the projection so no future code path can double-count.

Because filters, KPIs, search and the XLSX export all read the same projected
list, correcting the projection corrects totals, average rating, resolved
percentage, filtering and exports in one place.

## Preventing duplicates at the data layer

Add a database uniqueness guarantee so one delivery can never accumulate more
than one feedback record: a unique constraint on `passenger_feedback.delivery_id`
(current data already satisfies it — 9 distinct deliveries for 9 rows). The
passenger submission path is updated to upsert on that key, so a passenger who
submits twice updates their rating instead of creating a second record.

## Validation after the change

- Total Responses shows 9; Avg Rating and Issue Resolved computed from 9 records.
- No row with `—` passenger/PIR and a raw UUID delivery id.
- Every row shows Passenger, PIR, Delivery ID, Agent, Airline, Flight.
- Export Selected produces one line per feedback record.
- Re-submitting feedback for an existing delivery does not add a row.

## Technical notes

- Files: `src/components/feedback/feedback-dashboard.tsx` (remove the remote
  query + merge), `src/lib/ops.server.ts` (include `delivery_id`/`deliveryId`
  and resolved PIR in the feedback projection), `src/lib/ops.mapping.ts`
  (Feedback type field), plus a migration adding the unique index and the
  upsert in the passenger feedback submission RPC.
