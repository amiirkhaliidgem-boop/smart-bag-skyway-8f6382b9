// Single source of truth for passenger mobile numbers.
//
// Operational rule (Lost & Found, Bulk Import, Notification Center):
// numbers are stored and entered in the LOCAL Egyptian format — exactly
// 11 digits starting with 010 / 011 / 012 / 015. Nothing else is accepted:
// no +20, no 0020, no spaces, dashes or letters.
//
// The Notification Center converts to E.164 (+20…) at send time only, so a
// number accepted anywhere in the system is always SMS-deliverable.

export const EG_MOBILE_PREFIXES = ["010", "011", "012", "015"] as const;

const RX_EG_LOCAL = /^01[0125][0-9]{8}$/;

export const EG_MOBILE_HINT =
  "Use the local Egyptian format: 11 digits starting with 010, 011, 012 or 015 (e.g. 01012345678). No +20, spaces or dashes.";

/** True only for a canonical local Egyptian mobile number. */
export function isEgMobile(value: unknown): boolean {
  return RX_EG_LOCAL.test(String(value ?? ""));
}

/**
 * Explains why a value is not a valid Egyptian mobile number, or null when
 * it is valid. `label` is used to build an operator-facing message.
 */
export function egMobileError(value: unknown, label = "Mobile"): string | null {
  const raw = String(value ?? "");
  if (!raw.trim()) return `${label} is required.`;
  if (isEgMobile(raw)) return null;
  if (/[A-Za-z]/.test(raw)) return `${label} must contain digits only. ${EG_MOBILE_HINT}`;
  if (/[\s()\-.+]/.test(raw)) return `${label} must not contain +, spaces or dashes. ${EG_MOBILE_HINT}`;
  if (/^(?:0020|\+?20)/.test(raw)) return `${label} must be the local format, not a country code. ${EG_MOBILE_HINT}`;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return `${label} must be exactly 11 digits. ${EG_MOBILE_HINT}`;
  return `${label} must start with 010, 011, 012 or 015. ${EG_MOBILE_HINT}`;
}

/**
 * Converts a stored local number to the E.164 form the SMS / WhatsApp
 * provider requires. Returns null when the number is not a valid Egyptian
 * mobile — the transport then fails fast instead of calling the provider.
 */
export function toE164Eg(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (isEgMobile(raw)) return `+20${raw.slice(1)}`;
  // Tolerate legacy records saved before the rule was enforced.
  const digits = raw.replace(/[\s()\-.]/g, "").replace(/^\+/, "");
  const local = digits.replace(/^(?:0020|20)/, "");
  const normalized = local.startsWith("0") ? local : `0${local}`;
  return isEgMobile(normalized) ? `+20${normalized.slice(1)}` : null;
}