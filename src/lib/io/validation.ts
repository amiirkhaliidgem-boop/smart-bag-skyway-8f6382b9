import type { FieldDef, RowIssue } from "./types";

// Airport / airline code reference sets. Extendable via reference tables
// once the ERP integration is in place.
export const KNOWN_AIRPORTS = new Set([
  "CAI", "HRG", "SSH", "LXR", "ASW",
  "JFK", "LHR", "CDG", "FRA", "AMS", "DXB", "DOH", "IST", "JED", "RUH", "MED",
  "AUH", "MCT", "KWI", "BAH", "MUC", "ZRH", "MAD", "BCN", "FCO", "MXP", "ATH",
]);

export const KNOWN_AIRLINES = new Set([
  "MS", "TK", "EK", "QR", "EY", "SV", "LH", "BA", "AF", "KL", "LX", "IB",
  "AZ", "RJ", "ME", "PC", "W6", "FZ", "OS", "TP",
]);

const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RX_PHONE = /^\+?[0-9][0-9 ()-]{6,20}$/;
const RX_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RX_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?$/;

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
    case "date":
      if (!RX_DATE.test(trimmed)) issues.push({ field: field.key, level: "error", message: `${field.label} must be YYYY-MM-DD.` });
      break;
    case "datetime":
      if (!RX_DATETIME.test(trimmed)) issues.push({ field: field.key, level: "error", message: `${field.label} must be ISO datetime.` });
      break;
    case "email":
      if (!RX_EMAIL.test(trimmed)) issues.push({ field: field.key, level: "error", message: `${field.label} is not a valid email.` });
      break;
    case "phone":
      if (!RX_PHONE.test(trimmed)) issues.push({ field: field.key, level: "warning", message: `${field.label} format looks unusual.` });
      break;
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