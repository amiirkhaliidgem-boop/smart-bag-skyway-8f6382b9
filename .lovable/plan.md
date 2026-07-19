
# Passenger Portal — Executive Concierge Visual Refinement

Scope: **visuals only**. No changes to workflow, statuses, OTP, timeline data, feedback flow, notifications, store, or server functions. The five-stage journey (Bag Located → Customs Cleared → Assigned to Delivery → Out for Delivery → Delivered) is preserved exactly. Files touched: passenger UI tree, design tokens, root head links, and one new suitcase asset.

## 1. Typography system

Update font links in `src/routes/__root.tsx` and tokens in `src/styles.css`:

- **Passenger name (display serif):** Fraunces (already linked) at optical size ~144, weight 400–500, tight tracking. Clamp `2.25rem → 3.5rem`.
- **Headings (premium sans):** switch from Inter to **Söhne-alt via Manrope 500/600** — Manrope is free, geometric, and reads editorial. Uppercase micro-labels use letter-spacing 0.18em.
- **Body (premium sans):** Inter 400/500 kept for body only.
- **Arabic parity — critical:** replace Reem Kufi with **Frank Ruhl Libre-equivalent for Arabic → Noto Naskh Arabic (display 500) + IBM Plex Sans Arabic (body)**. Arabic uses the same visual weight, size, and vertical rhythm as English — never a smaller or lighter fallback. The `<Bi>` component in `src/components/passenger/bilingual.tsx` gets a `variant` prop (`display | heading | body`) that pairs each English face with its Arabic counterpart at matched x-height.

Tokens added:
```
--font-display-en: "Fraunces", serif;
--font-display-ar: "Noto Naskh Arabic", "IBM Plex Sans Arabic", serif;
--font-heading-en: "Manrope", system-ui, sans-serif;
--font-heading-ar: "IBM Plex Sans Arabic", system-ui, sans-serif;
--font-body-en:   "Inter", system-ui, sans-serif;
--font-body-ar:   "IBM Plex Sans Arabic", system-ui, sans-serif;
```

## 2. Color system

Rewrite brand tokens in `src/styles.css`:

- `--iab-navy: #0B1B3B` (primary surface + text on ivory)
- `--iab-navy-deep: #060F26` (hero base)
- `--iab-ivory: #F6F1E7` (page canvas, warm)
- `--iab-ivory-soft: #FBF7EE`
- `--iab-platinum: #C9CBD1` (inactive timeline, hairlines)
- `--iab-platinum-soft: #E8E6E0`
- `--iab-crimson: #8B1E2D` (micro-accent only — active dot glow, single underline, notification badge)
- `--iab-emerald: #1F6B4A` (used **only** in the Delivered state — success badge, check icon, celebration)
- `--gradient-iab-hero: radial-gradient(120% 90% at 20% 10%, #12224A 0%, #060F26 60%, #030820 100%)`

Rules enforced in components: no crimson on buttons/CTAs, no crimson on hero base, no green until `stage === "Delivered"`.

## 3. Welcome Hero (`src/components/passenger/status-hero.tsx` split)

Split into two stacked cards to make Welcome the emotional center:

**A. WelcomeCard (new)** — ivory canvas, generous 40–56px padding, no chrome:
- Micro-label "GOOD EVENING / مساء الخير" (contextual by hour).
- Passenger name in Fraunces display (EN) with Arabic name in Noto Naskh Arabic beside/under it at matched weight.
- One line of elegant greeting bilingual.
- Elegant pill row (Flight · PIR · Bag Tag) — hairline platinum border, navy text, tabular numerals, generous horizontal padding.

**B. StatusCard (redesigned)** — full-bleed navy gradient card:
- Layered `--gradient-iab-hero` + faint dot pattern (SVG, 3% opacity) inspired by the reference.
- Left column: "CURRENT STATUS" micro-label with a small crimson pulse dot; then the stage name in a very large display (Fraunces on ivory-white foreground, Arabic underneath at equal size).
- Right column: **3D suitcase illustration** with subtle 6s float animation, soft key-light glow, contact shadow. Generated as `src/assets/passenger-suitcase.png` (navy hardshell luggage, ivory backdrop-safe, transparent PNG) via imagegen. Location pin icon top-right corner.
- Bottom row: "EXPECTED / متوقع" — **Today** only. No ETA countdown, no time window, no arrival timer. If the delivery is `Delivered`, replace with an emerald "DELIVERED · تم التسليم" chip.
- Card uses `iab-glass` layered shadow tiers already defined.

Reduced motion: float animation disabled.

## 4. Journey Timeline (`src/components/passenger/timeline-simple.tsx`)

