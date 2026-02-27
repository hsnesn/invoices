/**
 * Locale formatting for PDF and Excel exports.
 * - EN: Numbers 1,234.56, dates DD/MM/YYYY
 * - TR: Numbers 1.234,56, dates DD.MM.YYYY
 */

export type ExportLocale = "en" | "tr";

export function formatNumberEN(value: number, decimals = 2): string {
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumberTR(value: number, decimals = 2): string {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrencyEN(value: number): string {
  return `£${formatNumberEN(value)}`;
}

export function formatCurrencyTR(value: number): string {
  return `£${formatNumberTR(value)}`;
}

export function formatDateEN(dateStr: string | Date | null | undefined): string {
  if (dateStr == null || dateStr === "" || dateStr === "—") return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (!Number.isFinite(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTR(dateStr: string | Date | null | undefined): string {
  if (dateStr == null || dateStr === "" || dateStr === "—") return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  if (!Number.isFinite(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type ExportFormatters = {
  formatNumber: (value: number, decimals?: number) => string;
  formatCurrency: (value: number) => string;
  formatDate: (dateStr: string | Date | null | undefined) => string;
};

export function getFormatters(locale: ExportLocale): ExportFormatters {
  if (locale === "tr") {
    return {
      formatNumber: formatNumberTR,
      formatCurrency: formatCurrencyTR,
      formatDate: formatDateTR,
    };
  }
  return {
    formatNumber: formatNumberEN,
    formatCurrency: formatCurrencyEN,
    formatDate: formatDateEN,
  };
}

/** Excel cell format for Turkish numbers (e.g. #.##0,00) */
export const EXCEL_NUMBER_FORMAT_TR = "#.##0,00";
