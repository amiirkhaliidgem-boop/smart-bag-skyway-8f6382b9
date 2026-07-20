
# Public Passenger Portal — Production Architecture

## Goal

Anonymous passengers open an SMS/WhatsApp link and see only their own delivery. No login. No Supabase session. No dependency on `app_state` or the client store. Desktop and mobile behave identically on preview and published. Staff-side Lost & Found, Delivery, and Driver Portal remain fully private.

## Failure the design must eliminate

Today the passenger tab reads staff state — either via the client Zustand store (hydrated from `app_state`, RLS = authenticated) or via a server function that uses `supabaseAdmin` on the same staff blob. Both paths accidentally require staff auth or a service-role runtime. Neither is a legitimate public read path. The design below removes both and replaces them with an anon-safe, token-scoped, minimum-fields read.

## Approach — Dedicated public tables + `SECURITY DEFINER` RPC + narrow anon policies

Chosen over the two alternatives because it is the only option that satisfies every requirement simultaneously:

- A single dedicated table is too coarse and leaks columns unless carefully projected — RPC lets us shape the response.
- An Edge Function alone still needs a query path; without dedicated tables it would either bypass RLS (service role) or read gated staff data.
- RPC over dedicated tables gives: narrow anon policies on tiny tables, server-side expiry/revocation checks, minimum-field projection, no service role anywhere in the passenger path, identical behaviour in preview and published.

## Data model (new, alongside — not replacing — existing schema)

Three small tables in `public`, all with strict RLS and anon grants only where a policy allows it.

- **`passenger_links`** — one row per issued tracking token.
  - `token text primary key` (opaque, 24+ chars, high entropy)
  - `delivery_id text not null`
  - `issued_at timestamptz not null default now()`
  - `expires_at timestamptz` (nullable = does not expire; policy uses it if set)
  - `revoked_at timestamptz`
  - `channel text` (audit: `sms` / `whatsapp` / `staff_preview`)

- **`delivery_public_view`** — one row per delivery, mirroring ONLY the passenger-safe fields kept in sync from the workflow engine.
  - `delivery_id text primary key`
  - `passenger_name text`
  - `status text` (canonical workflow status — no internal notes)
  - `stage text` (canonical stage — Ready / Assigned / Out / Delivered / Failed / Returned)
  - `bag_tag text`, `airline text`, `flight_no text`, `flight_date date`
  - `otp_code text` (only surfaced by RPC when stage requires it — never selected directly)
  - `updated_at timestamptz`

- **`passenger_feedback`** — passenger-submitted feedback, insertable only via RPC.
  - `id uuid pk`, `delivery_id text`, `token text`, `rating int`, `resolved bool`, `comments text`, `created_at`.

RLS:
- `passenger_links`: RLS on. No anon SELECT, no anon INSERT/UPDATE/DELETE. Only the RPC (SECURITY DEFINER) reads it. Staff (`authenticated`) can INSERT and UPDATE (issue / revoke).
- `delivery_public_view`: RLS on. No direct anon SELECT. Only the RPC reads it. Staff writes via trigger/function from the workflow engine.
- `passenger_feedback`: RLS on. No direct anon anything. Only the RPC inserts. Staff (`authenticated`) can SELECT.

No table is queryable by anon via PostgREST. The only anon surface is the RPC.

## Public RPCs (SECURITY DEFINER, GRANT EXECUTE TO anon)

- **`get_passenger_view(p_token text) → jsonb`**
  - Looks up `passenger_links` by token; returns null if missing, revoked, or expired.
  - Joins `delivery_public_view` on `delivery_id`.
  - Returns ONLY: `passenger_name`, `status`, `stage`, `bag_tag`, `airline`, `flight_no`, `flight_date`, and — only when `stage IN ('assigned','out_for_delivery')` — `otp_code`. Never returns `delivery_id`, phone, address, driver name, internal notes, or audit.
  - Logs a lightweight access row (rate-limit-safe, optional).

- **`passenger_confirm_delivery(p_token text) → boolean`**
  - Verifies token valid + not expired + not revoked.
  - Advances stage to `delivered` via the workflow engine (calls internal SECURITY DEFINER helper).
  - Returns success/failure.

- **`passenger_report_misconduct(p_token text) → boolean`**
  - Opens a quality incident linked to the delivery. No passenger PII in the returned payload.

- **`passenger_submit_feedback(p_token text, p_rating int, p_resolved bool, p_comments text) → boolean`**
  - Validates ranges. Inserts into `passenger_feedback`. Advances workflow to `feedback_submitted`.

All four functions:
- Are `SECURITY DEFINER`, `SET search_path = public`, owner = a dedicated non-superuser role that only has the exact grants needed.
- `REVOKE EXECUTE ... FROM PUBLIC` then `GRANT EXECUTE ... TO anon, authenticated`.
- Never `SELECT *` — every column is enumerated.
- Enforce token freshness (`revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`) at the top.
- Return `null` / `false` on any failure — no error text that could hint at existence.

## Sync between workflow engine and `delivery_public_view`

The workflow engine (`src/lib/store.ts`) stays the single source of truth for staff. When it transitions a delivery, it writes to `delivery_public_view` via one of two mechanisms — pick one at implementation time:

1. **DB trigger** on the (future) real `deliveries` table — cleanest, but requires migrating staff state out of the `app_state` blob (long-term correct, larger scope).
2. **Server function upsert** — every workflow transition also calls a `syncDeliveryPublicView(deliveryId)` server fn that writes the safe columns into `delivery_public_view`. Works today without moving off the blob.

Recommended path: **(2) now, (1) later**. The public architecture does not need the blob to be migrated; it only needs a projected copy of the passenger-safe fields, refreshed on every transition.

