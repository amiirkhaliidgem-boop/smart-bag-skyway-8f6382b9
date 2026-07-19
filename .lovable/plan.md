## Plan: Passenger Portal Refinements Only

Scope: `src/routes/passenger.tsx`. No workflow, route, or Status Card redesign changes. Only the listed visual tweaks.

### 1. Page Background
- Change the root container background from the ivory/navy radial gradient to pure `#FFFFFF`.
- Remove the header's bottom border so the white header and white page read as one continuous surface.

### 2. Header
- Keep logo, "IAB Baggage Delivery Service", and "Official Airport Service / خدمة رسمية معتمدة بالمطار".
- Header remains non-sticky and scrolls with the page.
- Confirm no demo indicators remain in this file.

### 3. Welcome Card
- Reduce card height by ~25% by tightening padding (e.g., `py-7 sm:py-9` instead of `py-10 sm:py-12`) and reducing internal margins.
- Remove the "Good Morning / صباح الخير" greeting row and the Arabic "أهلاً بك، {name}" line so the passenger name appears exactly once.
- Keep the large passenger name as the sole heading.
- Remove all `fontStyle: "italic"` and decorative styling from the welcome message.
- Use normal font weight throughout the card.
- Replace the message with:
  - EN: `Your baggage is safely with the IAB Baggage Team.`
  - AR: `امتعتك بأمان بعهدة فريق IAB.`
- Leave Flight / PIR / Bag Tag meta strip unchanged.

### 4. Current Status Card
- Do not change the card's navy gradient, layout, gold hairline, or floating animation.
- Increase suitcase container width by ~20% (e.g., `w-36 sm:w-56 md:w-60`).
- Keep the same `iab-float` animation speed.
- Center the Arabic subtitle (`heroCopy.ar`) directly under the English status title.
- In the Expected section, show only `Today`; remove the Arabic `متوقع اليوم` line.

### 5. General Guardrails
- Do not touch typography, colors, animations, or spacing outside the specific elements above.
- Do not modify `OtpHeroCard`, `ContactCard`, `FeedbackScreen`, `ThanksScreen`, `PortalFooter`, `EmptyState`, store calls, or route definition.
- Verify by visually inspecting the Passenger Portal preview after changes.