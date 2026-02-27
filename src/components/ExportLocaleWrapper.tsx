"use client";

import { ExportLocaleProvider } from "@/contexts/ExportLocaleContext";

export function ExportLocaleWrapper({ children }: { children: React.ReactNode }) {
  return <ExportLocaleProvider>{children}</ExportLocaleProvider>;
}
