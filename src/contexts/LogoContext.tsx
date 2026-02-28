"use client";

import { createContext, useContext, useEffect, useState } from "react";

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

  useEffect(() => {
    fetch("/api/settings/logos")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object") {
          setUrls({
            logo_trt: d.logo_trt || defaults.logo_trt,
            logo_trt_world: d.logo_trt_world || defaults.logo_trt_world,
            logo_email: d.logo_email || defaults.logo_email,
          });
        }
      })
      .catch(() => {});
  }, []);

  return <LogoContext.Provider value={urls}>{children}</LogoContext.Provider>;
}

export function useLogos() {
  return useContext(LogoContext);
}
