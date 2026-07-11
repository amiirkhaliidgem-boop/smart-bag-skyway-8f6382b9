// Opaque tracking tokens for passenger-facing links. Tokens map 1:1 to a
// delivery record and are the only credential a passenger needs to view
// their live tracking page (no login). Rotate by regenerating.

function random(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  }
  // Fallback (SSR without web crypto) — deterministic enough for a token.
  let out = "";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function generateTrackingToken(deliveryId: string): string {
  // Prefix helps humans spot the record source; the random suffix is the
  // actual secret.
  return `${deliveryId.toLowerCase().replace(/[^a-z0-9]/g, "")}-${random()}`;
}

export function buildTrackingUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/passenger/${token}`;
}