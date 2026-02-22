/**
 * UK sort code: 6 digits, optionally with hyphens (XX-XX-XX)
 */
export function normalizeSortCode(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return digits;
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
