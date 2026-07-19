Scope: `src/routes/passenger.tsx` only. No workflow, typography, color palette, spacing, or Status Card layout changes.

### 1. Header — logo on bare white background
- In `BrandHeader`, remove the rounded ivory container (`rounded-xl bg-[color:var(--iab-ivory-soft)] ring-1 ...`) that currently wraps the `<img>` logo.
- Render the `<img>` logo directly against the white header background, with no card, border, shadow, or separate container.
- Keep the logo dimensions at 48×48 and the existing `object-contain` treatment.
- Preserve the text block exactly as-is:
  - "IAB Baggage Delivery Service"
  - "Official Airport Service"
  - "خدمة رسمية معتمدة بالمطار"

### 2. Welcome Card — add a single "Welcome" greeting
- Above the existing passenger name (`Hassan El-Shenawy`), insert a single "Welcome" line using the same Passenger Portal typography (`var(--font-passenger-display)`).
- Use normal font weight, no italics.
- Do not duplicate the passenger name; the name remains exactly once below "Welcome".
- Leave the message copy, Flight/PIR/Bag Tag meta strip, spacing, colors, card background, and animation unchanged.

### 3. Current Status Card — remove decorative dot pattern
- Remove the dot-pattern overlay in `StatusHero` (the `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)` block with `backgroundSize: "22px 22px"` and `maskImage`).
- Keep the navy gradient background exactly as-is (`linear-gradient(180deg, #0B2247 0%, #081C3A 55%, #050F24 100%)`).
- Keep the gold hairline top border, the soft light-wash radial gradient (already identical to the OTP card), the rounded card shape, the suitcase animation, and all typography/layout.
- Result: the Status Card and OTP Card share the same clean, solid navy treatment.

### Verification
- Read back the edited JSX to confirm the logo container is removed, the Welcome greeting is inserted without duplicating the name, and the dot-pattern block is deleted while tag balance remains intact.
- Run project typecheck.
- No other components, styles, business logic, or routes touched.