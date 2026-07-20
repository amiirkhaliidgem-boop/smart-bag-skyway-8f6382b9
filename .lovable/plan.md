## Scope
Only `src/routes/passenger.tsx`. No backend, routing, business logic, or other pages touched.

## Changes

### 1. Feedback card header
- Remove the Arabic label `· تقييم` next to "Feedback".
- Result: header reads only `FEEDBACK`.

### 2. Rating stars
- Remove the glow/bloom drop-shadow on selected stars (`drop-shadow-[0_4px_10px_rgba(255,255,255,0.25)]`).
- Keep selected stars as clean solid white fills (`fill-white text-white`) exactly like native SF Symbols.
- Unselected stars remain `text-white/30`.

### 3. OTP "Baggage Received" button
- Keep existing white background, navy text, size, typography, and `active:scale-[0.99]` press behavior.
- Remove outer glow / excessive shadow (`shadow-[0_18px_40px_-12px_rgba(255,255,255,0.45)]`).
- Remove `hover:brightness-105` bloom effect.
- Disabled state stays unchanged.

### 4. "Submit Feedback" button
- Keep existing white background, navy text, size, typography, and functionality.
- Remove `hover:brightness-105` and `shadow-[0_18px_40px_-12px_rgba(255,255,255,0.35)]` so there is no dark highlight, glow, glossy pre-selected state, or color shift before interaction.
- Retain only a subtle press feedback (`active:scale-[0.99]`), consistent with the OTP button.

## Verification
- Run `bunx tsc --noEmit` or project typecheck to confirm no TS errors.
- Visually inspect the Passenger Portal Feedback and OTP screens in the preview to confirm all glow effects are gone and buttons look minimal/premium.