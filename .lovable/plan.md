Final visual refinement for the Passenger Portal only.

Scope
- File: `src/routes/passenger.tsx`
- No layout, typography, animation, icon, or workflow changes.
- Only white-card surface treatment and color-system consistency.

Changes
1. Card color system
   - Welcome Card: background -> pure white (`#FFFFFF`).
   - Timeline Card (`SimpleTimeline`): background -> pure white (`#FFFFFF`).
   - Contact Cards: keep white; unify with the same glass treatment.
   - Current Status Card (`StatusHero`) and OTP Card (`OtpHeroCard`): keep existing navy gradient; no color changes.

2. iPhone glass treatment for every white card
   Apply a subtle, consistent glass style to Welcome, Timeline, and Contact cards:
   - soft white background
   - very light border (navy-tinted at very low opacity)
   - gentle `backdrop-blur`
   - soft layered shadow
   - premium glossy reflection via a subtle top/left radial light wash
   - smooth rounded corners (preserve existing radii)
   No glassmorphism exaggeration; effect stays minimal and premium.

3. Consistency
   - White cards: Welcome, Timeline, Contact.
   - Navy cards: Current Status, OTP Verification.
   - All cards share the same rounded-corner language, border weight, and shadow family so they feel like one Apple-inspired product.

4. Implementation approach
   - Introduce a scoped helper class/inline style pattern inside `src/routes/passenger.tsx` (or a lightweight CSS utility in `src/styles.css`) named e.g. `iab-white-glass` that composes the above properties.
   - Apply it to `WelcomeCard`, `SimpleTimeline`, and the `ContactCard` tiles.
   - Remove/adjust any existing ivory/ivory-soft backgrounds or conflicting shadows on those three components.

5. Verification
   - Run TypeScript typecheck.
   - Capture preview screenshots of the Passenger Portal to confirm Welcome, Timeline, and Contact cards read as white glass while Status and OTP cards remain navy.
