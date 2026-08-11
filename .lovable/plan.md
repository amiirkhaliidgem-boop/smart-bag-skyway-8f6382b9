# UAT Fix — Lost & Found / PIR / Delivery Integration

Seven targeted, production-safe fixes. No UI redesign, no new status source, no second SLA calculation.

## 1. International passenger phone numbers

Today `src/lib/phone/egypt.ts` is the single validator and it rejects anything that is not an 11-digit Egyptian mobile. It is used by the PIR Wizard, the bulk import validator and the Twilio adapter.

- Add `libphonenumber-js` and a new `src/lib/phone/intl.ts` as the single source of truth: parse with a selected country, validate as a real number, and return canonical **E.164**.
- Keep the two existing Mobile Number fields in the wizard; add a compact country-code selector in front of each input (default Egypt) and a country-specific example under the field. No other layout change.
- Store E.164 (`+201012345678`, `+447911123456`) in `baggage_cases.contact_mobile` / `contact_mobile_alt`, so the delivery record, passenger view and notification queue all carry one canonical format.
- Bulk import: the `egMobile` field type becomes an international type — accepts a bare Egyptian local number (assumed EG) or any `+…` international number, normalising to E.164. Template example and helper text updated.
- `egypt.ts` is reduced to an EG-specific helper used by the new module (legacy local-format tolerance kept for existing records).

## 2. Provider adapters

Inspection shows **no SMS or WhatsApp transport is currently enabled** in `public.integrations` — the live code paths are `twilio.server.ts` (env-based) and `configured.server.ts` (Integration Center: Twilio / Infobip / generic REST / WhatsApp Cloud API).

- Application canonical format stays E.164.
- Twilio, Infobip and generic REST adapters send the E.164 value unchanged.
- WhatsApp Cloud API receives the digits-only form it requires (E.164 without `+`), converted at the adapter boundary only.
- The Egypt-specific `toE164Eg` conversion is removed from the adapters; no country assumptions remain in the notification engine. Credentials and secrets untouched.

## 3. Airline — ICAO 3 letters

- PIR Wizard Airline field: uppercase-on-input, validated as exactly 3 alphabetic characters (`ABY`, `ADY`, `RBG`); rejects 2 or 4 characters, digits and symbols. Placeholder updated to an ICAO example.
- Bulk import `airlineCode` field type switches from the 2–3 char IATA rule to the strict 3-letter ICAO rule; the hardcoded IATA "known airline" warning list is dropped, since it would flag valid ICAO codes.
- Storage stays `baggage_cases.airline`. No new column, no IATA conversion.

## 4. Airline propagation (verification, minimal fixes)

The airline already flows from `baggage_cases.airline` into the delivery projection, POD report, exports, incidents and dashboard aggregates. This step is a sweep of each surface (case list/details/edit/history, delivery details, POD, delivery export, dashboard/reports filters) to confirm the ICAO value appears unchanged; only display gaps found during the sweep are filled. No duplication into other tables.

## 5. Region + SLA visible in Delivery Management

`baggage_cases.region_id` already survives handover and `sla_delivery_hours(case)` already resolves the region's hours (falling back to the default region). Nothing surfaces it today.

- One migration extends the existing delivery projection RPC (`ops_core_rows`) with `region_name`, `sla_hours`, `sla_started_at` (the Ready-for-Delivery moment, i.e. the delivery row's creation) and `sla_due_at`, all computed in the database from the existing region/SLA functions.
- `src/lib/ops.mapping.ts` carries these onto the `Delivery` object; the Dispatch Center list adds an SLA column and Delivery Details adds Region / SLA / Due / State.
- The state label (On Track / Due soon / Breached) is pure formatting of the database-supplied `sla_due_at` — no second deadline is computed.

## 6. Driver Portal SLA

The Driver Portal reads the same projected deliveries, so each stop card gains one compact line — `Express · 6h · Due 20:45 · On Track` (bilingual via the existing driver i18n dictionary) — rendered from the same `sla_due_at`. No portal redesign.

## 7. Case Details → Assign Officer

Bulk assignment writes `assigned_officer_id` plus the name through `bulkUpdateCases`; the Case Details dialog writes only a free-text `assignedOfficer` label, so nothing authoritative persists.

- The Case Details dialog is replaced with the same officer picker used by bulk assignment (`useStaffOfficers`) and calls the same store operation with `assignedOfficerId` + `assignedOfficer`. One business operation for both paths — timeline, audit and realtime behaviour follow automatically.

## 8. Report Incident — ON CONFLICT root cause

`qm_raise_incident` ends with `ON CONFLICT (dedupe_key) DO NOTHING`, but the only matching index is **partial**: `quality_incidents_dedupe_uidx … WHERE dedupe_key IS NOT NULL`. Postgres cannot infer a partial index from a bare column target, so every insert — including manual "Report Incident", which passes no dedupe key — fails.

The uniqueness rule is intentional (dedupe applies only when a key is given), so the index stays and the statement is corrected:

```text
ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
```

The function's existing pre-check and post-insert lookup already cover the duplicate path. No data change, no new constraint.

## Technical notes

- New dependency: `libphonenumber-js`. New file `src/lib/phone/intl.ts`.
- Two migrations, both `CREATE OR REPLACE` only: the `qm_raise_incident` conflict-target fix and the SLA fields on the delivery projection RPC. No schema or data changes to existing tables.
- Touched frontend: `pir-wizard.tsx`, `lost-found.$bagId.tsx`, `delivery.index.tsx`, `delivery.$deliveryId.tsx`, `driver-portal.tsx`, `lib/io/registry.ts`, `lib/io/validation.ts`, `lib/ops.mapping.ts`, notification adapters.
- Verification: typecheck, then a live pass — create a PIR with an Egyptian and a UK number plus airline `ABY`, walk it to Ready for Delivery, confirm region/SLA in Dispatch, Details and Driver Portal, assign an officer from Case Details, and raise a Quality Incident end to end. Test data removed afterwards.