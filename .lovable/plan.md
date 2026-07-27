# Notification Architecture — Go Live Readiness (Simulated Providers)

Goal: the Notification Center and Workflow Engine behave exactly as they will in production. Swapping in real SMS/WhatsApp/Email providers later must mean writing one adapter file and registering it — nothing else changes.

## Current state (verified)

- `src/lib/store.ts` is the only producer of notification events (`enqueueNotifications`), triggered by the Workflow Engine. Correct already.
- `dispatchQueued` calls `defaultAdapters[channel]` from `src/lib/notifications/channels.ts` — but the adapter map is imported directly by the engine, so there is no swap point, no configuration, and no provider selection.
- Adapters are `async send() { return { ok: true } }` — no latency, never fail, never return a provider ID.
- Events carry no delivery metadata: no `providerId`, no `attempts`, no `error`, no `provider`.
- No retry/backoff. A failed event stays failed forever with no reason recorded.
- IDs are generated as `NTF-${notifications.length + n}`, which can collide after deletions or concurrent tabs.
- Recipients are always `delivery.mobile`, so an Email or Push adapter would have nowhere to send. Email/Push also have no templates.
- `dispatchQueued` uses `setTimeout` in the active tab only. Events queued when no tab is open stay `queued` forever — a real provider worker would pick them up.

## What gets built

### 1. Provider registry — the single swap point

New `src/lib/notifications/registry.ts`:

- `ProviderConfig` per channel: `{ channel, adapter, enabled, simulate }`.
- `registerProvider(channel, adapter)` and `getProvider(channel)`.
- Boots with the simulated adapters. Going live = one `registerProvider("sms", twilioSmsAdapter)` call in the registry bootstrap file. No engine edits.

### 2. Harden the adapter contract

Extend `NotificationChannelAdapter` in `src/lib/notifications/channels.ts` so a real provider can implement it without a shape change:

- `send(event)` returns `{ ok, providerId?, error?, retryable? }`.
- Add `name` (e.g. `"simulated-sms"`, later `"twilio"`) so the UI and audit can show which provider handled an event.
- Add optional `validateRecipient(to)` so a bad address fails fast with a real reason.

### 3. Realistic simulated adapters

New `src/lib/notifications/adapters/simulated.ts`, one per channel:

- Emulates network latency (300–1200 ms), returns a synthetic `providerId` (`sim_sms_<uuid>`), and fails a configurable small percentage of sends with a retryable error so the retry path is genuinely exercised.
- Failure rate lives in one constant, defaulted to 0 for demos and flippable for testing.

### 4. Dispatch pipeline with retry and drain

Inside `src/lib/store.ts`, keeping the engine as the only producer:

- `dispatchQueued` moves to a `dispatch` module that reads the registry instead of importing adapters directly.
- Attempts recorded on the event: `attempts`, `lastAttemptAt`, `providerId`, `provider`, `failureReason`.
- Retry with exponential backoff (3 attempts) for retryable failures; permanent failures stop immediately with a reason.
- A drain pass on app boot picks up any event left in `queued`/`sending` from an earlier session, so the queue is never orphaned — the same behaviour a real provider worker gives.
- Event IDs move to `NTF-<uuid>` to remove the collision risk.

### 5. Recipient resolution

New helper resolving a channel to an address: SMS/WhatsApp → mobile, Email → passenger email, Push → device token. Today Email/Push resolve to nothing, so they are skipped exactly as now — but the moment templates and addresses exist, no engine change is needed.

### 6. Notification Center — same read-only monitor, richer truth

`src/routes/notifications.tsx` stays strictly read-only. It gains, in the existing detail panel only:

- Provider name and provider message ID
- Attempt count and last failure reason for failed events

No new controls, no manual send.

## Explicitly unchanged

- Workflow Engine trigger logic and template registry
- Delivery / Lost & Found / Passenger Portal business logic
- All UI layouts and design; only the detail panel adds read-only fields

## Going live later

1. Write `src/lib/notifications/adapters/twilio.ts` implementing `NotificationChannelAdapter`.
2. Register it in the registry bootstrap.
3. Add the provider credentials as secrets.

Nothing in the engine, the store, the Notification Center, or the templates is touched.
