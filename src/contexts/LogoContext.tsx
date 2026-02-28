"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type LogoUrls = {
  logo_trt: string;
  logo_trt_world: string;
  logo_email: string;
};

const defaults: LogoUrls = {
  logo_trt: "/trt-logo.png",
  logo_trt_world: "/trt-world-logo.png",
  logo_email: "/logo.png",
};

const LogoContext = createContext<LogoUrls>(defaults);

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const [urls, setUrls] = useState<LogoUrls>(defaults);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings/logos?_=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const d = await res.json();
      if (d && typeof d === "object") {
        const next: LogoUrls = {
          logo_trt: d.logo_trt || defaults.logo_trt,
          logo_trt_world: d.logo_trt_world || defaults.logo_trt_world,
          logo_email: d.logo_email || defaults.logo_email,
        };
        setUrls(next);
      }
    } catch {
      /* network error — keep current */
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("logos-updated", load);
    return () => window.removeEventListener("logos-updated", load);
  }, [load]);

  return <LogoContext.Provider value={urls}>{children}</LogoContext.Provider>;
}

export function useLogos() {
  return useContext(LogoContext);
}
