"use client";

import { createContext, useContext } from "react";

export type LogoUrls = {
  logo_trt: string;
  logo_trt_world: string;
  logo_email: string;
};

/** Static logos — no API fetch, always use public assets. */
const staticLogos: LogoUrls = {
  logo_trt: "/trt-logo.png",
  logo_trt_world: "/trt-world-logo.png",
  logo_email: "/logo.png",
};

const LogoContext = createContext<LogoUrls>(staticLogos);

export function LogoProvider({ children }: { children: React.ReactNode }) {
  return <LogoContext.Provider value={staticLogos}>{children}</LogoContext.Provider>;
}

export function useLogos() {
  return useContext(LogoContext);
}
