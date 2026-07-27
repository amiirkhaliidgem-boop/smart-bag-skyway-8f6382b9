## Goal

Produce a single, shareable **Deployment & Hosting Technical Handover** document for the IAB Smart Baggage Ecosystem. No code changes, no system amendments — documentation only.

## Deliverable

One document written for an external hosting provider, delivered as a downloadable file (Word `.docx`, plus a Markdown copy), covering all 11 requested sections.

## What the document will contain

1. **System Architecture** — TanStack Start (React 19 + SSR) frontend, server functions as the backend layer, Supabase Postgres as the database, Supabase Auth (single unified login, username/employee-ID/email identity resolution), a single global app-state document in `app_state` synced via Supabase Realtime as the state layer, plus how the Workflow, Notification, Audit and Timeline engines are wired to that single source of truth.
2. **Technology Stack** — exact versions from `package.json`: React 19.2, TanStack Start 1.167 / Router 1.168 / Query 5.83, Vite 8, TypeScript 5.8, Tailwind CSS 4.2, Supabase JS 2.110, Radix UI + shadcn, Zod 4, framer-motion, recharts, xlsx, date-fns, Nitro (Cloudflare Worker target). Note: **no Zustand** — state is a custom store over Supabase.
3. **Hosting Requirements** — two supported targets: (a) edge/serverless (Cloudflare Workers / Netlify / Vercel, the default Nitro output) and (b) a Node 20+ VPS behind Nginx. CPU/RAM/disk baselines, SSL, reverse-proxy config notes, domain/DNS needs, and backup expectations.
4. **Deployment Requirements** — `bun install` / `npm ci`, `npm run build`, the Nitro output layout, required env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, server-side `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_SERVICE_ROLE_KEY`), which are public vs secret, and config files (`vite.config.ts`, `supabase/config.toml`).
5. **Database Requirements** — full table inventory (`app_state`, `app_users`, `app_roles`, `role_permissions`, `user_role_assignments`, `user_roles`, `admin_audit_log`, `passenger_links`, `passenger_feedback`, `delivery_public_view`), the security-definer RPCs powering the public Passenger Portal, RLS posture, grants, no storage buckets currently in use, and a PITR/daily-dump backup strategy.
6. **External Services** — status table: SMS (simulated adapter), WhatsApp (simulated adapter), Email (registered, disabled, no templates/recipients), Push (same), Maps/Navigation (Google Maps deep links, live), OTP (generated in-app, delivered via the notification engine), Odoo (stub), File Storage (not used).
7. **Production Checklist** — env vars, DNS, SSL, production Supabase project, backups, monitoring, logging, error reporting, security review, performance budget.
8. **Scalability** — realistic concurrency expectations, the known constraint that global state lives in one `app_state` row (write contention is the first ceiling), Supabase connection/compute scaling, and CDN/edge scaling.
9. **Security** — Supabase Auth, RBAC via `user_roles` + permission matrix and `has_role`/`has_permission`, HTTPS/HSTS, secret handling (service role key is server-only), RLS, and public-endpoint hardening for `/passenger/*`.
10. **Recommended Production Architecture** — recommended path (managed edge hosting + managed Supabase) with a VPS+Docker alternative, CI/CD outline, and monitoring tooling suggestions.
11. **Future Backend Requirements** — clearly split into Implemented / Partially implemented / Planned / Not implemented, calling out the two real gaps: notification `send()` must move behind a server function before real providers are added, and Email/Push need templates plus a recipient-capture field.

Closing section: **what your side must do before hosting** — provision a production Supabase project, decide the hosting target and domain, obtain SMS/WhatsApp provider accounts, and confirm data-retention/backup policy.

## Notes

- Content is derived from the actual codebase and live Supabase schema, not assumptions; the notification go-live status reuses the existing `docs/notifications-go-live.md` findings.
- Nothing in the application is modified.
