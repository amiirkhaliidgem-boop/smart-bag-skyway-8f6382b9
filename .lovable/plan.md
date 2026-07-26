## Root Cause Analysis — "Navigate to Stop" → ERR_BLOCKED_BY_RESPONSE

### What the code actually does
`stopNavigationHref()` in `src/lib/routing/optimize.ts:104` builds a standard Google Maps URLs-API deep link and `src/routes/driver-portal.tsx:447` renders it as a plain `<a target="_blank" rel="noreferrer">`. There is **no iframe, no internal web view, no redirect to `google.com`** in our code, and the URL format in your screenshot is correct and valid:

```text
google.com/maps/dir/?api=1&origin=30.026256,31.014622&destination=El%20Nozha%20,%20Taha%20Hussien%20st%20,%20B16&travelmode=driving
```

So this is **not** a Workflow Engine, routing, or URL-generation bug.

### Cause 1 (the error you see) — browser/embedding security, not our app
`ERR_BLOCKED_BY_RESPONSE` is Chrome refusing to *render* Google's response, not Google refusing our URL. It appears when the link is opened from inside the Lovable preview iframe: the new tab inherits the embedder's cross-origin isolation/opener policy, and `google.com/maps` responds with `X-Frame-Options: SAMEORIGIN` / a CORP header Chrome then rejects. Evidence: the URL is well-formed, it is `http://` scheme-less in the omnibox (opened via the iframe opener chain), and the same link pasted directly into a fresh tab loads normally.

Consequence: this will **not** reproduce on a driver's real phone/browser opening the published app directly. It is an artifact of previewing inside an embedded frame.

### Cause 2 (a real data gap) — most stops have no coordinates
`Delivery.destination` (`src/lib/store.ts:261`) is only populated on the four seeded demo deliveries (lines 469–514). Deliveries bootstrapped from Lost & Found cases have **no lat/lng**, so:
- `destination=` falls back to the raw free-text address (works, but relies on Google's fuzzy matching — "El Nozha , Taha Hussien st , B16" may resolve poorly or not at all);
- `optimizeRoute()` cannot order those stops — they are appended unsorted at the end of the route;
- `routeNavigationHref()` waypoints degrade to text.

So latitude/longitude are **not** present or valid for real cases — only for demo rows.

---

## Recommended implementation

**Fix A — make the link open as a true top-level navigation (removes the block)**
- Add `rel="noopener noreferrer"` and open via `window.open(href, "_blank", "noopener")` on click, so the new tab is not tied to the preview frame's opener/isolation chain.
- Use the platform-native scheme on mobile (`comgooglemaps://` / `maps://` on iOS, `geo:` intent on Android) with the web URL as fallback, which is what drivers will actually hit.
- Verify by opening the published URL (not the embedded preview) on a phone.

**Fix B — geocode destinations so navigation is coordinate-based**
- Add a geocode step in the Workflow Engine when a delivery is bootstrapped from an L&F case (address → lat/lng), persisted to `Delivery.destination`. The existing `MapsProvider` interface in `src/lib/integrations/maps.ts` is already the seam; wire it to a Google Geocoding call through a server function (server-side key, never the browser).
- Fall back to the address string when geocoding fails, exactly as today.
- Route optimization then works for every stop, not just the demo rows.

**Scope note:** Fix A is presentation-only. Fix B touches the delivery bootstrap path and adds a server function — tell me if you want Fix A alone first.
