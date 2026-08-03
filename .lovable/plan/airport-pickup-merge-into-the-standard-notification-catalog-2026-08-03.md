# Airport Pickup — Merge into the standard notification catalog and all UI

The two pickup events already exist in the database as full bilingual templates for SMS, WhatsApp and Email (verified: 6 rows, all active, using `{{PassengerName}}`, `{{PIR}}`, `{{BagTag}}`, `{{TrackingLink}}`). What's missing is that the Settings UI never lists them, so Operations can't see or edit them — plus a few places that still assume every case follows the Home Delivery path.

## 1. Notification Templates tab — dynamic, no hardcoded catalog

The Event dropdown stops being a hand-written list in code. It is built at runtime from two live sources, merged and de-duplicated:

- every distinct event that already has template rows in the database, and
- every status in the Workflow Engine registry that can notify a passenger.

Labels (English and Arabic) come from the same workflow registry the rest of the system uses, so an event added to the engine in future shows up in Notification Templates automatically, with no code change. Selecting an event with no row yet opens empty bilingual fields and Save creates the row.

That immediately brings in the two pickup events:

- Ready for Airport Pickup — baggage ready for collection at the airport desk
- Passenger Picked Up — passenger has collected the baggage

Everything else about the screen is unchanged: the same channel selector, bilingual bodies plus email subject, variable chips, live preview, enable/disable toggle, and the same Save that writes straight to the database through the existing settings module. Because the Workflow Engine composes bodies from those rows at queue time, an edit applies to the very next message with no redeployment.

## 2. Fallback copy

The in-code template file used only when a database row is missing has no pickup wording. Add English and Arabic SMS/WhatsApp/Email fallbacks for both events so the catalog is complete in every path.

## 3. Workflow Monitor

Pickup cases are currently treated as unfinished forever: "Passenger Picked Up" isn't in the terminal list, so a collected bag keeps counting elapsed time and eventually shows as an SLA breach. The Next Step column also reads from the Home Delivery step list, so a pickup case is told to "Hand over to Delivery".

Fix both: treat Passenger Picked Up as terminal (no SLA clock, no breach), and derive Next Step from the case's own path so a pickup case shows "Passenger Picked Up" and then nothing.

## 4. System-wide pickup consistency pass

No screen may assume a completed case was a Home Delivery. Each surface below is checked against a live pickup case, and anything that drops, mislabels or mis-counts it is fixed in the same pass:

- Lost & Found — list, details, stepper, status filters, bulk actions
- Passenger Portal and public tracking — pickup journey copy, timeline, no OTP card
- Notification Templates and Notification Center — both events listed, previewed and labelled bilingually
- Workflow Monitor — terminal handling and Next Step (section 3)
- Activity Timeline — filter options and detail panes carry both statuses
- Dashboard and Reports — pickup cases counted as completed in funnels and KPIs, not stuck or excluded
- Search and filters — pickup statuses selectable and matchable everywhere status is filterable
- Export and print (Excel, PIR, POD) — pickup status text exported, no "Delivered"-only assumptions
- Audit log — pickup transitions recorded with the correct action labels
- Workflow Engine and APIs/RPCs — pickup path transitions and projections verified end to end
- Mobile layouts — pickup screens verified at small widths

Where a surface already handles pickup correctly this is verification only; where it doesn't, the fix lands with it.

## Technical notes

- `src/lib/settings/types.ts`: replace the static `TEMPLATE_TRIGGERS` array with a builder that merges distinct `trigger_key` values from the loaded `notification_templates` rows with the notifiable statuses in `WORKFLOW_STATUSES`, labelled from `WORKFLOW_LABELS`; `src/routes/settings.tsx` consumes that instead of the constant.
- `src/lib/notifications/templates.ts`: add both triggers to `TEMPLATES` (sms/whatsapp/email, en/ar) as fallback copy.
- `src/routes/workflow-monitor.tsx`: add `PASSENGER_PICKED_UP` to `TERMINAL_STATUSES`; compute `nextStep` from the pickup path (`lfPathStatuses`) instead of `LF_OWNED_STATUSES`.
- Consistency pass touches whichever of the L&F, timeline, dashboard, reports, export and audit modules the checks flag; each fix stays within the existing status registries so there is still one source of truth.
- No migration needed — template rows, enums, `wf_queue_notification` rendering and `wf_portal_base_url` link building are already in place.
- Verify by editing one pickup template in the UI, reading the row back from the database, queueing a pickup notification and confirming the queued body carries the edited wording and an absolute tracking URL on all three channels — then walk one pickup case through every surface in section 4.