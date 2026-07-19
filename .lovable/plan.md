## Scope

Visual-only redesign of the Passenger Portal (`src/routes/passenger.tsx` and its font links in `src/routes/__root.tsx`). No changes to business logic, workflow, backend, navigation, data flow, component APIs, or any other route. The reference image is used strictly as a quality/aesthetic benchmark — its layout and elements are not reproduced.

## Design language

Apple × Emirates First Class × Aman: quiet, editorial, generous whitespace, high-precision typography, soft light, subtle depth. Two card styles only:

1. **Ivory/white card** — off-white surface (`#FFFFFF` on ivory page), hairline navy border at ~6% opacity, ultra-soft ambient shadow.
2. **Deep navy card** — `#081C3A` background, faint inner top highlight, subtle gold hairline dividers.

Accents: **navy `#081C3A`**, **ivory `#F6F1E7`**, **gold `#C9A84C`** (used only for hairlines, tiny dots, and a single icon stroke). **No crimson anywhere in the portal.** No random accent hues.

## Typography

- **Display**: Telegraf (weights 300/400/500) — passenger name, section titles, hero headline.
- **UI**: Glacial Indifference (regular/bold) — body, labels, meta, buttons.
- **Arabic**: keep IBM Plex Sans Arabic, sized to match optical weight of Telegraf; equal visual importance.

Load via Fontshare CDN in `src/routes/__root.tsx` (both fonts are hosted there). Scope them to the portal only via CSS variables on the portal root:
- `--font-passenger-display: "Telegraf", ...`
- `--font-passenger-ui: "Glacial Indifference", ...`
Global `--font-display / --font-heading / --font-sans` are not modified — the rest of the app keeps its current typography.

Scale (portal only): eyebrow 10px / 0.28em tracking; body 14–15px; section title 18–20px; hero headline `clamp(2rem, 5vw, 2.75rem)`; passenger name `clamp(2.75rem, 8vw, 4.5rem)`, weight 300, tight leading 1.02.

## Card-by-card changes

**BrandHeader** — thinner navy bar, remove crimson "Secure" dot (use a hairline gold dot instead), gold-hairline underline beneath the logo lockup.

**WelcomeCard** — ivory card. Rebuild inner hierarchy: tiny eyebrow ("IAB Concierge · Cairo"), bilingual greeting on one line with hairline dot separator, large Telegraf passenger name, Arabic name directly under at matched optical weight, italic Telegraf welcome line + Arabic mirror, and a hairline-divided meta strip (Flight · PIR · Bag Tag · Date) in Glacial small-caps. Remove the current crimson dot ornament at the top; replace with a gold hairline.

**StatusHero** — keep the animated suitcase illustration and its motion untouched. Convert the card to the deep-navy style (`#081C3A`), refine typography (Telegraf headline, Glacial subline, matched Arabic), reduce chip clutter, remove any crimson tints/glows, replace with cool navy-to-ink gradient and a faint gold hairline top border. Corner radius unified to 28px.

**SimpleTimeline** — ivory card. Thinner rail (1px, navy at 15% opacity, gold at 40% for completed segments), smaller circles (12px), active step gets a soft navy pulse (no red). Labels in Glacial small-caps + Arabic mirror.

**OtpHeroCard** — adopt the exact StatusHero visual language: deep navy `#081C3A`, same radius, same shadow, same top hairline. OTP digits in Telegraf light at large size, spaced generously. Checklist rows restyled with hairline dividers and gold check marks; confirm button becomes an ivory pill on navy. Preserve all existing logic (checks, incident reporting, `confirm()`).

**ContactCard / ExpectedDeliveryCard / DemoSwitcher / PortalFooter** — restyled to the two-card system, Glacial typography, hairline dividers, no crimson.

**FeedbackScreen / ThanksScreen / DeliveredCelebration** — same two-card system and typography; celebration keeps its motion but swaps any red/emerald flourish for gold-on-navy.

## Motion

Keep existing `MotionSection` stagger and suitcase float. Remove shimmer/red pulses. Add a single subtle gold hairline sweep on the navy cards (very low opacity, 8s loop, respects `prefers-reduced-motion`).

## Files touched

- `src/routes/passenger.tsx` — restyle all portal subcomponents listed above; add portal-scoped `--font-passenger-display` / `--font-passenger-ui` variables; remove crimson usages inside the portal; unify radii and shadows.
- `src/routes/__root.tsx` — add Telegraf + Glacial Indifference `<link>` tags (Fontshare) alongside existing font links. No other change.

Nothing else is modified. `src/styles.css` global tokens, other routes, and all business logic remain untouched.

## Verification

- `/passenger/<token>` on mobile and desktop: ivory + navy cards only, no red, Telegraf on names/headlines, Glacial on body, Arabic balanced.
- Every other route (`/`, `/lost-found`, `/delivery`, `/driver-portal`, `/admin`, …) is visually unchanged.
- OTP flow, feedback flow, incident reporting, and delivery confirmation still work end-to-end.
