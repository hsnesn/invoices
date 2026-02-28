"use client";

import { useLogos } from "@/contexts/LogoContext";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Logo with light/dark variants. Put trt-logo-light.png and trt-logo-dark.png in public/.
 * - variant "light" → always light logo
 * - variant "dark" → always dark logo
 * - variant "auto" → follows theme (light theme → light logo, dark theme → dark logo)
 */
export function TrtLogo({
  className = "",
  imgClassName = "",
  size = "md",
  variant = "auto",
}: {
  className?: string;
  imgClassName?: string;
  size?: "xs" | "sm" | "md" | "lg";
  /** "auto" = theme-based, "light" = always light logo, "dark" = always dark logo */
  variant?: "auto" | "light" | "dark";
}) {
  const logos = useLogos();
  const themeContext = useTheme();
  const theme = themeContext?.theme ?? "dark";

  const logoSrc =
    variant === "light"
      ? logos.logo_trt_light || logos.logo_trt || "/trt-logo-light.png"
      : variant === "dark"
        ? logos.logo_trt_dark || logos.logo_trt || "/trt-logo-dark.png"
        : theme === "light"
          ? logos.logo_trt_light || logos.logo_trt || "/trt-logo-light.png"
          : logos.logo_trt_dark || logos.logo_trt || "/trt-logo-dark.png";

  const sizes = {
    xs: { container: "h-9 w-9 sm:h-11 sm:w-11", img: "h-7 w-7 sm:h-8 sm:w-8" },
    sm: { container: "h-11 w-11 sm:h-12 sm:w-12", img: "h-8 w-8 sm:h-9 sm:w-9" },
    md: { container: "h-14 w-14 sm:h-16 sm:w-16", img: "h-10 w-10 sm:h-11 sm:w-11" },
    lg: { container: "h-20 w-20 sm:h-24 sm:w-24", img: "h-14 w-14 sm:h-16 sm:w-16" },
  };
  const s = sizes[size];
  const bgCls =
    variant === "light"
      ? "bg-white"
      : variant === "dark"
        ? "bg-black"
        : "bg-white dark:bg-black";

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded px-1 ${s.container} ${bgCls} ${className}`}
    >
      <img
        src={logoSrc}
        alt="Logo"
        className={`object-contain ${s.img} ${imgClassName}`}
      />
    </div>
  );
}
