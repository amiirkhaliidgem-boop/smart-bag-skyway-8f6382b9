# Passenger Tracking — production validation result

I ran the validation against the live database and code. **The flow is not production-ready yet.** Three blockers were found; the token architecture itself checks out.

## What passes

- **One token per journey (as stored today).** No case in `passenger_links` has more than one token — verified by query. Airport Pickup uses a case-level link; Home Delivery uses a delivery-level link.
- **Same token everywhere.** SMS, WhatsApp, Email, Notification Center, Communication tab and View Passenger Portal all read the identical `passenger_links.token`; nothing mints a second one.
- **Portal reads live production data only.** `/passenger/{token}` calls the `passenger_get_view` RPC on the production database on every load and polls every 5s until a terminal stage. No mock, demo, cached or hardcoded passenger data, and no localhost or preview domain anywhere in the portal path.

## Blocker 1 — tracking links in messages have no domain

The queue functions build the link as `portal_base_url || '/passenger/' || token`, but `portal_base_url` is absent from the stored `general` settings and is not editable anywhere in the UI. Every queued message therefore contains a **relative** link:

```text
... is ready for collection ... Track: /passenger/cefb0eaca15a470083eab51de5a611a6
```

A passenger receiving that on SMS or WhatsApp cannot open it. This fails the "copy the link from SMS and open it in a clean session" test outright.

Fix:
1. Add **Public Portal Address** to System Settings → General (stored at `system_settings.general.portal_base_url`), validated as an absolute `https://` origin with no trailing slash.
2. Set it to the production domain.
3. Re-render the link on still-queued events so nothing goes out relative.

## Blocker 2 — nothing is actually being sent

All 70 notification events are in state `queued` and `notification_attempts` is empty. The Integration Center shows `sms_gateway`, `whatsapp` and `email` as `not_configured` and disabled, so there is no live transport and the drain has never recorded an attempt.

Fix: enter production SMS/WhatsApp/Email credentials in the Integration Center, then confirm the drain records real attempts with a real provider name and provider message id. Until then, "copy the link from the SMS you received" cannot be executed, because no message is delivered.

## Blocker 3 — simulated fallback is still reachable in the send path

`src/lib/notifications/registry.ts` defaults every channel to `simulatedAdapters`, and the configured adapter falls back to them when the Integration Center has no credentials. In production that silently marks messages "sent" that were never transmitted.

Fix: make the fallback explicit — with no configured adapter for a channel, the send must **fail with "channel not configured"** instead of succeeding through a simulated adapter. Keep simulated adapters for local development only, behind an explicit non-production flag.

## Second-order risk to close at the same time

A Home Delivery case that receives an L&F-stage notification gets a **case-level** token; later, at handover, `wf_ensure_passenger_link` mints a **second, delivery-level** token for the same journey. No case is in that state today, but the sequence is reachable and would break the one-token guarantee. Fix by having the delivery-link function reuse the existing case-level row (setting its `delivery_id`) instead of inserting a new one.

Also, the delivery-side queue function only looks a token up; it never ensures one, so a missing link row sends an empty `Track:` value. It should call `wf_ensure_passenger_link`.

## Technical changes

- Migration: `wf_ensure_passenger_link` reuses the case-level row instead of inserting; `wf_queue_notification_key` ensures the link rather than a bare select; both queue functions surface a clear error when `portal_base_url` is empty.
- `src/lib/settings/types.ts`, `src/routes/settings.tsx`: `portal_base_url` field with absolute-URL validation.
- `src/lib/notifications/registry.ts` and `adapters/configured.server.ts`: no simulated fallback in production.
- One-off SQL to re-render `TrackingLink` on still-queued events after the base URL is set.

## Then re-run the end-to-end validation

With the blockers fixed, run both journeys and confirm identical status and timeline across Lost & Found, Passenger Portal, Notification Center, Activity Timeline, Workflow Monitor, Dashboard and Reports:

- Home Delivery: L&F → Delivery Management → Driver Portal → OTP → Delivered.
- Airport Pickup: L&F → Ready for Airport Pickup → Passenger Picked Up.

For each, copy the link out of the delivered SMS, WhatsApp and Email, open it in a private window, and check passenger, PIR, current status, timeline and automatic refresh after the next transition.