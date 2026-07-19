## Scope (strict)

Only two things change on `/passenger/$token`:

1. The **Welcome Hero** — the `WelcomeCard` component in `src/routes/passenger.tsx` (currently ~lines 423–502, rendered at line 327).
2. The **portal-scoped typography tokens** — the inline CSS variables on the portal root (`src/routes/passenger.tsx` lines 95–101).

Nothing else is touched: no Workflow, OTP, Notifications, Supabase, Auth, L&F, Delivery, Driver Portal, and no other section of the portal (StatusHero, Timeline, Concierge, OTP, Delivered celebration, footer). Data props, layout position in the page, and the surrounding `Bi` bilingual pattern stay identical.

## Design direction — "editorial concierge"

Reference vocabulary: Emirates First Class print collateral, Aman welcome cards, Apple product pages. The hero should read like the inside cover of a premium travel folio, not a SaaS card.

Visual moves:

- **Editorial serif for the passenger name.** Reintroduce **Fraunces** (already loaded in `__root.tsx`) as `--font-passenger-display` scoped to the portal only. Name renders in Fraunces at large optical size, weight 300–400, tight tracking, generous line-height. Sans (Space Grotesk) stays for eyebrows/pills; Arabic stays on IBM Plex Sans Arabic but paired weight-for-weight with the serif so both scripts feel equal.
- **Quiet luxury palette.** Keep ivory background. Replace the flat card with a soft warm ivory gradient plus a hair-thin navy rule at the top and a small crimson serif ornament (a single `·` or thin vertical hairline) as the only accent — no crimson elsewhere in the hero.
- **Breathing room.** Increase vertical padding (py-14 → py-16/20), widen inner rhythm, remove the current dense pill row from the primary field of view.
- **Hierarchy rebuild** (top to bottom):
  1. Tiny eyebrow: "IAB Concierge · Cairo" (uppercase, 10px, 0.32em tracking, navy/60).
  2. Bilingual greeting on one refined line: `Good Morning — صباح الخير` separated by a hairline dot, both scripts same visual weight.
  3. **Passenger name** as the emotional anchor — Fraunces, `clamp(2.75rem, 9vw, 4.75rem)`, weight 380, `font-variation-settings: "opsz" 144, "SOFT" 40`, tight leading (0.98), navy ink.
  4. Arabic name directly under, IBM Plex Sans Arabic, weight 500, sized to match optical weight of the serif (~55% of English size).
  5. A single italic Fraunces welcome line: *"Your baggage is in the care of IAB Concierge."* with Arabic mirror below in a lighter Plex weight. Replaces the current sans sentence.
  6. Flight / PIR / Tag metadata demoted to a **thin bottom meta strip** separated by a hairline divider — small sans caps, generous letter-spacing, no pill chips. This preserves the same three data points (`flightNumber`, `pirNumber`, `bagTag`) already shown today.
- **Motion.** Keep the existing single `motion.div` entrance (opacity + y). Add a subtle staggered reveal for eyebrow → greeting → name → welcome → meta (0.08s stagger, same easing). No parallax, no floating, no shimmer in the hero.

Everything below the hero (StatusHero and onward) is untouched and continues to consume the same portal-scoped font variables.

## Files to change

- `src/routes/passenger.tsx`
  - Extend the portal root style object (lines 95–101) with two additional scoped vars: `--font-passenger-display` (Fraunces stack) and `--font-passenger-serif-italic` alias. Keep the existing Space Grotesk / IBM Plex Sans Arabic vars for `--font-sans`, `--font-heading`, `--font-arabic*` so no other section changes appearance.
  - Rewrite the `WelcomeCard` component body (only) to the hierarchy above. Same props signature (`{ delivery, kase }`), same data fields consumed, same position in `PortalContent`.
  - Remove the `ElegantPill` chip usage from inside the hero. Leave the `ElegantPill` component defined (may be reused elsewhere) — do not delete it unless unreferenced after the edit.

No other files change. No new dependencies. Fraunces is already linked in `src/routes/__root.tsx`.

## Out of scope

- StatusHero (navy suitcase card), SimpleTimeline, Concierge card, OTP hero, DeliveredCelebration, BrandHeader, language toggle, footer.
- Global `src/styles.css` tokens.
- Any business logic, data fetch, tokens, or routes.

## Verification

- Load `/passenger/<token>` on mobile and desktop widths: hero reads as an editorial welcome, name in Fraunces, bilingual greeting balanced, meta strip minimal.
- Load `/`, `/lost-found`, `/delivery`, `/driver-portal`: unchanged (portal font overrides remain scoped to the portal root).
- Arabic (RTL) toggle still renders correctly with equal visual weight in the hero.
