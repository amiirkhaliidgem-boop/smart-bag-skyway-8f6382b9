## Scope
Lost & Found → Case Details → Quick Actions menu only. No other files, modules, or behavior touched.

## Changes (single file: `src/routes/lost-found.$bagId.tsx`)

1. Remove three menu items from the Quick Actions dropdown (lines 305–313):
   - Notify Passenger
   - Generate Tracking Link
   - Copy Tracking Link

2. Delete the now-unused handlers:
   - `notifyPassenger` (l. 175–187)
   - `generateTrackingLink` (l. 168–174)
   - `copyTrackingLink` (l. 160–167)
   - Also drop the `token` / `trackingUrl` locals (l. 157–158) that only these handlers used, if no other reference remains.

3. Clean up now-unused imports: `Bell`, `Link as LinkIcon`, `Copy`, `ensurePassengerToken`, `createTestNotification` — only remove each if it has no other usage in the file.

## Result
Quick Actions menu contains: Edit PIR, Assign Officer, (separator), Print PIR, Export Case. Nothing else in the case details page, workflow, notifications, delivery, or passenger portal is touched.