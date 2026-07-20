Scope: `src/routes/passenger.tsx` only. No layout, spacing, typography, animation, icon, or workflow changes.

Header (`BrandHeader`)
- Increase IAB logo from 48px to ~60px (25% larger).
- Remove the "Official Airport Service" English subtitle and its Arabic translation.
- Increase "IAB Baggage Delivery Service" font size by ~20% (from 14/15px to ~17/18px).
- Vertically center the title block with the logo so both sit on the same visual axis using `items-center`.
- Keep the header clean: only logo + title remain.

Status & OTP Cards
- Keep existing navy design, animations, icons, rounded corners, card sizes, and typography.
- Lighten the navy background variable (`--iab-navy-card`) by ~10–15%, moving from `#081C3A` toward a slightly softer navy that still reads premium (e.g., `#0B2247` or `#0C2440`).
- Apply the new color consistently to both `StatusHero` and `OtpHeroCard` backgrounds.

Verification
- Run TypeScript typecheck.
- Capture preview screenshots of the Passenger Portal to confirm the header is minimal and the navy cards are slightly lighter while retaining their premium identity.