## Passenger Portal — Targeted Refinements

Scope: `src/routes/passenger.tsx` only. No workflow, typography, Welcome Card, or Status Card layout changes.

### 1. OTP Card — remove Copy button
- Delete the `<button onClick={copyCode}>` "Copy" element and its wrapping `<div className="mt-3 flex items-center justify-center">` (lines ~927–935).
- Remove the now-unused `copyCode` handler and the `Copy` icon import (line 27) if not referenced elsewhere.
- Four large OTP digits remain untouched.

### 2. Confirmation Button — single-line bilingual, mobile-safe
- Replace the button label `Confirm Baggage Received · تأكيد استلام الأمتعة` with `Baggage Received • تم الاستلام`.
- Keep the button height (`h-14`) and existing styling.
- Add `whitespace-nowrap` and `text-center` on the button; wrap the label in a `<span>` with `whitespace-nowrap` to prevent wrapping on narrow viewports.
- Keep the leading `PackageCheck` icon; ensure `justify-center` remains so the label reads perfectly centered.

### 3. Support Section — strip header, rename Call tile
- Remove the entire header row (lines ~1091–1108) containing `Support`, `المساعدة والدعم`, and `24 / 7`. The section starts directly with the 3-tile grid.
- In the `tiles` array, change the first tile:
  - `en: "Call Us"`
  - `ar: "اتصل بنا"`
  - Keep `href` and `value` unchanged.
- WhatsApp and Email tiles untouched.

### 4. Color Consistency — unify navy across Status, OTP, and Contact icons
- Status Card and OTP Card already share the same navy gradient (`linear-gradient(180deg, #0B2247 0%, #081C3A 55%, #050F24 100%)`) — leave both as-is.
- Update the Contact tile icon chip (line ~1139) from `background: "var(--gradient-iab-hero)"` to the same navy gradient string, so all three surfaces share the identical navy treatment. No new token created.

### Verification
- Read the file back after edits to confirm imports are clean (no unused `Copy`) and JSX balance is intact.
- Run project typecheck.
- No other components, styles, or logic touched.
