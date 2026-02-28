"use client";

import { TrtLogo } from "@/components/TrtLogo";

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
    sm: { container: "h-12 w-12", ring: "border-2" },
    md: { container: "h-16 w-16", ring: "border-2" },
    lg: { container: "h-24 w-24", ring: "border-4" },
  };
  const s = sizes[size];
  const ringCls =
    variant === "light"
      ? "border-white/40 border-t-white"
      : "border-slate-300 border-t-sky-600 dark:border-slate-600 dark:border-t-sky-400";
  const logoVariant = variant === "light" ? "dark" : "auto";

  return (
    <div className={`relative ${s.container} flex items-center justify-center`}>
      <TrtLogo
        size={size === "sm" ? "xs" : size === "md" ? "sm" : "md"}
        variant={logoVariant}
        className="z-10 h-full w-full"
        imgClassName={size === "sm" ? "h-6 w-6" : size === "md" ? "h-8 w-8" : "h-12 w-12"}
      />
      <div
        className={`absolute inset-0 rounded-full ${s.ring} ${ringCls} animate-spin`}
        aria-hidden
      />
    </div>
  );
}
