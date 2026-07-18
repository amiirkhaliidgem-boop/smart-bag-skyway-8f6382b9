# Passenger Portal — Premium Visual Refinement

Scope: **Presentation only**. No changes to Workflow Engine, OTP flow, Timeline derivation, Feedback submission, store, or any server function. Every existing selector, action, and route stays identical. Files touched are limited to the passenger UI tree plus design tokens.

## 1. Branding & header (`src/components/passenger/brand-header.tsx`)

- Remove the "IAB Baggage Concierge" wordmark string entirely.
- Rebuild the header as a full-width branded band on `--gradient-iab-hero` with a subtle noise/grain overlay and a soft crimson accent glow bottom-right.
- Enlarge the IAB logo mark (56–72px on mobile, 88px on ≥sm), placed on a soft ivory chip with 1px inner stroke for legibility over the navy gradient.
- Right side: compact bilingual "Official Airport Service / خدمة رسمية بالمطار" micro-line in IBM Plex Sans Arabic + Inter, uppercase tracking on the English, equal size on Arabic.
- Sticky on scroll with a smooth backdrop-blur transition (opaque navy → translucent glass) driven by a small scroll listener + CSS var, respecting `prefers-reduced-motion`.

## 2. Hero centerpiece (`src/components/passenger/status-hero.tsx`)

- Promote the hero to the true focal element: full-bleed rounded 32px card, layered gradient (`--gradient-iab-hero`), soft radial highlight top-left, animated aurora blob (very slow, low opacity) behind the content.
- Passenger name: swap Instrument Serif for **Fraunces** (variable, optical-size) — modern luxury display, warmer than the current serif; loaded via `<link>` in `__root.tsx`. Tracked tight, size clamps `clamp(2rem, 8vw, 3.25rem)`.
- Current status headline enlarged to `clamp(1.5rem, 5.5vw, 2rem)`, ivory on navy, with a bilingual sub-line of equal weight underneath (Fraunces / IBM Plex Sans Arabic).
- Small "PIR • Bag Tag • Flight" chip row at the bottom of the hero, glass pills.
- Entrance: staggered fade+rise (100ms/step) via Motion One or Framer Motion (Framer already in project). Reduced motion → static.

## 3. Typography system (`src/routes/__root.tsx` + `src/styles.css`)

- Add font `<link>`s: **Fraunces** (display), keep **Inter** (body), keep **IBM Plex Sans Arabic** (Arabic body), add **Reem Kufi Fun** or **Cairo** for Arabic display so Arabic hero text has real display presence — Arabic never renders in a body face while English uses a display face.
- Update tokens:
  - `--font-display: "Fraunces", ui-serif, Georgia, serif;`
  - `--font-arabic-display: "Reem Kufi Fun", "IBM Plex Sans Arabic", system-ui, sans-serif;`
- `<Bi>` helper extended with an optional `variant="display" | "body"` prop that swaps Arabic to the display face and matches x-heights so RTL/LTR pairs feel truly equal.

## 4. Micro-interactions

Introduce a single motion primitive file `src/components/passenger/motion.ts` exposing shared variants; all consumed via Framer Motion (already installed).

- Page-level `AnimatePresence` in `passenger.tsx` — fade + 8px rise on stage change.
- Timeline (`timeline-simple.tsx`): the progress rail draws with `pathLength` from 0→currentIndex, dots pop with spring, active dot has `iab-pulse-ring`.
- Cards: `whileHover={{ y: -2 }}`, soft shadow lift, 200ms.
- Buttons: press ripple utility (`.iab-ripple`) — pointer-position radial gradient on `:active`; works on touch via `onPointerDown`.
- OTP digits (`otp-card.tsx`): each digit tile mounts with scale-spring (staggered 60ms), the active tile gets a slow crimson glow pulse.
- Delivered success: keep existing `DeliveredCelebration`, tighten check-stroke curve, add confetti-free particle glow (3 ivory dots) for restraint.
- Background: hero aurora + a very faint fixed grain layer over the page (SVG noise, 3% opacity).
- Scroll reveal: `useInView` on each major section (Expected Delivery, OTP, Timeline, Contact) → fade-rise once.
- All motion gated by `prefers-reduced-motion`.

