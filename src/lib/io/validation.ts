import type { FieldDef, RowIssue } from "./types";

// Airport / airline code reference sets. Extendable via reference tables
// once the ERP integration is in place.
export const KNOWN_AIRPORTS = new Set([
  "CAI", "HRG", "SSH", "LXR", "ASW",
  "JFK", "LHR", "CDG", "FRA", "AMS", "DXB", "DOH", "IST", "JED", "RUH", "MED",
  "AUH", "MCT", "KWI", "BAH", "MUC", "ZRH", "MAD", "BCN", "FCO", "MXP", "ATH",
]);

export const KNOWN_AIRLINES = new Set([
  // Full-service carriers
  "MS", "TK", "EK", "QR", "EY", "SV", "LH", "BA", "AF", "KL", "LX", "IB",
  "AZ", "RJ", "ME", "PC", "OS", "TP", "AY", "SN", "SK", "AC", "UA", "AA",
  "DL", "VS", "IR", "GF", "KU", "OM", "WY", "UL", "AI", "EI", "TG", "SQ",
  "CX", "JL", "NH", "OZ", "KE", "CA", "MU", "CZ", "ET", "KQ", "MK", "SA",
  // Low-cost & regional (incl. Air Arabia G9, flydubai FZ, Wizz W6, etc.)
  "G9", "FZ", "W6", "XY", "NP", "3O", "AH", "HR", "J9", "IX", "6E", "SG",
  "FR", "U2", "VY", "PC", "XQ", "TO", "HV", "DY", "D8", "BT",
]);

const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RX_PHONE = /^\+?[0-9][0-9 ()-]{6,20}$/;
// Egyptian mobile numbers as operators actually type them:
// 01xxxxxxxxx, 0020..., +2010..., with spaces/dashes tolerated.
const RX_EG_MOBILE = /^(?:\+?20|00?20)?0?1[0-25]\d{8}$/;

/** Digits-only view used for local-format checks. */
function phoneDigits(v: string): string {
  return v.replace(/[\s()\-.]/g, "");
}
const RX_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?$/;

// Flexible date parser. Real-world CSVs from Excel/Numbers arrive in many
// formats — the operator should never be blocked because Excel reformatted a
// column on save. We accept the most common formats and normalise to
// canonical YYYY-MM-DD before storing.
function parseFlexibleDate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const build = (y: number, m: number, d: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    return build(+m[1], +m[2], +m[3]);
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    const a = +m[1], b = +m[2];
    // Prefer DD/MM/YYYY (used across EU/MENA); fall back to MM/DD/YYYY
    return build(+m[3], b, a) ?? build(+m[3], a, b);
  }
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/))) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const idx = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (idx >= 0) return build(+m[3], idx + 1, +m[1]);
  }
  return null;
}

export function validateField(
  field: FieldDef,
  raw: string,
  row: Record<string, unknown>,
): { value: unknown; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  const trimmed = (raw ?? "").trim();

  if (!trimmed) {
    if (field.required) {
      issues.push({ field: field.key, level: "error", message: `${field.label} is required.` });
    }
    return { value: undefined, issues };
  }

  let value: unknown = trimmed;
  switch (field.type) {
    case "number":
    case "integer": {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || (field.type === "integer" && !Number.isInteger(n))) {
        issues.push({ field: field.key, level: "error", message: `${field.label} must be a ${field.type}.` });
      } else value = n;
      break;
    }
    case "boolean":
      value = /^(true|yes|1|y)$/i.test(trimmed);
      break;
    case "date": {
      const iso = parseFlexibleDate(trimmed);
      if (!iso) {
        issues.push({
          field: field.key,
          level: "error",
          message: `${field.label} could not be parsed. Use YYYY-MM-DD, DD/MM/YYYY, or "18 Jun 2026".`,
        });
      } else {
        value = iso;
      }
      break;
    }
    case "datetime":
      if (!RX_DATETIME.test(trimmed)) issues.push({ field: field.key, level: "error", message: `${field.label} must be ISO datetime.` });
      break;
    case "email":
      if (!RX_EMAIL.test(trimmed)) issues.push({ field: field.key, level: "error", message: `${field.label} is not a valid email.` });
      break;
    case "phone": {
      const digits = phoneDigits(trimmed);
      if (!RX_EG_MOBILE.test(digits) && !RX_PHONE.test(trimmed)) {
        issues.push({
          field: field.key,
          level: "warning",
          message: `${field.label} format looks unusual.`,
        });
      }
      break;
    }
    case "enum":
      if (field.enumValues && !field.enumValues.includes(trimmed)) {
        issues.push({
          field: field.key,
          level: "error",
          message: `${field.label} must be one of: ${field.enumValues.join(", ")}.`,
        });
      }
      break;
    case "airportCode":
      if (!/^[A-Z]{3}$/.test(trimmed.toUpperCase())) {
        issues.push({ field: field.key, level: "error", message: `${field.label} must be a 3-letter IATA code.` });
      } else if (!KNOWN_AIRPORTS.has(trimmed.toUpperCase())) {
        issues.push({ field: field.key, level: "warning", message: `${field.label} "${trimmed}" is unknown.` });
      }
      value = trimmed.toUpperCase();
      break;
    case "airlineCode":
      if (!/^[A-Z0-9]{2,3}$/.test(trimmed.toUpperCase())) {
        issues.push({ field: field.key, level: "error", message: `${field.label} must be a 2–3 char IATA code.` });
      } else if (!KNOWN_AIRLINES.has(trimmed.toUpperCase())) {
        issues.push({ field: field.key, level: "warning", message: `${field.label} "${trimmed}" is unknown.` });
      }
      value = trimmed.toUpperCase();
      break;
  }

  if (field.transform && !issues.some((i) => i.level === "error")) {
    try { value = field.transform(trimmed); } catch { /* keep parsed */ }
  }
  if (field.validate) {
    const msg = field.validate(value, row);
    if (msg) issues.push({ field: field.key, level: "error", message: msg });
  }
  return { value, issues };
}