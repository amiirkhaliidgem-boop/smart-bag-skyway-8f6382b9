## Goal

Storage Control (`/storage`) and QR Scan (`/qr-scan`) show the exact same "Coming Soon" screen as Contact Center Operations, with zero code loss and one-line reactivation later.

## Approach

Mirror the pattern already used by Contact Center: the full module lives in its own component file (`contact-center-full.tsx`), and the route renders the Coming Soon component instead. Nothing is deleted.

### 1. Make the Coming Soon screen reusable

`src/components/contact-center/contact-center-coming-soon.tsx` currently hardcodes the Contact Center title. Promote it to a shared component (`src/components/module-coming-soon.tsx`) taking `title`, `subtitle`, and an optional icon, with identical markup/styling. `ContactCenterComingSoon` keeps working by delegating to it, so Contact Center renders pixel-identically.

### 2. Preserve the existing module code

- Move the current Storage Control page body into `src/components/warehouse/storage-control-full.tsx`.
- Move the current QR Scan page body into `src/components/warehouse/qr-scan-full.tsx`.

Both are moved verbatim — store bindings, `assignStorage`, `updateCase`, dialogs, QR rendering, skeletons all intact. They just stop being imported by the route.

### 3. Routes stay, bodies swap

`src/routes/storage.tsx` and `src/routes/qr-scan.tsx` keep their route definitions and `head()` metadata (descriptions adjusted to "coming in a future release", matching Contact Center). Each renders `<ModuleComingSoon .../>` and carries a commented one-line switch back to the preserved component:

```tsx
// Warehouse phase: swap the line below for <StorageControlFull /> to re-enable.
```

### 4. Untouched by design

- No database, RPC, or migration changes.
- No changes to `src/lib/store.ts`, `assignStorage`, or any Workflow Engine call path.
- No changes to `src/lib/rbac.ts` or `src/lib/admin/modules.ts` — Warehouse and QR permissions stay exactly as they are.
- Navigation entries in `src/components/app-shell.tsx` stay as-is (you asked not to remove them), so both items remain visible and route to the Coming Soon page.

## Validation

After the change I will run a typecheck and drive the running app with a headless browser to confirm:

1. `/storage` renders the Coming Soon card.
2. `/qr-scan` renders the Coming Soon card.
3. `/contact-center` still renders unchanged.
4. Sidebar links for both modules navigate correctly, and Lost & Found / Delivery / Dashboard are unaffected.
5. No console errors; build passes.

## Reactivation later

One line per route: replace `<ModuleComingSoon />` with `<StorageControlFull />` / `<QrScanFull />`. No rebuild, no schema work.
