"use client";

import { useEffect } from "react";

/**
 * Calls auth refresh API on mount to keep session token fresh.
 * Runs in background, does not block render.
 */
export function SessionRefresh() {
  useEffect(() => {
    fetch("/api/auth/refresh", { credentials: "include" }).catch(() => {
      // Ignore - user may be on login page
    });
  }, []);
  return null;
}
