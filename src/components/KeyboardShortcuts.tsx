"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS = [
  { keys: ["?", "Shift+/"], action: "Show this help (or click footer link)" },
  { keys: ["Esc"], action: "Close modal / Cancel" },
  { keys: ["g", "d"], action: "Go to Dashboard" },
  { keys: ["g", "i"], action: "Go to Guest Invoices" },
  { keys: ["g", "c"], action: "Go to Contractor Invoices" },
  { keys: ["g", "m"], action: "Go to Messages" },
  { keys: ["g", "h"], action: "Go to Help" },
  { keys: ["A"], action: "Approve invoice (when expanded)" },
  { keys: ["R"], action: "Reject invoice (when expanded)" },
  { keys: ["P"], action: "Mark as paid (when expanded)" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const lastKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const openHelp = () => setShowHelp((s) => !s);
    const handleOpenShortcuts = () => openHelp();

    window.addEventListener("openKeyboardShortcuts", handleOpenShortcuts);

    const handleKeyDown = (e: KeyboardEvent) => {
      const isHelpKey = e.key === "?" || (e.key === "/" && e.shiftKey);
      if (isHelpKey) {
        e.preventDefault();
        openHelp();
        lastKeyRef.current = null;
        return;
      }
      if (e.key === "Escape") {
        setShowHelp(false);
        lastKeyRef.current = null;
        return;
      }
      if (showHelp) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === "g") {
        lastKeyRef.current = "g";
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => { lastKeyRef.current = null; }, 800);
        return;
      }
      if (lastKeyRef.current === "g") {
        lastKeyRef.current = null;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (key === "d") {
          e.preventDefault();
          router.push("/dashboard");
        } else if (key === "i") {
          e.preventDefault();
          router.push("/invoices");
        } else if (key === "c") {
          e.preventDefault();
          router.push("/freelancer-invoices");
        } else if (key === "m") {
          e.preventDefault();
          router.push("/messages");
        } else if (key === "h") {
          e.preventDefault();
          router.push("/help");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("openKeyboardShortcuts", handleOpenShortcuts);
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router, showHelp]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Keyboard shortcuts</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Press ? or Shift+/ to toggle, or click the footer link</p>
        <ul className="mt-4 space-y-2">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="text-gray-600 dark:text-gray-400">{s.action}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setShowHelp(false)}
          className="mt-4 w-full rounded-lg bg-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
