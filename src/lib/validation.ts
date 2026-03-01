/**
 * UK sort code: 6 digits, optionally with hyphens (XX-XX-XX)
 */
export function normalizeSortCode(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return digits;
}

/**
 * IBAN format: 2 letter country + 2 check digits + up to 30 alphanumeric.
 * Validates length and mod-97 checksum per ISO 13616.
 */
export function isValidIban(iban: string): boolean {
  const cleaned = String(iban).replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned)) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  let numeric = "";
  for (let i = 0; i < rearranged.length; i++) {
    const c = rearranged[i];
    if (c >= "A" && c <= "Z") numeric += (c.charCodeAt(0) - 55).toString();
    else numeric += c;
  }
  let remainder = numeric;
  while (remainder.length > 2) {
    const block = remainder.slice(0, 9);
    remainder = (parseInt(block, 10) % 97).toString() + remainder.slice(block.length);
  }
  return parseInt(remainder, 10) % 97 === 1;
}

/**
 * net + vat ≈ gross (tolerance for rounding)
 */
export function amountsConsistent(
  net: number,
  vat: number,
  gross: number,
  tolerance = 0.02
): boolean {
  const sum = net + vat;
  return Math.abs(sum - gross) <= tolerance;
}
