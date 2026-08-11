// Airlines are identified by their 3-letter ICAO designator (ABY, ADY, RBG).
// This is the single validation/normalisation point — PIR intake and bulk
// import both use it, so the same authoritative code flows through the case,
// the delivery, the POD and every report.

const RX_ICAO = /^[A-Z]{3}$/;

export function normalizeIcaoAirline(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function isIcaoAirline(value: unknown): boolean {
  return RX_ICAO.test(normalizeIcaoAirline(value));
}

export function icaoAirlineError(value: unknown, label = "Airline"): string | null {
  const v = normalizeIcaoAirline(value);
  if (!v) return `${label} is required.`;
  if (isIcaoAirline(v)) return null;
  return `${label} must be the 3-letter ICAO code (letters only, e.g. ABY).`;
}