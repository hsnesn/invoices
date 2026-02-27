/**
 * Validation for guest contact email and phone.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string | null | undefined): boolean {
  if (!s?.trim()) return true;
  return EMAIL_REGEX.test(s.trim());
}

export function validateEmail(s: string | null | undefined): { valid: boolean; message?: string } {
  if (!s?.trim()) return { valid: true };
  if (!EMAIL_REGEX.test(s.trim())) {
    return { valid: false, message: "Invalid email format" };
  }
  if (s.length > 254) return { valid: false, message: "Email too long" };
  return { valid: true };
}

export function isValidPhone(s: string | null | undefined): boolean {
  if (!s?.trim()) return true;
  return s.trim().replace(/\D/g, "").length >= 6;
}

export function validatePhone(s: string | null | undefined, defaultCountry?: string): { valid: boolean; message?: string; formatted?: string } {
  if (!s?.trim()) return { valid: true };
  const trimmed = s.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6) {
    return { valid: false, message: "Phone number too short (min 6 digits)" };
  }
  const parsed = tryParsePhone(trimmed, defaultCountry);
  if (parsed?.isValid()) {
    return { valid: true, formatted: parsed.formatInternational() };
  }
  return { valid: true };
}

function tryParsePhone(value: string, defaultCountry?: string) {
  const countries = defaultCountry ? [defaultCountry, "GB", "TR", "US"] : ["GB", "TR", "US"];
  for (const country of countries) {
    try {
      const p = parsePhoneNumberFromString(value, country as "GB" | "TR" | "US");
      if (p?.isValid()) return p;
    } catch {
      // continue
    }
  }
  try {
    return parsePhoneNumberFromString(value);
  } catch {
    return null;
  }
}

export function formatPhone(s: string | null | undefined, defaultCountry?: string): string | null {
  if (!s?.trim()) return null;
  const parsed = tryParsePhone(s.trim(), defaultCountry);
  return parsed?.isValid() ? parsed.formatInternational() : s.trim();
}
