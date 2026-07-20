Scope: `src/routes/passenger.tsx` only. No workflow, backend, routing, or logic changes.

## 1. Feedback Card — Navy Glass redesign (match OTP)
Rebuild `FeedbackScreen` container to mirror `OtpHeroCard`:
- Same navy gradient background (`linear-gradient(180deg,#0E2C5C,#0A2248,#06142E)`), rounded-3xl, same padding (`p-6 sm:p-8`), same softened shadow, same overflow-hidden shell.
- Header block matches OTP: small uppercase eyebrow "Feedback · تقييم" in `text-white/70`, display title `text-white`, Arabic subline in `text-white/80`.
- Body text (`RatingRow` labels, `YesNoRow`, Comments label) switched to white / white-alpha tones.
- Textarea → `bg-white/6 border-white/10 text-white placeholder-white/50 backdrop-blur`.
- Yes/No pill group → white-alpha border + selected pill on white/15 background matching OTP option style.
- Stars → white filled (`fill-white text-white`) for selected, `text-white/30` unselected — keep same size on desktop, smaller on mobile (see §2).
- Submit button → white pill on navy (`bg-white text-[color:var(--iab-navy)]`) matching OTP verify button style; same `h-14 rounded-2xl`.

## 2. Mobile responsiveness fix (Feedback only, desktop unchanged)
- `RatingRow`: replace `flex flex-wrap justify-between` with `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3`; add `min-w-0` on the label block; stars use `h-6 w-6 sm:h-8 sm:w-8` with `p-1 sm:p-1.5`; wrap star row in `shrink-0`.
- `YesNoRow`: same grid pattern; pill group `shrink-0`.
- Comments label + Textarea already stack; ensure Textarea is `w-full` and container has no fixed widths.
- Confirm outer card uses `px-4 sm:px-6` alignment already provided by the page container; no horizontal overflow.

## 3. Reduce elevation on Status + OTP cards
Soften shadows only (keep gradient colors and radius):
- `StatusHero` and `OtpHeroCard` shadow → `0 20px 50px -30px rgba(8,28,58,0.45), 0 8px 20px -14px rgba(8,28,58,0.18)` (down from current heavier stack).
- Remove/soften any inner glow rings if they contribute to heaviness (keep animation).

## 4. Reduce inter-card spacing
In the main portal stack (line ~240):
- Change `space-y-6 sm:space-y-8` → `space-y-4 sm:space-y-5` so Welcome → Status → Timeline feel connected but not touching.

## 5. Constraints
- No changes to `WelcomeCard` internals, `SimpleTimeline` visuals, `BrandHeader`, `ContactCard`, animations, translations, icons, or handlers.
- No edits outside `src/routes/passenger.tsx` and (if needed for shadow token) no CSS file changes — apply shadow inline on the two cards.
- Verify with a typecheck and a mobile-viewport screenshot of the Feedback screen after delivery.