Keep exactly 5 steps in existing order. Visual pass only:
- Dots reduced from 20px to 12px.
- Rail thickness reduced from 2px to 1px, color `--iab-platinum` (inactive) / `--iab-navy` (completed).
- Spacing rhythm 28px vertical between steps.
- Active step: 12px navy dot with a soft crimson pulse ring (60% opacity, 2.4s ease-in-out).
- Completed: solid navy fill, small checkmark on hover.
- Inactive: platinum ring, no fill, muted label.
- Labels: Manrope 500 EN + IBM Plex Sans Arabic 500 AR, equal size, stacked or inline based on width.
- Section heading uses Fraunces italic small caps: "Your Journey / رحلتك".

## 5. Contact Concierge (`src/components/passenger/contact-card.tsx`)

Replace the current three tiles with a bottom-anchored **Contact Concierge** card:
- Ivory-soft surface, hairline platinum border, 24px radius.
- Section title in Fraunces italic: "Concierge / كونسيرج".
- Four pill buttons stacked on mobile / 2×2 on ≥sm:
  - **Call** → `tel:` from station config
  - **WhatsApp** → `wa.me` with prefilled bilingual PIR message
  - **Email** → `mailto:` with prefilled subject
  - **Airport Support** → station support line
- Buttons: pill shape, 56px tall, navy outline default, navy-fill on hover, subtle 200ms ease. Icon left, bilingual label center-aligned, no crimson.

Pure `href` links; no notification side effects.

## 6. Motion (`src/components/passenger/motion.ts`)

Framer Motion primitives — all gated on `prefers-reduced-motion`:
- Page: fade + 8px rise on mount, 240ms.
- Sections: `useInView` fade-rise once (Welcome, Status, Timeline, Concierge).
- Suitcase: 6s ease-in-out float (translateY ±6px), tiny rotate ±0.4deg.
- Timeline active dot: crimson pulse ring keyframe (already scaffolded).
- Pills/buttons: `whileHover={{ y: -1 }}`, soft shadow lift, 180ms.
- Delivered: replace confetti with a slow emerald radial glow + check draw.

No parallax scroll hijacking; no auto-playing hero videos; no spring bounces on primary content.

## 7. Layout & rhythm (`src/routes/passenger.tsx`)

- Page canvas: `--iab-ivory` with a fixed subtle grain layer (3% SVG noise).
- Max width 480px mobile, 560px tablet, 640px desktop, centered.
- Vertical rhythm: 32px between major sections, 20px inside cards.
- Sticky header keeps the current IAB brand band; unchanged structure, only palette + type refresh.
- Remove any lingering red button fills; primary CTAs become navy on ivory.

## 8. Guardrails (unchanged)

- No changes to `src/lib/store.ts`, `src/lib/passenger.functions.ts`, OTP, feedback, notifications, workflow engine.
- Timeline still derived from `passengerTimeline(case, delivery)`; 5 steps preserved.
- Bilingual copy remains equal-weight throughout.
- No new routes; no store fields; no server functions edited.

## Files touched

Rewritten (visuals only):
- `src/routes/passenger.tsx` — layout rhythm, palette, hero split usage
- `src/components/passenger/brand-header.tsx` — palette + type
- `src/components/passenger/status-hero.tsx` → split into `welcome-card.tsx` + `status-card.tsx`
- `src/components/passenger/timeline-simple.tsx` — smaller dots, thin rail, pulse
- `src/components/passenger/otp-card.tsx` — palette + type (no logic change)
- `src/components/passenger/delivered-celebration.tsx` — emerald glow, remove crimson
- `src/components/passenger/contact-card.tsx` — Concierge card
- `src/components/passenger/bilingual.tsx` — `variant` prop with Arabic display face
- `src/components/passenger/loading-skeleton.tsx` — ivory palette
- `src/styles.css` — palette rewrite, font tokens, pulse/float keyframes
- `src/routes/__root.tsx` — add Manrope + Noto Naskh Arabic font links

New:
- `src/components/passenger/welcome-card.tsx`
- `src/components/passenger/status-card.tsx`
- `src/components/passenger/motion.ts`
- `src/assets/passenger-suitcase.png` (imagegen, transparent, navy hardshell)

Untouched: store, workflow engine, OTP engine, notifications, driver portal, delivery/L&F/warehouse modules, feedback submission, all server functions and routes.

## Out of scope

- Any workflow, status, or business-logic change.
- ETA / countdown / time-window UI (explicitly removed).
- Non-passenger surfaces (dispatcher, driver, L&F, warehouse, admin).

Ready to implement on approval.
