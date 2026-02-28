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

function addCacheBust(url: string, v: number): string {
  if (!url) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${v}`;
}

const LogoContext = createContext<LogoUrls>(defaults);

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const [urls, setUrls] = useState<LogoUrls>(defaults);
  const [version, setVersion] = useState(0);

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
            setVersion((v) => v + 1);
          }
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("logos-updated", load);
    return () => window.removeEventListener("logos-updated", load);
  }, []);

  const urlsWithCacheBust: LogoUrls = {
    logo_trt: addCacheBust(urls.logo_trt, version),
    logo_trt_world: addCacheBust(urls.logo_trt_world, version),
    logo_email: addCacheBust(urls.logo_email, version),
  };

  return <LogoContext.Provider value={urlsWithCacheBust}>{children}</LogoContext.Provider>;
}

export function useLogos() {
  return useContext(LogoContext);
}
