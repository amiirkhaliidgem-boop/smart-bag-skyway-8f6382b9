# Airport Pickup — Merge into the standard notification catalog and all UI

The two pickup events already exist in the database as full bilingual templates for SMS, WhatsApp and Email (verified: 6 rows, all active, using `{{PassengerName}}`, `{{PIR}}`, `{{BagTag}}`, `{{TrackingLink}}`). What's missing is that the Settings UI never lists them, so Operations can't see or edit them — plus a few places that still assume every case follows the Home Delivery path.

## 1. Notification Templates tab

Add the two events to the catalog the Event dropdown is built from, positioned with the rest of the lifecycle:

- Ready for Airport Pickup — baggage ready for collection at the airport desk
- Passenger Picked Up — passenger has collected the baggage

Nothing else changes: the same channel selector, the same bilingual English/Arabic bodies plus email subject, the same variable chips, the same live preview, the same enable/disable toggle, and the same Save that writes straight to the database through the existing settings module. Because the Workflow Engine composes message bodies from those rows at queue time, an edit applies to the very next message with no redeployment.

## 2. Fallback copy

The in-code template file used only when a database row is missing has no pickup wording. Add English and Arabic SMS/WhatsApp/Email fallbacks for both events so the catalog is complete in every path.

## 3. Workflow Monitor

Pickup cases are currently treated as unfinished forever: "Passenger Picked Up" isn't in the terminal list, so a collected bag keeps counting elapsed time and eventually shows as an SLA breach. The Next Step column also reads from the Home Delivery step list, so a pickup case is told to "Hand over to Delivery".

Fix both: treat Passenger Picked Up as terminal (no SLA clock, no breach), and derive Next Step from the case's own path so a pickup case shows "Passenger Picked Up" and then nothing.

## 4. Notification Center, Activity Timeline, Dashboard

These already resolve pickup labels from the shared workflow registry, so the pass here is verification rather than rework: confirm both events render with correct English/Arabic labels in Notification Center previews and in the Timeline filter and detail panes, and that pickup cases are counted in the dashboard funnel and Reports rather than dropped.

## Technical notes

- `src/lib/settings/types.ts`: add `READY_FOR_AIRPORT_PICKUP` and `PASSENGER_PICKED_UP` to `TEMPLATE_TRIGGERS`.
- `src/lib/notifications/templates.ts`: add both triggers to `TEMPLATES` (sms/whatsapp/email, en/ar) as fallback copy.
- `src/routes/workflow-monitor.tsx`: add `PASSENGER_PICKED_UP` to `TERMINAL_STATUSES`; compute `nextStep` from the pickup path (`lfPathStatuses`) instead of `LF_OWNED_STATUSES`.
- No migration needed — template rows, enums, `wf_queue_notification` rendering and `wf_portal_base_url` link building are already in place.
- Verify by editing one pickup template in the UI, reading the row back from the database, queueing a pickup notification and confirming the queued body carries the edited wording and an absolute tracking URL on all three channels.