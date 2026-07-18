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

export const AIRPORT_ORIGIN = {
  lat: 30.1219,
  lng: 31.4056,
  label: "Cairo International Airport",
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
  originOverride?: LatLng,
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
  let cursor: LatLng = originOverride ?? AIRPORT_ORIGIN;
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