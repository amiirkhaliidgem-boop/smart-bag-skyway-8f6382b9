## Goal

Make the existing Driver Portal bilingual (English / العربية) with a language switch and RTL support — one shared codebase, no duplicated components, no engine changes.

## Current state

`src/routes/driver-portal.tsx` (521 lines) has all UI text hardcoded in English across: sign-in card, header, 3 KPI cards, Today's Route card (GPS badge states, origin label, stop counter, empty state, Navigate Full Route), delivery cards (Current stop, priority chip, Navigate to Stop, Accept, Collect Bag, Start Delivery, Complete with OTP, Delivered), Completed section + empty state, OTP dialog, and 7 toast messages. Route optimization, GPS reporting, and all stage transitions live in `src/lib/store.ts` / `src/lib/routing/optimize.ts` — none of that is touched.

## Localization layer (new)

`src/lib/i18n/driver.ts`
- A typed `DriverStrings` dictionary shape with `en` and `ar` objects — flat keys, some as functions for interpolation (e.g. `welcome(name)`, `acceptedToast(id)`, `stopsCount(n)`).
- Values that must NOT be translated (passenger name, address, phone, delivery ID, PIR, bag tag, flight/airline) are only ever interpolated as raw data, never keyed.

`src/lib/i18n/driver-language.tsx`
- `DriverLanguageProvider` + `useDriverLang()` hook returning `{ lang, setLang, t, dir }`.
- Language persisted in `localStorage` (`iab.driver.lang`), read in `useEffect` after hydration so SSR output stays stable (default `en`).

## Driver Portal changes

`src/routes/driver-portal.tsx`
- Wrap the page in `DriverLanguageProvider`; the outermost portal `div` gets `dir={dir}` and `lang={lang}` so RTL applies to the portal subtree only (not the whole app shell).
- Add a compact language selector (EN | العربية segmented toggle) in the portal header, and also on the sign-in card so a driver can switch before logging in. Switching re-renders immediately.
- Replace every hardcoded string and toast with `t.*` lookups.
- RTL polish: replace direction-sensitive utilities with logical ones (`ml-auto` → `ms-auto`, `mr-1` → `me-1`, `text-left` → `text-start`) so spacing/alignment mirror correctly. Icons stay as-is except the arrow-like nav icon, which is unmirrored (map/navigation icons are conventionally unmirrored).
- Arabic numerals stay Western (`tabular-nums`) to match stored IDs and OTP entry.
- Status/stage text (Assigned, Out for Delivery, Delivered, priority Normal/VIP) is translated for display only; the underlying stage values from the workflow engine are unchanged.

Roughly 40 UI strings translated (labels, buttons, badges, empty states, dialog, toasts).

## Explicitly unchanged

`src/lib/store.ts`, `src/lib/routing/optimize.ts`, notification/timeline/audit engines, database, and all other routes. No schema, RPC, or API edits.

## Verification

Load `/driver-portal`, sign in, switch to العربية: header, KPIs, route card, stop actions, and dialogs render in Arabic RTL while names/addresses/IDs/tags stay as stored; toggle back to English and confirm layout returns to LTR.
