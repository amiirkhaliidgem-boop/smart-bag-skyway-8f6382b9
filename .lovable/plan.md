# System Settings — Production Configuration Center

Turn `/settings` from a static form into the live control panel for the ecosystem. Every value moves into PostgreSQL, and the Workflow, Notification and Passenger engines read it from there.

## 1. General

Real, persisted fields: System Name, Company Name, Company Logo (upload), Time Zone, Date Format, Default Language, Distance Unit. Saved values drive the app shell title/logo and all date rendering.

## 2. SLA Management

Two editable areas replace today's fixed workflow timings:

- **Lost & Found SLA** — one number, in hours, measured from "Arrived at Airport" to "Ready for Delivery".
- **Home Delivery SLA** — a table of regions the administrator creates and edits (region name + SLA hours). No fixed region list beyond a first-run set the admin can rename or delete.

Because a delivery must know its region, a **Delivery Region** selector is added to the PIR Wizard and the Schedule dialog, fed from the SLA regions table. Cases without a region fall back to the region marked default.

The SLA breach sweep is rewritten to read these values (today it reads per-stage minute rows in `sla_policies`, and the Workflow Monitor keeps its own `SLA_MINUTES` map in code — both go away). On breach it does, in one transaction: raise the SLA breach incident, mark the workflow row breached, write a timeline event, write an audit event, and surface in Quality Management. Dashboard, Workflow Monitor and Reports all read the same stored values.

## 3. Notification Templates

A Template Manager for SMS, WhatsApp and Email covering the passenger-facing triggers (delivery approved, agent assigned, out for delivery, delivered, failed, returned to airport). Each entry has an English and Arabic body (plus subject for email), a variable reference, and a live preview with sample data.

Message bodies are composed in the database at queue time, so saving a template takes effect on the very next notification — no restart, no cached copy. The TypeScript template file is demoted to a fallback used only when a template row is missing.

## 4. Passenger Portal Contacts

Call Us, WhatsApp and Email become editable settings. The Passenger Portal contact card reads them through the public token RPC, replacing the hardcoded `+20 2 2696 0000` / `support@iab.aero` values.

## 5. Security & Realtime

Only Airport Administrators can write settings (Administration → Manage); other staff read only. The settings tables join the realtime publication and the app subscribes once, so a change propagates to open dashboards, monitors and portals with no manual refresh.

## Technical notes

- New tables: `system_settings` (group key + JSONB payload), `sla_regions`, `notification_templates`; `sla_policies` retired in favour of the two new SLA sources.
- New nullable column `region_id` on `baggage_cases`, FK to `sla_regions`.
- New RPCs: `settings_get_public()` (anon-safe subset for the portal), `settings_get_all()`, `settings_save(group, payload)`, `sla_region_upsert` / `sla_region_delete`, `notif_template_upsert` — every write gated by `has_permission('Administration','Manage')`.
- `qm_sweep_sla()` rewritten around the L&F and region SLAs; `wf_queue_notification()` renders bodies from `notification_templates` with fallback.
- Server layer: `src/lib/settings.functions.ts` extended with authenticated read/write functions; `src/routes/settings.tsx` rebuilt as tabs General / SLA / Templates / Contacts (Languages, OTP and Branding folded into General; demo tabs removed).
- Finish with a typecheck, a database round-trip check that the engines read back exactly what was saved, and a realtime propagation check.