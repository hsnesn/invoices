"use client";

import { useLogos } from "@/contexts/LogoContext";

/**
 * TRT logo with theme-aware background:
 * - Light mode: white background
 * - Dark mode: black background
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
  /** "auto" = theme-based (white/black), "light" = always white, "dark" = always black */
  variant?: "auto" | "light" | "dark";
}) {
  const logos = useLogos();
  const sizes = {
    xs: { container: "h-7 w-7 sm:h-9 sm:w-9", img: "h-5 w-5 sm:h-6 sm:w-6" },
    sm: { container: "h-8 w-8", img: "h-5 w-5 sm:h-6 sm:w-6" },
    md: { container: "h-10 w-10 sm:h-12 sm:w-12", img: "h-6 w-6 sm:h-7 sm:w-7" },
    lg: { container: "h-14 w-14 sm:h-16 sm:w-16", img: "h-10 w-10 sm:h-12 sm:w-12" },
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
        src={logos.logo_trt || "/trt-logo.png"}
        alt="TRT"
        className={`object-contain ${s.img} ${imgClassName}`}
      />
    </div>
  );
}
