"use client";

import { TrtLogo } from "@/components/TrtLogo";

/**
 * Full-screen overlay with large TRT logo and spinning animation.
 * Shown during invoice/file uploads.
 */
export function UploadOverlay({ message = "Uploading..." }: { message?: string }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="relative h-56 w-56 sm:h-64 sm:w-64 flex items-center justify-center">
        <TrtLogo size="lg" variant="dark" className="h-36 w-36 sm:h-44 sm:w-44 z-10" imgClassName="h-32 w-32 sm:h-40 sm:w-40" />
        <div
          className="absolute inset-0 rounded-full border-4 border-slate-500/50 border-t-white animate-spin"
          aria-hidden
        />
      </div>
      <p className="mt-6 text-base font-medium text-white/90">{message}</p>
    </div>
  );
}
