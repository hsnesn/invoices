"use client";

import { useState } from "react";
import { TrtLogo } from "@/components/TrtLogo";

export function GuestSubmitErrorClient({ token, error }: { token: string; error: string }) {
  const [requestingLink, setRequestingLink] = useState(false);
  const [linkRequested, setLinkRequested] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleRequestNewLink() {
    if (!token || requestingLink) return;
    setRequestingLink(true);
    setErr(null);
    try {
      const res = await fetch("/api/guest-invoice-submit/request-new-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (res.ok) {
        setLinkRequested(true);
      } else {
        setErr(d.error ?? "Request failed");
      }
    } catch {
      setErr("Connection error. Please try again.");
    } finally {
      setRequestingLink(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
      <TrtLogo size="md" />
      <div className="mt-6 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/30">
        <p className="font-medium text-rose-800 dark:text-rose-200">{error}</p>
        {linkRequested ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            We have notified the producer. They will send you a new link soon.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
              You can request a new link and we will notify the producer.
            </p>
            <button
              type="button"
              onClick={handleRequestNewLink}
              disabled={requestingLink}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              {requestingLink ? "Sending…" : "Request new link"}
            </button>
          </>
        )}
        {err && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{err}</p>}
      </div>
    </div>
  );
}
