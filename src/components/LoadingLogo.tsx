"use client";

import { LogoLoader } from "@/components/LogoLoader";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Theme-aware loading spinner with logo animation.
 * fullScreen: for root loading. false: for in-content (e.g. authenticated layout).
 */
export function LoadingLogo({ fullScreen = true }: { fullScreen?: boolean }) {
  const theme = useTheme()?.theme ?? "dark";
  const isDark = theme === "dark";

  return (
    <div className={`flex flex-col items-center justify-center ${fullScreen ? "min-h-screen" : ""} ${fullScreen ? (isDark ? "bg-slate-950" : "bg-slate-100") : ""}`}>
      <LogoLoader size="lg" variant={isDark ? "light" : "dark"} />
      <p className={`mt-4 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Loading...</p>
    </div>
  );
}
