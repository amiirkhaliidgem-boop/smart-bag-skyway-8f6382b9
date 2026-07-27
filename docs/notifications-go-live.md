# Notifications — Production Go-Live Checklist

Status: **review phase**. Every channel is simulated. No code changes have been
made for this document; it records what must happen before real messages are
sent to passengers.

---

## 1. Current state

- All four channels (`sms`, `whatsapp`, `email`, `push`) are served by
  simulated adapters in `src/lib/notifications/adapters/simulated.ts`.
  Nothing leaves the system today.
- The **Workflow Engine is the only producer** of notifications. Nothing
  outside `enqueueNotifications` in `src/lib/store.ts` may create a
  `NotificationEvent`.
- The **Notification Center is strictly read-only**. There is no manual send,
  resend, or test path anywhere in the UI.
- Both of the above stay exactly as they are when real providers arrive.

---

## 2. What is already plug-and-play

Swapping a provider for a channel is a single registration call. The dispatch
pipeline, the templates, the database fields, and the Notification Center are
untouched.

```ts
// src/lib/notifications/adapters/twilio.ts
import type { NotificationChannelAdapter } from "../channels";

export const twilioSmsAdapter: NotificationChannelAdapter = {
  channel: "sms",
  name: "twilio",
  simulated: false,
  validateRecipient: (to) =>
    /^\+[1-9]\d{7,14}$/.test(to.trim())
      ? { ok: true }
      : { ok: false, error: "Recipient must be E.164" },
  async send(event) {
    const res = await fetch(TWILIO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        To: event.to,
        From: TWILIO_FROM,
        Body: event.message.body,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: json.message ?? `Twilio error ${res.status}`,
        retryable: res.status === 429 || res.status >= 500,
      };
    }
    return { ok: true, providerId: json.sid };
  },
};
```

```ts
// registered once, at boot
registerProvider("sms", twilioSmsAdapter);
```

That is the entire go-live change for a channel.

---

## 3. Adapter contract notes

For whoever writes the real adapters:

- **`retryable`** drives the engine's 3-attempt exponential backoff.
  - `true` — transport failures, timeouts, `429` rate limits, provider `5xx`.
  - `false` — invalid recipient, rejected or unapproved template, blocked
    number, insufficient balance. Retrying these only burns attempts.
- **`providerId`** must carry the provider's own message id — Twilio `sid`,
  Meta `wamid`, SES `MessageId`, FCM message name. It is surfaced in the
  Notification Center so support can trace a single message with the provider.
- **The event `id` is already supplied as an idempotency key** on every
  `OutboundEvent` and must be forwarded to the provider (Twilio
  `Idempotency-Key` header, Meta client message id, etc.). Without it a retry
  after an ambiguous timeout can double-send to the passenger.
- **`simulated` must be set to `false`** on real adapters. The monitor reads it.
- Never throw for an expected provider failure — return a `SendResult`. Thrown
  errors are treated as retryable transport faults.

---

## 4. Open item — sending currently runs in the browser

`dispatchEvents` is invoked from `src/lib/store.ts` in the client, so the
adapter's `send()` executes in the browser. Simulated adapters are fine there,
but **real provider credentials can never reach the browser**.

Before go-live, the `send()` call must move behind a server function: the
client-side adapter becomes a thin transport that calls the server, and the
real provider adapter plus its secret live server-side.

This change is confined to the adapter seam. Unaffected:

| Component | Change required |
| --- | --- |
| Workflow Engine | none |
| Dispatch pipeline (attempts, backoff, de-dup) | none |
| Templates | none |
| Database schema / event fields | none |
| Notification Center | none |

---

## 5. Open item — Email and Push are wired but not functional

Both channels are registered in the provider registry with `enabled: false`, so
no engine change is needed to turn them on. Two things are genuinely missing:

1. **No message templates.** `renderTemplate` returns nothing for `email` and
   `push`; bilingual (EN/AR) bodies must be authored for every trigger.
2. **No recipient source.** The system never captures a passenger email address
   or a device token, so `resolveRecipient` returns `undefined` and the event
   is skipped before it is ever queued.

Enabling either channel therefore requires a **PIR capture field and a schema
change**, not just an adapter.

---

## 6. Status summary

| Channel | Templates | Recipient | Provider | Go-live work |
| --- | --- | --- | --- | --- |
| SMS | ready (EN/AR) | passenger mobile | simulated | adapter only, after the server hop |
| WhatsApp | ready (EN/AR) | passenger mobile | simulated | adapter only, after the server hop; templates need provider approval |
| Email | **missing** | **missing** | simulated, disabled | templates + capture field + adapter |
| Push | **missing** | **missing** | simulated, disabled | templates + device token capture + adapter |

---

## 7. Pre-launch checklist

- [ ] Move `send()` behind a server function; store provider credentials as secrets.
- [ ] Write and register the real SMS adapter; verify `providerId` and idempotency passthrough.
- [ ] Write and register the real WhatsApp adapter; get message templates approved by the provider.
- [ ] Confirm error classification against real provider error codes (which are retryable).
- [ ] Verify the Notification Center shows provider, provider message id, attempts, and failure reason for live sends.
- [ ] Confirm the Notification Center remains read-only — no manual send path may be reintroduced.
- [ ] Decide whether Email/Push are in scope; if so, author templates and add recipient capture to the PIR.