## Token lifecycle

- **Issue** — when staff assigns a driver (or at `Ready for Delivery` handover), a server fn generates a token and inserts into `passenger_links(token, delivery_id, channel)`. The token replaces the current `workflow[].token` field in `app_state` for continuity, but the source of truth for anonymous lookup is `passenger_links`.
- **Distribute** — the existing Notification Engine SMS/WhatsApp templates embed `${origin}/passenger/${token}` unchanged.
- **Rotate** — staff action calls `rotatePassengerToken(deliveryId)`: sets `revoked_at = now()` on the old row and issues a new one.
- **Expire** — optional `expires_at` (e.g. `Delivered + 7 days`); after that, RPC returns null. UI shows the generic "link not available" state.
- **Staff preview** — same token, distinguished by `channel = 'staff_preview'` for audit.

## Frontend rewrite (no code yet — scope only)

- `src/routes/passenger.$token.tsx`: replace `getPassengerViewByToken` with a new server fn that calls `rpc.get_passenger_view(token)` using the **publishable-key** Supabase client (server-side, no session). No `supabaseAdmin`. Remove all `useStore` fallbacks. Loader returns exactly the RPC shape.
- `src/routes/passenger.index.tsx`: `PassengerPortal` accepts the projected view (no `deliveryIdOverride`, no `Delivery`/`BaggageCase` types). All fields come from the RPC response. Remove imports from `@/lib/store`.
- Mutations (`confirm`, `misconduct`, `feedback`) call the corresponding RPC-backed server functions — same publishable-key pattern.
- `src/lib/persistence.ts` and `initPersistence` behaviour on `/passenger/*` unchanged (already gated by session); the portal simply no longer reads the store.

## Security model summary

- No table on the passenger path grants `anon` any privilege.
- `anon` can only invoke the four whitelisted RPCs.
- Each RPC returns ONLY passenger-safe columns for ONLY the token's own delivery.
- OTP is exposed only during the narrow stages that need it.
- Service role never appears in the passenger request path.
- Staff tables (`app_state`, future `deliveries`, `user_roles`, notifications, audit) remain `authenticated`-only.
- Enumeration attack surface: opaque 24-char tokens with revocation and optional expiry; RPC returns null on miss with no distinguishing error.
- Rate limiting: recommended `pg_net`/edge middleware later; not blocking for v1.

## Data flow (end to end)

```text
Staff assigns driver
      │
      ▼
Workflow engine transitions delivery
      │            │
      ▼            ▼
passenger_links   delivery_public_view          (staff-only writes)
      │
      ▼
Notification Engine sends SMS/WhatsApp with /passenger/{token}
      │
      ▼
Passenger opens link on ANY device (no auth)
      │
      ▼
Route loader → server fn (publishable key) → rpc.get_passenger_view(token)
      │
      ▼
RPC checks link validity, joins public view, returns minimum fields
      │
      ▼
Portal renders. Confirm / feedback / misconduct → RPC → workflow engine
```

Identical on desktop, mobile Safari, Lovable App, iPhone, Android, preview, published.

## Migration strategy

Phase 0 — freeze (no schema yet):
- Confirm plan.

Phase 1 — schema:
- Migration creates `passenger_links`, `delivery_public_view`, `passenger_feedback` with GRANTs and RLS.
- Migration creates the four SECURITY DEFINER RPCs, grants EXECUTE to anon/authenticated.
- No data movement yet.

Phase 2 — backfill:
- One-off migration reads existing `app_state.payload.workflow[]` server-side and inserts a `passenger_links` row per existing token, and inserts a `delivery_public_view` row per current delivery. Idempotent (ON CONFLICT DO NOTHING / UPDATE).

Phase 3 — write path:
- `ensureWorkflow` / `assignDriver` / status transitions also upsert into `passenger_links` and `delivery_public_view`.
- New helper server fn `syncDeliveryPublicView(deliveryId)`.

Phase 4 — portal cutover:
- `passenger.$token.tsx` and `passenger.index.tsx` switch to RPC. Store fallback removed. Delete `getPassengerViewByToken` and `mutatePassengerView` (or gut them to thin RPC wrappers).

Phase 5 — cleanup:
- Optional: remove `workflow[].token` from the blob once RPC is the sole reader.
- Add token rotation UI action for staff.
- Add optional `expires_at` policy.

Each phase is independently deployable and reversible until Phase 4.

## Rollout verification (per phase)

- Phase 1: `select has_function_privilege('anon', 'public.get_passenger_view(text)', 'execute')` = true; direct `select` on new tables as anon returns 0 rows.
- Phase 2: RPC on a real token returns the expected passenger name and status; unknown token returns null.
- Phase 4: open a passenger link in an incognito window (no session) on desktop AND mobile — both render identically. Preview and published behave the same.

## Non-goals (explicitly out of scope of this plan)

- Migrating the entire staff `app_state` blob to relational tables.
- Redesigning the Passenger Portal UI.
- Adding passenger accounts.
- Changing the workflow engine's canonical state machine.

## Technical notes (non-user-facing)

- Server fns that call the RPC use `SUPABASE_PUBLISHABLE_KEY` (already available in preview and published), not `SUPABASE_SERVICE_ROLE_KEY`. This is what makes preview and published identical for mobile.
- `SECURITY DEFINER` functions are owned by a dedicated role (not `postgres`, not `supabase_admin`); we `REVOKE EXECUTE ... FROM PUBLIC` immediately after creation and grant to `anon, authenticated` explicitly.
- RPC responses are `jsonb`, never rowsets, so PostgREST returns them as a single object.
