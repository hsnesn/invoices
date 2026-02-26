"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalOverlayProps {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function ModalOverlay({ onClose, children, className, ariaLabel }: ModalOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);

    const prev = document.activeElement as HTMLElement | null;
    const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable?.length) focusable[0].focus();

    return () => {
      document.removeEventListener("keydown", handleKey);
      prev?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={className ?? "mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"}>
        {children}
      </div>
    </div>
  );
}
