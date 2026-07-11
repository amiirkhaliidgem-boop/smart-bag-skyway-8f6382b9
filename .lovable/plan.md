# IAB Smart Baggage Ecosystem — Enterprise Architecture Upgrade

Reshape the app around a single **Delivery Workflow Engine** while preserving every existing module and route. No mocks; production-shaped code with clean integration seams for Odoo, SMS/WhatsApp, Maps, OTP, and Auth/RBAC later.

## 1. New core engines (in `src/lib/`)

```text
src/lib/
  workflow/
    statuses.ts        # WORKFLOW_STATUS enum + ordered timeline + labels (EN/AR)
    engine.ts          # transition(), canTransition(), history, side-effects
    mapping.ts         # workflow <-> legacy CaseStatus/DeliveryStatus bridge
  notifications/
    templates.ts       # SMS / WhatsApp / Email / Push templates per status (EN/AR)
    engine.ts          # dispatch(status, record) -> queues NotificationEvent
    channels.ts        # Channel adapter interface (no real providers wired)
  quality/
    categories.ts      # Incident categories + priority matrix
    engine.ts          # createIncident(), auto-trigger hooks
  roles/
    roles.ts           # Role enum + Permission objects (RBAC-ready)
    permissions.ts     # can(role, action, resource)
  passenger/
    tokens.ts          # generate/verify opaque tracking tokens (crypto.randomUUID)
  integrations/
    odoo.ts            # typed client stub + endpoint contracts
    sms.ts whatsapp.ts maps.ts otp.ts   # provider-agnostic interfaces
  audit/
    log.ts             # append-only activity log with actor/role/entity/status
  store.ts             # extended: workflowRecords, notifications, incidents, audit
```

The engine is the **single source of truth**. Legacy `CaseStatus`/`DeliveryStatus` become derived views via `mapping.ts` so existing pages keep working unchanged.

### Workflow statuses (canonical order)
`PIR_CREATED → HOME_DELIVERY_REQUESTED → DELIVERY_APPROVED → DRIVER_ASSIGNED → READY_FOR_COLLECTION → CLAIMED_ON_HAND → OUT_FOR_DELIVERY → DRIVER_ARRIVED → OTP_VERIFIED → DELIVERED → FEEDBACK_SUBMITTED → CLOSED`

Each transition: validates predecessor, stamps `at/actor`, appends audit entry, calls `notifications.dispatch()`, and updates derived legacy state.

## 2. Passenger journey (token-gated, off-sidebar)

- Remove Passenger from sidebar navigation.
- New route `src/routes/passenger.$token.tsx` — resolves token → workflow record (404 on unknown).
- Existing `src/routes/passenger.tsx` becomes an internal "Send tracking link" helper page (staff-only) that generates the SMS/WhatsApp share URL.
- Bilingual EN/AR with a language toggle + `dir="rtl"` when Arabic.
- Sections: Logo, Welcome, Live Status (from engine), Timeline, ETA, Map placeholder (Google Maps seam), PIR, Bag tags, Bag count, OTP entry, Contact.
- **Receive Baggage** button disabled until 3 confirmations checked. Unchecking the anti-bribery clause triggers `quality.engine.createIncident({category: 'Possible Misconduct', priority: 'High'})` immediately.
- On confirm → transition to `DELIVERED` → redirect to `/passenger/$token/feedback`.

## 3. Feedback

- Route `src/routes/passenger.$token.feedback.tsx`.
- 5-star rating + per-question ratings (courtesy, professionalism, time, condition, overall), free comment, Recommend YES/NO.
- Submission transitions record to `FEEDBACK_SUBMITTED` then `CLOSED`.

## 4. Notification engine

- Pure template registry keyed by status; each entry has EN + AR bodies for SMS / WhatsApp / Email / Push.
- `dispatch()` enqueues `NotificationEvent[]` into store (viewable in Contact Center → new "Outbox" tab). No real provider calls.
- Channel adapters expose `send(event)` — currently a no-op logger; swap-in point for Twilio/Meta later.

## 5. Quality engine

- Auto-triggers: bribery flag, low rating (≤2), damaged/missing selection, SLA breach on ETA.
- Incident record: number (QI-####), PIR, passenger, driver, deliveryId, category, priority, description, status (Open/Under Review/Resolved), assignedTo, createdAt.
- Surfaced in Executive Dashboard KPI + existing Reports/Contact Center tabs.

## 6. Role architecture (no auth yet)

- `Role` enum with the 9 roles listed.
- `Permission` = `{ resource, actions[] }`; each role has a permission set.
- `can(role, action, resource)` helper exported for future gating; not enforced at UI yet, but sidebar items carry a `requiredPermission` prop so wiring RBAC later is a one-line change.

## 7. Enterprise foundation

Integration folders scaffolded with typed contracts and README-style comments. `.env` names documented (no secrets). Audit log records every workflow transition + incident + notification dispatch.

## 8. UI / preservation rules

- Keep IAB logo, palette, typography, and shell layout untouched.
- All existing routes remain (`/`, `/lost-found`, `/storage`, `/qr-scan`, `/delivery`, `/driver-portal`, `/route-tracking`, `/tracking`, `/contact-center`, `/feedback`, `/reports`).
- Executive Dashboard gains a "Workflow Funnel" widget + Quality Incident KPI.
- Contact Center gains a "Notification Outbox" tab.
- Sidebar: remove Passenger link, add nothing else.

## Files to add
- `src/lib/workflow/{statuses,engine,mapping}.ts`
- `src/lib/notifications/{templates,engine,channels}.ts`
- `src/lib/quality/{categories,engine}.ts`
- `src/lib/roles/{roles,permissions}.ts`
- `src/lib/passenger/tokens.ts`
- `src/lib/integrations/{odoo,sms,whatsapp,maps,otp}.ts`
- `src/lib/audit/log.ts`
- `src/routes/passenger.$token.tsx`
- `src/routes/passenger.$token.feedback.tsx`

## Files to edit
- `src/lib/store.ts` — add workflowRecords, notifications, incidents, audit arrays; wire actions through engines.
- `src/components/app-shell.tsx` — remove Passenger from sidebar.
- `src/routes/passenger.tsx` — convert to internal "Send tracking link" tool.
- `src/routes/index.tsx` — Workflow Funnel + Quality KPI widgets.
- `src/routes/contact-center.tsx` — Notification Outbox tab.
- `src/routes/delivery.tsx`, `driver-portal.tsx`, `route-tracking.tsx` — call `workflow.engine.transition()` instead of ad-hoc status writes.

## Out of scope for this phase
Real SMS/WhatsApp/Email delivery, live Google Maps, Odoo sync, authentication (roles are structural only), persistence beyond localStorage.

## Assumptions
- LocalStorage remains the transport until Lovable Cloud is enabled.
- Tokens are opaque UUIDs stored on each workflow record; no expiration yet.
- Existing legacy `Delivery`/`BaggageCase` shapes stay; the workflow record wraps them by `deliveryId`.
- Arabic copy uses professional aviation terminology; RTL applied at the passenger portal only.

Approve and I'll implement in one pass, keeping every existing page working.