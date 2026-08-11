// Single source of truth for passenger phone numbers.
//
// The airport serves passengers from every country, so the system accepts any
// valid international number and stores ONE canonical representation: E.164
// (e.g. +201012345678, +447911123456). Provider adapters convert away from
// E.164 only when the provider demands a different representation.

import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export const DEFAULT_COUNTRY: CountryCode = "EG";

/** Countries offered first in the selector — the station's real traffic mix. */
const PRIORITY: CountryCode[] = ["EG", "AE", "SA", "KW", "QA", "GB", "DE", "FR", "IT", "US"];

export interface CountryOption {
  code: CountryCode;
  callingCode: string;
  label: string;
}

const DISPLAY = new Intl.DisplayNames(["en"], { type: "region" });

export const COUNTRY_OPTIONS: CountryOption[] = (() => {
  const all = getCountries();
  const ordered = [...PRIORITY, ...all.filter((c) => !PRIORITY.includes(c))];
  return ordered.map((code) => ({
    code,
    callingCode: `+${getCountryCallingCode(code)}`,
    label: DISPLAY.of(code) ?? code,
  }));
})();

/** Example national number for the given country, used as placeholder text. */
export function phoneExample(country: CountryCode): string {
  const samples: Partial<Record<string, string>> = {
    EG: "01012345678",
    AE: "0501234567",
    SA: "0512345678",
    GB: "07911123456",
    US: "(201) 555-0123",
    DE: "01512345678",
    FR: "0612345678",
  };
  return samples[country] ?? "";
}

/** Canonical E.164 for a value, or null when it is not a valid number. */
export function toE164(value: unknown, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(raw, raw.startsWith("+") ? undefined : country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

export function isValidPhone(value: unknown, country: CountryCode = DEFAULT_COUNTRY): boolean {
  return toE164(value, country) !== null;
}

/**
 * Operator-facing explanation of why a number is rejected, or null when the
 * number is valid.
 */
export function phoneError(
  value: unknown,
  label = "Mobile",
  country: CountryCode = DEFAULT_COUNTRY,
): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return `${label} is required.`;
  if (/[A-Za-z]/.test(raw)) return `${label} must contain digits only.`;
  if (isValidPhone(raw, country)) return null;
  const example = phoneExample(country);
  return `${label} is not a valid number for the selected country${example ? ` (e.g. ${example})` : ""}.`;
}

/** Country a stored E.164 number belongs to, for re-editing an existing record. */
export function countryOf(value: unknown): CountryCode | null {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("+")) return null;
  return parsePhoneNumberFromString(raw)?.country ?? null;
}

/** National (local) portion of a stored number, for display inside the input. */
export function nationalOf(value: unknown): string {
  const raw = String(value ?? "").trim();
  const parsed = raw.startsWith("+") ? parsePhoneNumberFromString(raw) : null;
  return parsed?.nationalNumber ? String(parsed.nationalNumber) : raw;
}

/** Digits-only E.164 (no leading +) — the WhatsApp Cloud API recipient format. */
export function e164Digits(value: unknown): string | null {
  const e164 = toE164(value);
  return e164 ? e164.replace(/^\+/, "") : null;
}