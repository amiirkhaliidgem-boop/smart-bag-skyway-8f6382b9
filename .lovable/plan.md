## Workflow Integrity Remediation Plan

### Confirmed audit findings
- Supabase currently has 13 cases, 12 deliveries, and 12 unique workflow tokens; no orphan deliveries, workflow links, notifications, feedback, or audit records were found.
- `/passenger/$token` currently resolves the token from the global client store instead of using the existing server-side token-scoped reader.
- `PassengerPortal` can silently fall back to the first active delivery when the requested delivery is missing or not in its status filter. This explains one case showing another passenger’s information.
- The public passenger route can initialize the shared staff store, which risks loading unrelated passenger records into the browser.
- Initial workflow records still use predictable `*-demo####` tracking tokens.
- Delivery stages, L&F projections, and legacy delivery status fields are mutable copies of the canonical workflow state, creating synchronization risk.

### 1. Enforce strict passenger identity resolution
- Load `/passenger/$token` through `getPassengerViewByToken` on the server.
- Return only the workflow record, delivery, case, case-linked timeline, case-linked feedback, and allowed notification-derived state for that exact token.
- Never initialize or subscribe the public passenger route to the global staff store.
- Remove all first-record and first-active fallbacks. Invalid, expired, or inconsistent tokens must return the existing not-found state rather than another passenger.
- Keep the Passenger Portal markup, styling, spacing, colors, typography, animations, and layout unchanged.

### 2. Bind all portal fields to the resolved case
- Feed Name, PIR, Bag Tag, Airline, Flight, OTP, status, timeline, and feedback from the one resolved case/delivery/workflow bundle.
- Convert passenger actions—baggage confirmation, incident reporting, call-log creation, and feedback submission—to token-scoped server mutations that resolve the delivery and Case ID again on the server before writing.
- Ensure feedback and incidents always carry the resolved Bag/Case ID and cannot be submitted for another record.

### 3. Make links case-specific and secure
- Standardize all L&F and Delivery “View Passenger Portal,” copy-link, SMS, and WhatsApp paths on `ensurePassengerToken(deliveryId)` and the linked delivery’s workflow token.
- Remove ID-derived and demo URL construction from notification previews and sends.
- Backfill predictable `*-demo####` tokens in the live `app_state` snapshot with cryptographically random per-delivery tokens while preserving the delivery-to-case relationship.
- Ensure token generation remains one-to-one per Delivery ID and never silently rotates an active token.

### 4. Establish workflow status as the only mutable status
- Treat `WorkflowRecord.status` as the canonical operational status.
- Derive Delivery stage, legacy delivery status, Passenger status, and the read-only L&F downstream projection from that workflow status instead of independently mutating each field.
- Keep L&F ownership capped at Ready for Delivery; after handover, Delivery/Driver actions transition only through the Workflow Engine.
- Centralize each transition so one transaction updates the workflow event history and linked projections together.

### 5. Centralize automatic case-linked records
- For each workflow transition, create timeline/history and audit entries with the same Delivery ID and Bag/Case ID.
- Generate and store OTPs only against the linked delivery; verification must resolve through the same workflow/case identity.
- Dispatch automatic SMS/WhatsApp records through the Notification Engine with the exact token URL and linked IDs.
- Ensure feedback submission emits its workflow, timeline, and audit events for the same Case ID.

### 6. Harden shared Supabase persistence
- Prevent unauthenticated passenger pages from reading or subscribing to `public.app_state`; staff persistence remains authenticated and RLS-protected.
- Add conflict-safe version handling so stale tabs cannot overwrite newer workflow changes.
- Normalize hydrated snapshots to repair missing workflow links without reintroducing seed/demo bindings.

### 7. Integrity tests and live verification
- Add tests with at least two passengers proving each token returns only its own Name, PIR, Bag Tag, Flight, OTP, timeline, and feedback.
- Test invalid tokens and inactive/Ready deliveries to confirm there is no fallback to another case.
- Test L&F handover, driver assignment, Out for Delivery, OTP delivery completion, and feedback submission across Workflow, L&F, Dispatch, Driver, Passenger, Timeline, Audit, and Notifications.
- Validate two browser contexts plus refresh/realtime behavior against Supabase and re-run database integrity queries for duplicate tokens, mismatched IDs, orphans, and status divergence.

### Scope control
- No Passenger Portal visual or interaction-design changes.
- No new passenger route and no duplicated portal UI.
- No unrelated module redesign.