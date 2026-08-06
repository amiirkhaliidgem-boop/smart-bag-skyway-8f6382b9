# Lost & Found Bulk Import — Multi Bag Tags, Region & Mobile Validation

## Verification of the current import workflow (done before planning)

- The template and validation come from one schema (`lost-found` in the import registry). Today it has a single **Bag Tag** column, marked unique, and no **Region** column.
- On commit, each accepted row creates exactly one case via the Workflow Engine; only the single bag tag is written to the baggage list. Rows missing optional data are created and flagged **Incomplete**, which renders the yellow "please complete when possible" banner on Case Details (the behaviour in your screenshot).
- Duplicate detection compares one value per unique column, so it cannot yet handle a multi-tag cell.

## Mobile number verification — explicit answers

Checked the Notification Center end to end (queueing in the database, then the SMS/WhatsApp transport):

- **What format is accepted today?** The queue copies the case mobile verbatim into the notification recipient. The SMS/WhatsApp transport only checks a loose pattern (`+`, digits, spaces, brackets, dashes, 6–20 chars). So it *accepts* almost anything, including local `01xxxxxxxxx`.
- **Is it local Egyptian format?** It accepts local format, but does **not** convert it.
- **Is it E.164?** The provider itself requires E.164 (`+20…`). It is not enforced anywhere in our stack.
- **Is `+20` required?** Required by the provider, not required by our validation.
- **Does the Notification Center transform numbers automatically?** **No.** This is the real gap: a case saved as `01012345678` is queued as-is and the provider rejects it — exactly the "import accepts it but SMS cannot be sent" case you want eliminated.
- **Import today?** Phone problems are only a *warning*, and `+20…`, `0020…`, spaces and dashes all pass.

Decision that follows: **store and validate one canonical local format (11 digits, `010/011/012/015`) everywhere**, and have the Notification Center **normalise to `+20XXXXXXXXXX` at send time only**. That guarantees every accepted number is deliverable.

## What will be implemented

### 1. Multiple bag tags per case
- The existing **Bag Tag** column accepts several tags separated by commas (`E5901230,E5901231,E5901232`); spaces around commas are tolerated.
- One row still creates **one** case; all tags are attached to that case as separate baggage items.
- **Number of Bags** is derived from the tag count when blank, and flagged as a warning when it contradicts the tag count.
- Duplicate detection is extended to check **each tag individually** against existing cases and against other rows in the file.

### 2. Region column
- New **Region** column in the template, validated against the active SLA Regions from System Settings (currently Cairo, Giza, Alexandria, Upper Egypt, Express), matched case-insensitively by English or Arabic name.
- Valid region → stored on the case so the Home Delivery SLA applies.
- Blank or unknown region → the row is **not rejected**; the case is created and flagged **Incomplete** with "Region" listed in the pending fields, so the Lost & Found agent sees the yellow completion banner and can fix it from Case Details.

### 3. Mobile validation (one shared rule)
- New shared validator: exactly 11 digits, starting with `010`, `011`, `012`, or `015`.
- Rejected as **errors** (not warnings): `+20…`, `20…`, spaces, dashes, letters, any length other than 11.
- Applied to Mobile 1 (mandatory) and Mobile 2 (optional) in Bulk Import, and to the PIR Wizard / Case Edit forms in Lost & Found so both entry paths agree.
- The Notification Center converts the stored local number to `+20…` immediately before sending and rejects anything that is not a valid Egyptian mobile, so accepted numbers are always SMS-ready.

### 4. Updated template
The downloadable CSV template gains **Region**, updates the **Bag Tag** example to a comma-separated multi-tag value, and uses the local 11-digit mobile examples (e.g. `01012345678`). Template version is bumped.

### 5. Verification
Automated end-to-end run against a scratch CSV covering: valid multi-tag row, unknown region, blank region, `+20` number, 10-digit number, dashed number, duplicate tag within file, duplicate tag against an existing case. Confirms validation results, single-case creation, all bag tags attached, region/SLA assignment, incomplete flag + agent banner, and that every created case's mobile passes the notification pre-send check.

### 6. Cleanup
Every case, delivery, timeline, audit and notification row created during that verification is deleted afterwards, and I will confirm the tables are back to their pre-test counts.

## Technical notes

- Files touched: import registry (schema + apply), field validation, duplicate detection (multi-value unique keys), the phone rule shared with the PIR wizard, and the notification transport (normalisation + strict recipient check).
- Region lookup uses the existing SLA regions already loaded in the settings store; no new table.
- No database migration is expected — bag tags and `region_id` already exist on the case model.