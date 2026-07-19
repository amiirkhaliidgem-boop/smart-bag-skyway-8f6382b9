
## Scope

Visual refinement only in `src/routes/passenger.tsx`. No changes to business logic, backend, workflow, routing, or state. Animations preserved except where explicitly noted (suitcase size + kept floating).

---

## 1. `BrandHeader` — white, non-sticky, elegant

Rewrite the header (lines ~160–232):

- Remove `sticky top-0 z-40`, scroll listener, and `scrolled` state → static header that scrolls away with the page.
- Background: solid white (`#FFFFFF`). Remove aurora gradient overlay and box shadow.
- Layout (single row, left-aligned):
  - **Left**: IAB logo (~48px, subtle 1px ivory ring, no heavy shadow).
  - **Right of logo**: two-line block
    - Line 1 (title): `IAB Baggage Delivery Service` — Manrope, medium, navy.
    - Line 2a (eyebrow, small): `Official Airport Service` — uppercase micro tracking, navy/60.
    - Line 2b (Arabic): `خدمة رسمية معتمدة بالمطار` — Arabic display, navy/60.
- Remove the right-side "Secure" pill.
- Bottom hairline: 1px `color-mix(#0B1B3B 8%, transparent)` for quiet separation.

## 2. Remove Demo indicators

- Delete `DemoSwitcher` component and its usage in `PassengerPortal` (lines ~118–128, ~234–261).
- Passenger sees their own delivery immediately (selection logic in `useState(selectedId)` already picks the active delivery — untouched).

## 3. `WelcomeCard` — quieter, ~35% shorter

In the section at lines ~445–595:

- Padding: `px-6 py-16 sm:px-12 sm:py-20` → `px-6 py-10 sm:px-10 sm:py-12`.
- Remove the "IAB Concierge · Cairo" eyebrow (lines ~479–485).
- Remove top gold divider ornament (lines ~459–477) to reduce vertical height further and keep it minimal.
- Passenger name (`h1`): reduce from `clamp(2.75rem, 9vw, 4.75rem)` → `clamp(1.85rem, 5.5vw, 2.75rem)`, weight 400, tighter margin-top.
- Arabic greeting line spacing tightened (`mt-6` → `mt-4`, `mt-8`→`mt-6`).
- Welcome message copy replaced:
  - EN: `Your baggage is safely with the IAB Baggage Team.`
  - AR: `أمتعتك بأمان بعهدة فريق IAB.`
- Meta strip (Flight · PIR · Bag Tag): unchanged content and styling, only reduce `mt-10` → `mt-8`.

## 4. `StatusHero` — minimal change

- Suitcase container width: `w-28 sm:w-40 md:w-44` → `w-32 sm:w-48 md:w-52` (~20% larger).
- Keep `iab-float` animation, navy gradient, gold hairline, typography, layout.

## 5. `SimpleTimeline` — remove title, tighter top

In the block at lines ~830–866:

- Delete the header row containing `Your Journey` / `رحلتك` and its `mb-7` wrapper.
- Reduce container top padding: `p-7 sm:p-9` → `pt-5 pb-7 px-7 sm:pt-6 sm:pb-9 sm:px-9`.
- Increase horizontal spacing between dot and text: `gap-4` → `gap-6`, and adjust rail `left-[5px]` accordingly so the vertical rail still passes through dot centers.
- All step derivation and reached/current logic untouched.

---

## Out of scope (unchanged)

`OtpHeroCard`, `ContactCard`, `FeedbackScreen`, `ThanksScreen`, `PortalFooter`, workflow calls (`updateDelivery`, `addFeedback`, etc.), Arabic bilingual helpers, store selectors, route definition.
