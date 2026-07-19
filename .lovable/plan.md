# Passenger Portal Typography — Free-Font Fix

Investigation confirmed that Telegraf and Glacial Indifference are **not actually loaded** in the browser. The portal currently falls back to Fraunces (display) and General Sans (body). This plan replaces the unsupported commercial fonts with the user-selected free stack, keeping the luxury editorial look intact.

**Final font stack (portal only, unchanged elsewhere):**
- Display / passenger name / section titles → **General Sans** (already loaded via Fontshare, weights 300/400/500/600)
- UI / body / meta / buttons → **Manrope** (already loaded via Google Fonts, weights 400/500/600/700)
- Arabic mirror → **IBM Plex Sans Arabic** (already loaded, unchanged)

Both replacements are already downloaded by `src/routes/__root.tsx`, so **no new font links, no new packages, no self-hosted files** are required.

## Scope (visual/typography only)

Only the two files identified in the investigation are touched. No business logic, workflow, backend, routing, or component API changes.

## Changes

### 1. `src/routes/__root.tsx`
- Remove the Fontshare Telegraf request. Change:
  `f[]=telegraf@300,400,500,700&f[]=general-sans@300,400,500,600`
  to:
  `f[]=general-sans@300,400,500,600`
  (drops the dead Telegraf fetch; keeps General Sans working).
- No other edits to the head/links/meta.

### 2. `src/routes/passenger.tsx`
Update only the font-stack strings — all layout, spacing, weights, colors, motion, and component structure remain identical.

- Portal root `style` block:
  - `--font-passenger-display: "General Sans", "Fraunces", ui-serif, Georgia, serif`
  - `--font-passenger-ui: "Manrope", "Inter", ui-sans-serif, system-ui, sans-serif`
  - Arabic variables keep `"IBM Plex Sans Arabic"` first; drop the `"Glacial Indifference"` fallback.
- Any inline `fontFamily` in subcomponents that still hard-codes `"Telegraf"` or `"Glacial Indifference"` is rewritten to reference the CSS variables (`var(--font-passenger-display)` / `var(--font-passenger-ui)`) so the portal has a single source of truth.
- Optional micro-adjustments to preserve the editorial feel with the new metrics (still typography-only):
  - Passenger-name headline: weight **300**, `letter-spacing: -0.02em` (General Sans reads tighter than Telegraf at display size).
  - Small-caps eyebrows / meta strip: Manrope 500, `letter-spacing: 0.24em`, `text-transform: uppercase`.
  - Line-height on hero name stays 1.02.

### 3. `.lovable/plan.md` (doc only)
- Update the outdated statement that Telegraf + Glacial Indifference are loaded via Fontshare; note the final free-font decision.

## Explicitly NOT changing

- `src/styles.css` global tokens, `--font-display`, `--font-heading`, `--font-sans`.
- Any route other than `/passenger/*`.
- `package.json`, no new dependencies, no `@fontsource-*` installs, no `public/fonts/*`.
- All Passenger Portal components' structure, colors (ivory/navy/gold), motion, OTP flow, feedback flow.

## Verification

1. Reload `/passenger/<token>` on mobile + desktop.
2. Confirm via DevTools computed styles: hero `h1` → `General Sans`; body `p` → `Manrope`; Arabic → `IBM Plex Sans Arabic`.
3. `document.fonts` should show `General Sans`, `Manrope`, `IBM Plex Sans Arabic` in `loaded` state; no Telegraf / Glacial entries expected or needed.
4. Spot-check every other route (`/`, `/lost-found`, `/delivery`, `/driver-portal`, `/admin`) — typography unchanged.
5. Run through OTP + feedback + delivery confirmation to confirm no behavioral regression.
