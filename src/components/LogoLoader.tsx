"use client";

import { useLogos } from "@/contexts/LogoContext";

/**
 * Loading animation with TRT logo and spinning ring.
 * Use during invoice uploads and other loading states.
 * @param variant "light" for dark/colored backgrounds (e.g. buttons), "dark" for light backgrounds
 */
export function LogoLoader({
  size = "md",
  variant = "dark",
}: {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
}) {
  const sizes = {
    sm: { container: "h-12 w-12", logo: "h-6 w-6", ring: "border-2" },
    md: { container: "h-16 w-16", logo: "h-8 w-8", ring: "border-2" },
    lg: { container: "h-24 w-24", logo: "h-12 w-12", ring: "border-4" },
  };
  const logos = useLogos();
  const s = sizes[size];
  const ringCls =
    variant === "light"
      ? "border-white/40 border-t-white"
      : "border-slate-300 border-t-sky-600 dark:border-slate-600 dark:border-t-sky-400";

  return (
    <div className={`relative ${s.container} flex items-center justify-center`}>
      <img
        src={logos.logo_trt || "/trt-logo.png"}
        alt="TRT"
        className={`${s.logo} object-contain z-10`}
      />
      <div
        className={`absolute inset-0 rounded-full ${s.ring} ${ringCls} animate-spin`}
        aria-hidden
      />
    </div>
  );
}
