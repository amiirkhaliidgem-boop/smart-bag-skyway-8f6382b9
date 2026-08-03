# Lost & Found — View Passenger Portal action

## What staff will get

On the Lost & Found Case Details screen, a **View Passenger Portal** action (in the
header Quick Actions menu, plus the existing Communication tab link) that opens
`/passenger/{token}` in a new tab — the exact public portal the passenger receives,
with no separate preview page and no demo data.

It works for both paths:
- Home Delivery — opens the delivery journey portal.
- Airport Pickup — opens the pickup journey portal (no delivery record needed).

When a case has no passenger link yet (early statuses before the link is issued),
the action is shown disabled with a short explanation instead of being hidden.

## The gap to close

Passenger links live in `passenger_links`, which carries both `case_id` and a
nullable `delivery_id`. The operational snapshot currently maps tokens only by
`delivery_id`, so Airport Pickup cases — which have a case-level link and no
delivery — expose no token to the app. That is why the Communication tab on the
pickup case in the screenshot says "Tracking link is generated once a delivery is
created", even though the queued SMS/WhatsApp already contain
`/passenger/f978eb45…`.

## Changes

1. `src/lib/ops.server.ts` — alongside the existing `tokenByDelivery` map, build a
   `tokenByCase` map from the same `passenger_links` rows (newest non-revoked link
   per case) and return it in the core snapshot.
2. `src/lib/store.ts` — carry `caseTokens` (bag id -> token) in state and add a
   `getCaseToken(bagId)` read helper; no new fetching, no new state source.
3. `src/routes/lost-found.$bagId.tsx` —
   - resolve the token as: the delivery workflow token when one exists, otherwise
     the case-level token;
   - add **View Passenger Portal** to the header Quick Actions dropdown, opening
     `/passenger/{token}` in a new tab;
   - make the Communication tab's Tracking Link card use the same resolved token so
     pickup cases show their real link, and keep the OTP row delivery-only.

No route, schema, workflow-engine, notification or portal changes — the portal reads
live state through `passenger_get_view`, so it always reflects the Workflow Engine.

## Validation

Open the portal from one Home Delivery case and one Airport Pickup case and confirm
against the internal screens: passenger name, PIR, current status, timeline order,
the notification text queued in the Communication tab, and that the URL token is
identical to the link inside the sent SMS/WhatsApp. Then advance each case one step
and confirm the open portal tab reflects the new state on its next poll.