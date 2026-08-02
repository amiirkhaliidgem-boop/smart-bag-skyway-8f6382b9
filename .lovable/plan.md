# System Settings End-to-End Integration Plan

## Confirmed diagnosis

- **Passenger contacts bypass System Settings.** The Passenger Portal contact card currently hardcodes the phone, WhatsApp number, email address, and their links in `src/routes/passenger.index.tsx`; it does not call the existing public settings RPC.
- **Public settings are not live.** `getPublicSettings()` exists, but `usePublicSettings()` has a 60-second stale cache and no public invalidation/polling. Its server function also silently substitutes defaults when the database read fails.
- **The database contains the new contact values.** The live `system_settings.contacts` row currently contains the updated call/WhatsApp number, confirming the save path works and the fault is downstream consumption.
- **Notification templates are saved correctly.** All active database templates currently have both English and Arabic bodies. The missing-Arabic message is caused by the event model: the workflow queues only the configured default locale, while Notification Center searches for a separate Arabic event that does not exist. The database currently has 54 English events and 0 Arabic events.
- **Notification metadata is dropped in projection.** `buildActivitySnapshot()` reads the related cases/deliveries, but `mapNotification()` does not attach passenger name or PIR, so the UI shows blanks even though the database joins prove those values exist.
- **Preview grouping is not canonical.** Notification Center pairs rows by delivery/channel/workflow status instead of the persisted `trigger_key`, and legacy rows without a trigger key can be paired incorrectly.
- **Runtime still contains non-production fallbacks.** The notification drainer falls back to a simulated provider when no real provider is configured, and the client notification registry is simulation-backed. Settings and public-settings code also contains fallback/demo values.

## Implementation

### 1. Make public settings a live, strict source of truth

- Keep `system_settings` as the only persisted configuration source and keep public access limited to the existing anon-safe RPC projection.
- Change public settings reads to return explicit database values and a clear unavailable/error state rather than silently substituting demo/default contact values.
- Add lightweight public polling/refetching (aligned with the Passenger Portal’s existing 5-second refresh) and immediate query invalidation after an administrator saves settings.
- Keep authenticated Realtime invalidation for staff screens; ensure public consumers refresh without granting anonymous access to the underlying settings table.

### 2. Wire Passenger Portal contacts to live settings

- Load public settings in the token-scoped Passenger Portal and pass the contact configuration into the existing portal component—no new route or duplicated UI.
- Build `tel:`, `https://wa.me/`, and `mailto:` links solely from the configured values, with safe phone normalization for deep links.
- Preserve the delivery/PIR support message while using the real delivery identifier exposed to the public view.
- Hide any contact tile whose configured value is empty; never substitute the old IAB phone, WhatsApp, or email.
- Ensure a settings save is reflected in an already-open portal within the refresh interval and immediately on focus/refetch.

### 3. Make notification events self-contained bilingual snapshots

- Extend the notification event record to persist the fully rendered English and Arabic subject/body snapshots plus the exact runtime context required by operations: passenger name, PIR/case reference, delivery number, trigger key, channel, recipient, selected delivery language, tracking link, agent, and bag tag.
- Update `wf_queue_notification_key()` to read the active database template at queue time, render both languages from one canonical runtime context, and persist both rendered snapshots. Dispatch only the configured passenger language so passengers do not receive duplicate bilingual messages.
- Add `{{DeliveryID}}` as a supported template variable and make variable validation consistent between Settings and the database renderer.
- Preserve historical message accuracy: later template edits affect only newly queued notifications, while old events continue to display the exact snapshots created at their workflow transition.
- Backfill display metadata for existing events where it can be derived safely from their linked delivery/case; retain their original body rather than rewriting notification history.

### 4. Correct Notification Center projection and preview

- Project passenger name, PIR number, delivery number, canonical trigger key, selected language, and both rendered language snapshots from the database into `NotificationEvent`.
- Group/identify notifications by persisted event identity and `trigger_key`, not approximate workflow-status matching.
- Show English and Arabic from the same event snapshot, along with Passenger Name, PIR Number, Delivery ID, Trigger, Language, recipient, provider state, and timestamps.
- Remove “No Arabic template found” when the event has a valid Arabic snapshot; show an explicit configuration/data error only for genuinely incomplete legacy records.
- Make Notification Center activity refresh when notification rows change, without stale local substitutes.

### 5. Remove simulated and fallback runtime behavior from this flow

- Remove simulated transport fallback from the production notification drainer. A channel without a genuinely configured provider must remain visibly unavailable/failed with an actionable reason and must never be marked sent.
- Route SMS, WhatsApp, and Email through real Integration Center configuration only; add the configured Email transport path so active email templates are operational when email is configured.
- Remove or isolate obsolete client-side static template/provider registries from production execution so database templates and configured integrations are authoritative.
- Remove hardcoded contact configuration, sample runtime values, and silent settings fallbacks from the affected Passenger Portal, settings, workflow-notification, and Notification Center paths.

## Security and database details

- Apply schema/function changes through a Supabase migration only.
- Keep RLS enabled on `system_settings`, `notification_templates`, and `notification_events`; public users continue to receive only the safe RPC projection.
- Keep settings/template writes administrator-only and workflow event writes server/database-controlled.
- Do not expose provider secrets, private case data, or unrestricted settings rows to the public portal.

## End-to-end production validation

1. **Baseline database checks**
   - Confirm saved contacts and templates through their RPCs, verify grants/RLS, and run the Supabase linter.
2. **Passenger Portal live contacts**
   - Open a real token URL, change Call Us/WhatsApp/Email in Settings, save, and verify the open portal updates.
   - Inspect and exercise each generated link; confirm WhatsApp opens the configured normalized number and includes the correct real PIR/delivery context.
   - Clear each field in turn and verify its tile is hidden rather than replaced with a fallback.
3. **Template and workflow test**
   - Save distinctive English and Arabic templates containing every supported runtime variable.
   - Trigger a real workflow transition on a test delivery and verify one event is queued with both fully rendered snapshots and the configured dispatch language.
   - Confirm Passenger Name, PIR, Delivery ID, tracking link, agent, and bag tag match the linked production rows.
4. **Notification Center test**
   - Verify English and Arabic previews, Trigger, Language, Passenger, PIR, and Delivery ID all match the persisted event snapshots.
   - Edit the template again and verify existing history remains unchanged while the next workflow event uses the new content immediately.
5. **Transport truthfulness**
   - With a provider unconfigured, verify no simulated success is possible and the event reports the real configuration failure.
   - For every genuinely configured provider available in this project, drain a test event and verify real provider ID/status, attempt record, latency/heartbeat, and no simulated provider name.
6. **Cross-module and refresh validation**
   - Verify Settings, Passenger Portal, Workflow-generated events, Notification Center, and provider dispatch all reflect the same database configuration across refreshes and separate tabs.
   - Run targeted tests/type checks plus desktop/mobile browser checks, and scan the affected code paths for the removed hardcoded contact numbers, emails, sample rendering, simulated transports, and stale fallback configuration.

## Production-ready acceptance criteria

- Passenger contact links are generated only from current database settings.
- Every new workflow notification uses the latest active database template immediately and stores exact bilingual rendered snapshots.
- Notification Center displays complete, historically accurate runtime data with no inferred pairing.
- No affected path reports a simulated send or substitutes demo/hardcoded/cached configuration.
- All validation steps above pass; any unconfigured external provider is reported honestly rather than treated as Operational.
