# Fix `/print/*` redirect

Treat `/print/*` the same way as `/passenger/:token` — a bare, internal utility route that bypasses the staff auth gate and RBAC matrix. The route is only ever opened from an already-authenticated staff session via the Print PIR action, so no additional gating is needed.

## Change

**File:** `src/routes/__root.tsx` (only)

In `isPublicPath(pathname)` add `/print/` to the whitelist:

```ts
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/auth" ||
    pathname.startsWith("/passenger/") ||
    pathname.startsWith("/print/") // internal utility route (PIR print, etc.)
  );
}
```

## Resulting behavior

- `AuthGate` sees `/print/pir` as public → skips the session redirect (line 194) and the RBAC redirect (line 209).
- Line 223 (`if (isPublicPath(pathname)) return <Outlet />`) renders the print route bare, without the AppShell — matching how the Passenger Portal renders.
- `PrintPirPage` mounts, resolves the case, and its existing `useEffect` calls `window.print()` after paint.
- No changes to Workflow Engine, Lost & Found logic, RBAC rules, or the PIR report template.

## Notes

- The existing branch at line 263 (`pathname.startsWith("/print/") ? <Outlet /> : <AppShell />`) becomes dead code for `/print/*` because the public-path branch returns earlier — safe to leave as-is to avoid touching unrelated logic.
- Because `/print/*` is now public, the URL is technically reachable without a session. That mirrors the accepted posture for `/passenger/:token`; the print route reads only client-side store data, so an unauthenticated visitor sees an empty "Loading PIR report…" state and nothing sensitive is exposed.
