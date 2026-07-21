# In-page PIR printing (remove `/print/pir` route)

Replace the new-tab print flow with an in-page print that renders the existing `PirReport` into a hidden portal, calls `window.print()` from the current page, and cleans up after `afterprint`. Keeps `PirReport` and print CSS unchanged.

## New files

### `src/components/lost-found/pir-print-host.tsx`

A single mount-once component + tiny event bus.

- Module-level bus: `pirPrintBus.print(bagIds: string[])` fires an event.
- `PirPrintHost` subscribes on mount, resolves cases from the store (`useStore((s) => s.cases)`), and stores `casesToPrint` in local state.
- When `casesToPrint` is non-empty:
  1. Render a React portal (`createPortal(..., document.body)`) with class `pir-print-portal` containing `<PirReport caseRecord={c} />` for each case, separated by `pir-page-break`.
  2. In `useLayoutEffect` after paint (`requestAnimationFrame` → `setTimeout(0)` fallback), call `window.print()`.
  3. Wire `window.addEventListener("afterprint", cleanup)` (and a safety `onbeforeunload`) → `setCasesToPrint([])`.
- If any requested id is missing, toast and skip.
- No new store dependencies; reuses existing `PirReport`.

## CSS additions in `src/styles.css`

Add next to the existing `@media print` block:

```css
/* Off-screen but rendered so window.print() can capture it */
.pir-print-portal {
  position: fixed;
  inset: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
  background: #fff;
}

@media print {
  /* Hide the live app; only the portal prints */
  body > *:not(.pir-print-portal) { display: none !important; }
  .pir-print-portal {
    position: static;
    opacity: 1;
    pointer-events: auto;
    z-index: auto;
    overflow: visible;
  }
}
```

No changes to `.pir-shell`, `.pir-print`, or `.pir-page-break`.

## Wire-up

### `src/routes/lost-found.$bagId.tsx`
- Replace the body of `printPir()`:
  ```ts
  function printPir() { pirPrintBus.print([c!.bagId]); }
  ```
- Import `pirPrintBus` and mount `<PirPrintHost />` once in the route's returned JSX.

### `src/routes/lost-found.index.tsx`
- Replace the bulk-print handler (line 278-280) with:
  ```ts
  pirPrintBus.print(selectedIds);
  ```
- Import `pirPrintBus` and mount `<PirPrintHost />` once in the route's returned JSX.

No `window.open`, no navigation, no target `_blank`.

## Deletions

- Delete `src/routes/print.pir.tsx` (route file). TanStack's route plugin will regenerate `routeTree.gen.ts`.
- Revert the `isPublicPath` whitelist entry for `/print/` in `src/routes/__root.tsx` (added in the previous fix) — the route no longer exists.
- Leave the `pathname.startsWith("/print/") ? <Outlet /> : <AppShell />` branch in `__root.tsx` in place (harmless dead branch) OR remove it — will remove for cleanliness since it's a single line.

## Untouched

- `src/components/lost-found/pir-report.tsx` (PIR template) — unchanged.
- `.pir-shell` / `.pir-print` / `.pir-page-break` styles — unchanged.
- Workflow Engine, Lost & Found logic, RBAC — unchanged.

## Verification

- Single-case: L&F case → Print PIR → dialog appears with the current PIR; on cancel/print, UI restores.
- Bulk: L&F registry → select multiple → Print PIR → single print job with one page break per case.
- No new tab, no navigation, no URL change, no auth redirect.
