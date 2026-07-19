# Passenger Portal — Unify Typography on Space Grotesk

Scope: **Passenger Portal only** (`/passenger/:token` and its components). No workflow, data, or logic changes. Future Passenger enhancements will continue in this same module until you confirm it's finalized.

## Font decision

- English display + headings + body → **Space Grotesk** (weights 400/500/600/700).
- Arabic parity → **IBM Plex Sans Arabic** (already loaded) at matched weight and size, so Arabic never feels secondary.
- Retire Fraunces, Manrope, Inter, Reem Kufi, and Noto Naskh Arabic from Passenger surfaces.

## Changes

1. `src/routes/__root.tsx`
   - Replace the current Google Fonts `<link>` with a single request that loads **Space Grotesk 400;500;600;700** + **IBM Plex Sans Arabic 400;500;600;700** (keep `preconnect` links).
   - Leave other fonts referenced by non-passenger surfaces intact only if used elsewhere; otherwise drop them.

2. `src/styles.css`
   - Update font tokens so every family points to Space Grotesk / IBM Plex Sans Arabic:
     - `--font-display`, `--font-heading`, `--font-sans` → `"Space Grotesk", ui-sans-serif, system-ui, sans-serif`
     - `--font-arabic`, `--font-arabic-display` → `"IBM Plex Sans Arabic", system-ui, sans-serif`
   - No color, spacing, animation, or layout changes.

3. Passenger components
   - `src/routes/passenger.tsx`, `src/components/passenger/*` (welcome/status/timeline/otp/contact/celebration/bilingual): remove any hard-coded `font-display` / `font-serif` / Fraunces class usage and rely on the tokens above. Keep sizes, weights, and rhythm exactly as they are today — only the family changes.
   - `Bi` component keeps equal-weight pairing; both sides now use their Space Grotesk / IBM Plex Sans Arabic families at the same size and weight.

## Out of scope

- Workflow, statuses, OTP, timeline data, notifications, feedback.
- Non-passenger surfaces (dispatcher, driver, L&F, warehouse, admin) — their fonts stay unchanged unless the token swap in `styles.css` cascades naturally.
- Colors, spacing, animations, and copy remain as approved.

## Note on future work

All subsequent Passenger Experience enhancements will be scoped to this module until you confirm it's finalized.
