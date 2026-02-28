"use client";

import { TrtLogo } from "@/components/TrtLogo";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Full-screen overlay with large logo and spinning animation.
 * Theme-aware: dark/light mode styling.
 */
export function UploadOverlay({ message = "Uploading..." }: { message?: string }) {
  const theme = useTheme()?.theme ?? "dark";
  const isDark = theme === "dark";

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-md ${
        isDark ? "bg-slate-900/85" : "bg-white/90"
      }`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="relative h-56 w-56 sm:h-64 sm:w-64 flex items-center justify-center">
        <TrtLogo size="lg" variant={isDark ? "dark" : "light"} className="h-36 w-36 sm:h-44 sm:w-44 z-10" imgClassName="h-32 w-32 sm:h-40 sm:w-40" />
        <div
          className={`absolute inset-0 rounded-full border-4 animate-spin ${
            isDark ? "border-slate-500/50 border-t-white" : "border-slate-300/50 border-t-sky-600"
          }`}
          aria-hidden
        />
      </div>
      <p className={`mt-6 text-base font-medium ${isDark ? "text-white/90" : "text-slate-700"}`}>{message}</p>
    </div>
  );
}