## 5. Mobile-first layout (`src/routes/passenger.tsx`)

- Single-column, max-width 480px on phone, 560px on tablet, centered on desktop with a soft ivory canvas outside the card stack.
- Reduce vertical whitespace between sections from current ~24px to a rhythm of 16/20/24 based on hierarchy.
- Collapsible sections using shadcn `Collapsible`:
  - "Trip details" (PIR, Bag Tag, Airline, Flight) — collapsed by default when hero already shows the chip row.
  - "Safety checklist" inside the OTP card — expanded by default only when OTP is active; collapsed when Delivered.
- Sticky bottom action bar on mobile carrying the primary CTA (Confirm / Contact) so the passenger never scrolls to act.

## 6. Contact card (`src/components/passenger/contact-card.tsx`, new)

Three premium action tiles (not plain buttons), grid `grid-cols-3` on mobile with icon-forward layout:

- **Call Airport** — `tel:` link to station.contactPhone (fallback support number from `src/lib/passenger/brand.ts`).
- **WhatsApp Support** — `https://wa.me/<number>` with prefilled bilingual message including PIR.
- **Email Support** — `mailto:` prefilled subject "PIR {number} — Support request".

Each tile: glass surface, IAB navy iconography, crimson micro-accent on hover, bilingual label (equal weight), press ripple. Never triggers workflow notifications; purely `href` links.

## 7. Premium polish pass

- Replace flat white cards with `iab-glass` + 1px hairline border `color-mix(navy 8%, transparent)`.
- Elevation system: three shadow tiers (`--shadow-iab-soft`, `--shadow-iab-glass`, `--shadow-iab-crimson`) — used consistently per element role.
- Iconography: swap generic Lucide icons in the passenger tree for a curated set (`Plane`, `ShieldCheck`, `Sparkles`, `PhoneCall`, `MessageCircle`, `Mail`) at 20/24px, stroke 1.5.
- Empty/loading states: premium skeleton (already scaffolded) tuned to match the new hero silhouette; adds a slow shimmer + IAB monogram watermark.
- Success/Delivered screen: full-viewport ivory canvas with centered logo, Fraunces "Delivered / تم التسليم", subtle radial navy glow — replaces the current inline overlay for a memorable close.

## 8. Workflow integrity guardrails (unchanged)

- No changes to `src/lib/store.ts`, `src/lib/passenger.functions.ts`, OTP logic, feedback submission, or notifications.
- Timeline still derived from `passengerTimeline(case, delivery)`; no new statuses.
- All copy remains bilingual with equal typographic weight.
- No new routes; no store fields.

## Files touched

Rewritten (UI only):
- `src/routes/passenger.tsx`
- `src/routes/feedback.tsx` (visual polish to match — no flow change)
- `src/components/passenger/brand-header.tsx`
- `src/components/passenger/status-hero.tsx`
- `src/components/passenger/timeline-simple.tsx`
- `src/components/passenger/otp-card.tsx`
- `src/components/passenger/delivered-celebration.tsx`
- `src/components/passenger/loading-skeleton.tsx`
- `src/components/passenger/bilingual.tsx` (add display variant)

New:
- `src/components/passenger/contact-card.tsx`
- `src/components/passenger/motion.ts`
- `src/components/passenger/trip-details.tsx` (collapsible)

Edited (tokens + font links only):
- `src/styles.css` — Fraunces / Arabic display tokens, shadow tiers, ripple utility, aurora keyframes
- `src/routes/__root.tsx` — `<link>` tags for Fraunces + Reem Kufi Fun

Untouched: store, workflow engine, notifications, OTP engine, driver portal, delivery/L&F/warehouse modules, feedback submission logic.

## Out of scope

- Any workflow/business-logic edits.
- Driver Portal, Delivery Dispatch, or L&F visuals.
- New brand assets beyond the existing IAB logo.

Ready to implement on approval.
