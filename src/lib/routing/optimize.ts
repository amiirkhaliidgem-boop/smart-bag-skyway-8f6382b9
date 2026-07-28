// Navigation deep links for the Delivery Agent Portal.
//
// Route *optimization* itself lives in the Workflow Engine
// (`wf_recompute_route` in PostgreSQL); the client only turns the stop
// order the engine already computed into Google Maps URLs. The former
// client-side nearest-neighbour optimizer was removed so no module can
// compute a competing route order.

import type { Delivery } from "../store";

export interface LatLng {
  lat: number;
  lng: number;
}

// ---- Deep-link builders that expose the Workflow-Engine-computed route
// to Google Maps. Origin is always the origin the engine used (driver GPS,
// last completed stop, or station) so the app never delegates routing
// decisions to Google Maps itself. -----

function fmt(p: LatLng): string {
  return `${p.lat},${p.lng}`;
}

function destParam(d: Delivery): string {
  return d.destination
    ? fmt(d.destination)
    : encodeURIComponent(d.address);
}

// Single-leg navigation from a known origin to one stop.
export function stopNavigationHref(origin: LatLng, d: Delivery): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${fmt(origin)}&destination=${destParam(d)}&travelmode=driving`;
}

// Full multi-stop navigation. Google Maps URLs API supports up to 9
// waypoints between origin and destination; overflow stops are dropped
// from this deep link (caller can chunk if needed).
export const MAX_WAYPOINTS = 9;

export function routeNavigationHref(
  origin: LatLng,
  stops: Delivery[],
): string | null {
  if (!stops.length) return null;
  const last = stops[stops.length - 1];
  const mid = stops.slice(0, -1).slice(0, MAX_WAYPOINTS);
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("origin", fmt(origin));
  params.set("destination", destParam(last));
  params.set("travelmode", "driving");
  if (mid.length) {
    params.set(
      "waypoints",
      mid
        .map((d) => (d.destination ? fmt(d.destination) : d.address))
        .join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}