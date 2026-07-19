## Scope

Revert the global font tokens back to what the rest of the system used before, and scope the Space Grotesk / IBM Plex Sans Arabic change to the Passenger Portal only.

## Changes

1. `src/styles.css`
   - Restore the original system typography tokens:
     - `--font-display` → Fraunces (editorial serif, as before)
     - `--font-heading` / `--font-sans` → Manrope / Inter stack (previous system fonts)
     - `--font-arabic` / `--font-arabic-display` → previous Arabic pairing (Reem Kufi / Noto Naskh Arabic)
   - Add Passenger-only tokens: `--font-passenger`, `--font-passenger-arabic` mapped to Space Grotesk + IBM Plex Sans Arabic.
   - No color, layout, or animation changes.

2. `src/routes/__root.tsx`
   - Extend the Google Fonts `<link>` to load both sets: the restored system fonts (Fraunces, Manrope, Inter, Reem Kufi, Noto Naskh Arabic) AND Space Grotesk + IBM Plex Sans Arabic for the portal.

3. Passenger Portal surfaces only (`src/routes/passenger.tsx`, `src/routes/passenger.$token.tsx`, `src/components/passenger/*`)
   - Apply Space Grotesk / IBM Plex Sans Arabic via a scoped wrapper (e.g. `font-[var(--font-passenger)]` on the portal root and `[&_[dir=rtl]]:font-[var(--font-passenger-arabic)]` or on the `Bi` Arabic side).
   - Remove any leftover explicit Fraunces/serif class usage inside portal components so the portal reads as pure Grotesk.
   - Keep sizes, weights, spacing, and layout exactly as they are today.

## Out of scope

- Dispatcher, Driver Portal, L&F, Warehouse, Admin, Auth, etc. — these go back to the fonts they had before the last change.
- Workflow, data, colors, animations, copy.

## Verification

- Load `/passenger/<token>` → all text (English + Arabic) renders in Space Grotesk / IBM Plex Sans Arabic.
- Load `/`, `/lost-found`, `/delivery`, `/driver-portal`, `/auth` → typography matches the pre-Grotesk system look (Fraunces display, Manrope/Inter body).
