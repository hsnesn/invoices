"use client";

import { useEffect, useState } from "react";

/**
 * Brief overlay with £ icon animation when mark paid succeeds.
 */
export function PaidIconOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handler = () => {
      setVisible(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setVisible(false), 600);
    };
    window.addEventListener("paid-success", handler);
    return () => {
      window.removeEventListener("paid-success", handler);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none"
      aria-hidden
    >
      <div className="animate-paid-pulse flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/90 text-3xl font-bold text-white shadow-lg ring-4 ring-emerald-300/50">
        £
      </div>
    </div>
  );
}

export function triggerPaidAnimation() {
  window.dispatchEvent(new CustomEvent("paid-success"));
}
