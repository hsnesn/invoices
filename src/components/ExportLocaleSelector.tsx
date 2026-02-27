"use client";

import { useExportLocale } from "@/contexts/ExportLocaleContext";
import type { ExportLocale } from "@/lib/export-locale";

export function ExportLocaleSelector() {
  const { locale, setLocale } = useExportLocale();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as ExportLocale)}
      title="Export language"
      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
    >
      <option value="en">EN</option>
      <option value="tr">TR</option>
    </select>
  );
}
