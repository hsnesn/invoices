"use client";

import { useState, useEffect } from "react";

const DISMISSED_KEY = "announcements-dismissed";

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<{ id: string; message: string }[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/announcements?active=true")
      .then((r) => r.json())
      .then((d) => setAnnouncements(Array.isArray(d) ? d : []))
      .catch(() => setAnnouncements([]));
    try {
      const s = sessionStorage.getItem(DISMISSED_KEY);
      if (s) setDismissed(new Set(JSON.parse(s)));
    } catch {}
  }, []);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 px-4 sm:px-6 py-2">
      {visible.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
        >
          <span className="flex-1 min-w-0">{a.message}</span>
          <button
            onClick={() => handleDismiss(a.id)}
            className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-200/50 dark:text-amber-400 dark:hover:bg-amber-800/50"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
