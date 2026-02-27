"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ExportLocale } from "@/lib/export-locale";

const STORAGE_KEY = "export-locale";

type ExportLocaleContextValue = {
  locale: ExportLocale;
  setLocale: (locale: ExportLocale) => void;
};

const ExportLocaleContext = createContext<ExportLocaleContextValue | null>(null);

export function ExportLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<ExportLocale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ExportLocale | null;
      if (stored === "en" || stored === "tr") setLocaleState(stored);
    } catch {
      // ignore
    }
  }, []);

  const setLocale = useCallback((value: ExportLocale) => {
    setLocaleState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, []);

  const value: ExportLocaleContextValue = { locale, setLocale };

  if (!mounted) {
    return <ExportLocaleContext.Provider value={value}>{children}</ExportLocaleContext.Provider>;
  }

  return <ExportLocaleContext.Provider value={value}>{children}</ExportLocaleContext.Provider>;
}

export function useExportLocale() {
  const ctx = useContext(ExportLocaleContext);
  if (!ctx) {
    return { locale: "en" as ExportLocale, setLocale: () => {} };
  }
  return ctx;
}
