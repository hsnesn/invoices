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

function addCacheBust(url: string | undefined, stamp: number): string {
  const u = url || "";
  if (!u) return "";
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}v=${stamp}`;
}

const LogoContext = createContext<LogoUrls>(defaults);

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const [urls, setUrls] = useState<LogoUrls>(defaults);
  const [stamp, setStamp] = useState(() => Date.now());

  useEffect(() => {
    const load = () => {
      fetch(`/api/settings/logos?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d && typeof d === "object") {
            setUrls({
              logo_trt: d.logo_trt || defaults.logo_trt,
              logo_trt_world: d.logo_trt_world || defaults.logo_trt_world,
              logo_email: d.logo_email || defaults.logo_email,
            });
            setStamp(Date.now());
          }
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("logos-updated", load);
    return () => window.removeEventListener("logos-updated", load);
  }, []);

  const urlsWithCacheBust: LogoUrls = {
    logo_trt: addCacheBust(urls.logo_trt, stamp),
    logo_trt_world: addCacheBust(urls.logo_trt_world, stamp),
    logo_email: addCacheBust(urls.logo_email, stamp),
  };

  return <LogoContext.Provider value={urlsWithCacheBust}>{children}</LogoContext.Provider>;
}

export function useLogos() {
  return useContext(LogoContext);
}
