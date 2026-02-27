/**
 * Validation for guest contact email and phone.
 */
import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

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
  try {
    return isValidPhoneNumber(s.trim());
  } catch {
    return false;
  }
}

export function validatePhone(s: string | null | undefined): { valid: boolean; message?: string; formatted?: string } {
  if (!s?.trim()) return { valid: true };
  try {
    const parsed = parsePhoneNumber(s.trim());
    if (!parsed || !parsed.isValid()) {
      return { valid: false, message: "Invalid phone number" };
    }
    return { valid: true, formatted: parsed.formatInternational() };
  } catch {
    return { valid: false, message: "Invalid phone number format" };
  }
}

export function formatPhone(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  try {
    const parsed = parsePhoneNumber(s.trim());
    return parsed?.isValid() ? parsed.formatInternational() : s.trim();
  } catch {
    return s.trim();
  }
}
