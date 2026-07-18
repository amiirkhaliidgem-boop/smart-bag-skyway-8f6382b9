
# Phase 3 — Passenger Experience Redesign

Scope: **UI/UX only**. Workflow Engine, Notification Engine, OTP Engine, Timeline Engine, and store logic remain untouched. The Passenger Portal becomes a pure presentation layer over existing state.

## 1. Design System (IAB brand)

Extract from `src/assets/iab-logo.jpeg.asset.json`:
- Primary: IAB deep navy `#1B2A5B`
- Accent: IAB crimson swoosh `#D6284B`
- Neutrals: ivory `#F7F5F0`, mist `#E8ECF3`, ink `#0F1830`
- Derived: soft navy gradient, subtle crimson glow for CTAs

Add tokens to `src/styles.css` under `@theme` — new semantic vars `--iab-navy`, `--iab-crimson`, `--iab-ivory`, plus gradient + shadow tokens (`--gradient-hero`, `--shadow-glass`, `--shadow-elegant`). All portal components consume tokens; no hex in JSX.

Typography: pair **Instrument Serif** (display, hero + OTP number) with **Inter** (body) via `<link>` in `__root.tsx` head. Arabic: **IBM Plex Sans Arabic** so Arabic never renders smaller than Latin.

## 2. New file structure

Redesign is scoped to two routes plus a small components folder — no new routes, no store changes.

```
src/routes/passenger.tsx           (rewritten, still exports PassengerPortal)
src/routes/feedback.tsx            (rewritten — premium)
src/components/passenger/
  brand-header.tsx                 IAB logo + flight/PIR chip
  status-hero.tsx                  Gradient hero: current stage title + bilingual subtitle
  timeline-simple.tsx              5-step vertical timeline (see §4)
  expected-delivery-card.tsx       Glass card, "Expected Today" (no ETA/countdown)
  otp-card.tsx                     Large animated OTP + bilingual checklist (see §5)
  delivered-celebration.tsx        Animated success → auto-routes to feedback
  loading-skeleton.tsx             Premium shimmer skeletons w/ IAB logo mark
  bilingual.tsx                    <Bi en="..." ar="..." /> helper (RTL-aware, equal weight)
```

## 3. Timeline simplification

The visible timeline is derived from `getDeliveryStage(delivery)` + `case.lfStatus` — read-only projection, no new state:

| Passenger step | Bilingual label | Derived from |
|---|---|---|
| Bag Located | تم العثور على الأمتعة | `lfStatus ∈ {Open, Under Investigation, Located}` |
| Customs Cleared | تم التخليص الجمركي | `lfStatus === "Customs Cleared"` |
| Assigned to Delivery | تم التعيين للتسليم | stage `Ready`/`Scheduled`/`Assigned`/`Driver Accepted`/`Collected` |
| Out for Delivery | في الطريق إليك | stage `Out for Delivery` |
| Delivered | تم التسليم | stage `Delivered` |

A helper `passengerTimeline(case, delivery)` in `src/lib/passenger/view.ts` returns `{ steps, currentIndex }`. All other statuses (Storage, QR, Failed retries, etc.) are hidden from the passenger. No new workflow statuses.

## 4. Remove driver tracking

Delete map / driver-location / vehicle / route-progress blocks from `passenger.tsx`. Replace with `ExpectedDeliveryCard`: large glass card, IAB navy gradient border, text:

> **Expected Today**
> **متوقع اليوم**
> Our delivery partner will contact you shortly.
> سيتواصل معك مندوب التسليم قريباً.

Shown while stage ∈ {Assigned, Driver Accepted, Collected, Out for Delivery}. No time, no ETA, no countdown.

## 5. OTP card redesign

Single hero card, fits mobile viewport without scroll on typical phones:

