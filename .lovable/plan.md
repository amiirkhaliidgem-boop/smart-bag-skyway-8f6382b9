## Scope
Simplify the Lost & Found data model. Wizard (Register + Edit PIR) + Case Details view only. No workflow, notifications, timeline, audit, or delivery changes.

## Changes

### 1. `src/components/lost-found/pir-wizard.tsx` (Passenger + Baggage + Review + Edit)
- **PassengerForm type**: drop `middleName`, `nationality`, `passportNumber`, `ticketNumber`. Keep `firstName`, `lastName`, `pnr`, `mobile`, `mobile2`, `email`.
- Remove the corresponding fields from step 1 UI. Layout: First Name / Last Name / PNR on row 1; Mobile 1 / Mobile 2 / Email on row 2.
- `buildFullName()` reduces to `firstName + lastName`. `splitName()` prefill drops middle-name reconstruction.
- **Baggage step**:
  - Priority Select: replace `["Low","Normal","High","VIP"]` with `["Normal","VIP"]`. Default remains `Normal`. Any legacy `Low`/`High` value coming in from `editCase` is coerced to `Normal` on load.
  - Remove the three toggles (`VIP Passenger`, `Rush Delivery`, `Fragile`) and their state keys (`vipPassenger`, `rushDelivery`, `fragile`).
  - Type input: remove the `Hardshell / Softshell` placeholder, leave placeholder empty.
- **Review step**: remove `Nationality`, `Passport`, the ticket half of `PNR / Ticket` (relabel row to `PNR`), `VIP Passenger`, `Rush Delivery`, `Fragile` rows. Everything else unchanged.
- **submit()**: stop writing the removed passenger keys (`middleName`, `nationality`, `passportNumber`, `ticketNumber`) and removed baggage flags (`vipPassenger`, `rushDelivery`, `fragile`) into `passenger` / `baggage`.

### 2. `src/routes/lost-found.$bagId.tsx` (Case Details)
- Passenger card: remove the `Nationality`, `Passport`, `Ticket` KV rows (~l. 692–695). Keep First/Last/PNR/Email/Mobile.
- Baggage card: remove `Rush` and `Fragile` KV rows (~l. 725–726).
- Header VIP badge: derive `vip` purely from `priority === "VIP"` (drop `c.baggage?.vipPassenger`).
- No other detail-card changes.

### 3. Data model (`src/lib/store.ts`) — non-breaking cleanup
- Narrow `Priority` type to `"Normal" | "VIP"`. Update the seed cases currently using `"High"` / other values → `"Normal"` (and `"VIP"` stays).
- Leave the optional passenger fields (`middleName`, `nationality`, `passportNumber`, `ticketNumber`) and baggage flags (`vipPassenger`, `rushDelivery`, `fragile`) in the interfaces as optional so old persisted records keep loading, but the UI no longer reads or writes them. This avoids a schema migration while enforcing "one form, one model" at every write site.

## Explicitly NOT changing
- CSV importer (`src/lib/io/registry.ts`): keeps its historical field surface so external imports don't break silently. (Say the word if you want it trimmed too.)
- Workflow engine, delivery, notifications, timeline, audit, passenger portal, RLS/RPCs.
- Any UI styling beyond removing the fields listed above.

## Result
Passenger step shows 6 fields (no middle name / nationality / passport / ticket). Baggage step has Priority = Normal|VIP only, no VIP/Rush/Fragile toggles, empty Type placeholder. Review + Case Details reflect the same reduced model. Edit PIR uses the identical form, so every write path shares one data shape.