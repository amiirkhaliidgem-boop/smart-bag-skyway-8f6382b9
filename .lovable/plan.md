## Goal

No code changes. Document the two open items as part of a Production Go-Live checklist so they are recorded during this UI/System Review phase and can be actioned later.

## Deliverable

A single new document: `docs/notifications-go-live.md`.

## Contents

**1. Current state**
- Every channel is served by a simulated adapter. Nothing leaves the system today.
- The Workflow Engine is the only producer of notifications; the Notification Center is strictly read-only. Both stay as-is when real providers arrive.

**2. What is already plug-and-play**
- Swapping a provider is a single registration call for that channel; the dispatch pipeline, templates, database fields, and Notification Center are untouched.
- A worked Twilio SMS example showing the adapter shape and the one-line registration.

**3. Adapter contract notes for whoever writes the real adapters**
- `retryable: true` for transport and rate-limit errors, `false` for invalid recipients and rejected templates — this is what drives the 3-attempt exponential backoff.
- `providerId` must carry the provider's own message id (Twilio SID, Meta wamid, SES MessageId) so support can trace a message.
- The event `id` is already supplied as an idempotency key and must be forwarded to the provider.

**4. Open item — sending currently runs in the browser**
- Real provider credentials can never reach the browser, so before go-live the `send()` call must move behind a server function.
- Noted as confined to the adapter seam: the Workflow Engine, dispatch pipeline, templates, schema, and Notification Center are unaffected by that future change.

**5. Open item — Email and Push are wired but not functional**
- No message templates exist for those two channels.
- No recipient source exists — the system never captures a passenger email address or a device token, so no recipient can be resolved.
- Enabling either channel therefore requires a PIR capture field and a schema change, not just an adapter.

**6. Status summary**
- SMS and WhatsApp: complete, adapter-only (after the server hop).
- Email and Push: architecturally registered, blocked on templates plus recipient capture.

## Out of scope

No changes to `store.ts`, the dispatch pipeline, the adapters, the registry, the templates, the database, or any UI.
