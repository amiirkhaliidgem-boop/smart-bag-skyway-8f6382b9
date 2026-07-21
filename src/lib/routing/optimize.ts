// Route Optimization Engine
// Backend service — drivers never see or configure this. Given a set of
// deliveries assigned to a driver, returns the optimal visit order
// starting from Cairo International Airport, using nearest-neighbor over
// haversine distance between each stop's destination coordinates.
//
// This is intentionally provider-agnostic. Wiring a Google Directions /
// Distance Matrix / Routes API is a drop-in replacement of `orderStops`
// — signature stays the same, callers (Driver Portal) do not change.

import type { Delivery } from "../store";

// Deprecated fallback. The station origin is configurable in Settings ›
// Airport and read from the store; this constant is kept only so legacy
// call sites still compile. New code must pass an explicit origin.
export const AIRPORT_ORIGIN = {
  lat: 30.1219,
  lng: 31.4056,
  label: "Station",
} as const;

export interface LatLng {
  lat: number;
  lng: number;
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Optimize a driver's remaining stops starting from the airport.
// Deliveries without destination coordinates are appended at the end in
// input order — they still appear in the route but cannot be optimized
// without geocoding.
export function optimizeRoute<T extends Delivery>(
  deliveries: T[],
  origin: LatLng = AIRPORT_ORIGIN,
): T[] {
  const geo: T[] = [];
  const nogeo: T[] = [];
  for (const d of deliveries) {
    if (d.destination && Number.isFinite(d.destination.lat) && Number.isFinite(d.destination.lng)) {
      geo.push(d);
    } else {
      nogeo.push(d);
    }
  }
  const remaining = [...geo];
  const ordered: T[] = [];
  let cursor: LatLng = origin;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dest = remaining[i].destination!;
      const dist = haversineKm(cursor, dest);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    cursor = next.destination!;
  }
  return [...ordered, ...nogeo];
}

// Build a Google Maps navigation URL for a single stop. Origin is omitted
// so Google Maps uses the driver's current device location — the driver is
// rarely still at the airport by the time they open navigation.
export function navigationHref(d: Delivery): string {
  if (d.destination) {
    return `https://www.google.com/maps/dir/?api=1&destination=${d.destination.lat},${d.destination.lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.address)}&travelmode=driving`;
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