- Large 4-digit OTP in Instrument Serif, letter-spaced, with subtle pulse animation on the active digit
- Copy button (haptic-style press animation)
- Bilingual sub-label: "Show this code to the driver / أظهر هذا الرمز للسائق"
- Compact bilingual checklist (all 4 items, both languages, equal type size):
  1. I verified my baggage tag numbers. / لقد تحققت من أرقام بطاقات الأمتعة.
  2. I confirmed the baggage is sealed and in good condition. / أؤكد أن الأمتعة مختومة وبحالة جيدة.
  3. I will provide the OTP only after receiving my baggage. / لن أشارك رمز التحقق إلا بعد استلام الأمتعة.
  4. No employee requested money, tips, or unofficial payment. / أؤكد أنني لم أتعرض لأي طلب أموال أو إكراميات أو أي مدفوعات غير رسمية.
- Primary CTA: **Confirm Baggage Received / تأكيد استلام الأمتعة** (disabled until all 4 checked)

Checklist items use `<Bi>` with `dir="rtl"` on Arabic line; both lines share the same font size (14–15px) and line-height.

## 6. Confirm → Feedback flow

Confirm button handler:
1. Fire existing store confirmation (already marks delivered when OTP verified upstream — no new status).
2. Play a 900ms success overlay (`DeliveredCelebration`): IAB logo fades in, checkmark strokes, subtitle "Delivered / تم التسليم".
3. `router.navigate({ to: "/feedback", search: { bagId } })` — no refresh, framer-motion `AnimatePresence` handles the transition.

## 7. Feedback redesign

Rewrite `src/routes/feedback.tsx`:
- Read `?bagId=` from search; pre-select the case; hide the picker when provided.
- Hero: IAB logo, "How was your delivery? / كيف كانت تجربتك؟"
- Large 5-star control (48px stars, spring animation on tap)
- Yes/No resolved as pill toggle
- Comments textarea with floating label
- Submit → animated **Thank You** screen: IAB logo, checkmark, "شكراً لك — Thank you", auto-dismiss to `/` after 4s.
- Existing `addFeedback` store call unchanged.

## 8. Loading & transitions

- Premium skeleton (`LoadingSkeleton`) shown during initial hydration and while `useStore` selectors resolve — replaces the plain "Loading your delivery…" in `passenger.$token.tsx`.
- Route-level `AnimatePresence` in `passenger.tsx` for stage transitions (fade + subtle slide).
- Reduced-motion respected via `prefers-reduced-motion`.

## 9. Branding hooks

`BrandHeader` reads logo from `@/assets/iab-logo.jpeg.asset.json` (already present). All colors flow from CSS tokens, so a future brand refresh only touches `styles.css`. No hardcoded brand strings duplicated — a small `src/lib/passenger/brand.ts` centralizes tagline + support phone.

## 10. Workflow integrity checklist

- No new fields on Case/Delivery.
- No new workflow statuses.
- No local status state in passenger components — all reads through `useStore` selectors + `getDeliveryStage`.
- Confirmation reuses the existing "passenger confirms received" store action (already wired to Workflow/Timeline/Audit/Notifications).
- Removed: driver coordinates, `navigationHref`, ETA fields from the passenger tree only (Driver Portal keeps them).

## Files touched

Rewritten:
- `src/routes/passenger.tsx`
- `src/routes/feedback.tsx`
- `src/routes/passenger.$token.tsx` (skeleton only)
- `src/styles.css` (tokens + font imports via head link, not @import)
- `src/routes/__root.tsx` (font `<link>` tags only)

New:
- `src/components/passenger/*` (8 files above)
- `src/lib/passenger/view.ts` (timeline projection)
- `src/lib/passenger/brand.ts`

Untouched: store, workflow engine, notifications, OTP logic, driver portal, delivery module, L&F.

## Out of scope (deferred)

- Warehouse Operations (explicit).
- Additional brand assets beyond current IAB logo — code is token-driven so drop-in swap is a one-liner.
- Native app / push notifications.

Ready to implement on approval.
