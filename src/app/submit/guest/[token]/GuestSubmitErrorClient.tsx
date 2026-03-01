"use client";

import { useState, useEffect } from "react";
import { TrtLogo } from "@/components/TrtLogo";

export function GuestSubmitErrorClient({
  token,
  error,
  expiresAt,
  errorType,
}: {
  token: string;
  error: string;
  expiresAt?: string;
  errorType?: "expired" | "used";
}) {
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [producerContact, setProducerContact] = useState<{ producerName: string; producerEmail: string | null } | null>(null);
  const canNotify = errorType === "expired" || errorType === "used";

  useEffect(() => {
    if (!token || !canNotify) return;
    fetch(`/api/guest-invoice-submit/contact?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.producerName) setProducerContact({ producerName: d.producerName, producerEmail: d.producerEmail ?? null });
      })
      .catch(() => {});
  }, [token, canNotify]);

  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const mainMessage =
    errorType === "expired" && expiryDate
      ? `This link expired on ${expiryDate}.`
      : errorType === "used"
        ? "This link has already been used."
        : error;

  async function handleNotifyProducer() {
    if (!token || notifying) return;
    setNotifying(true);
    setErr(null);
    try {
      const res = await fetch("/api/guest-invoice-submit/request-new-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (res.ok) {
        setNotified(true);
      } else {
        setErr(d.error ?? "Request failed");
      }
    } catch {
      setErr("Connection error. Please try again.");
    } finally {
      setNotifying(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
      <TrtLogo size="md" />
      <div className="mt-6 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/30">
        <p className="font-medium text-rose-800 dark:text-rose-200">{mainMessage}</p>
        {notified ? (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            We have notified the producer. They will send you a new link soon.
          </p>
        ) : canNotify ? (
          <>
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
              If you believe this is a mistake, click below to notify the producer.
            </p>
            {producerContact && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                If you need help, contact <strong>{producerContact.producerName}</strong>
                {producerContact.producerEmail && <> at <a href={`mailto:${producerContact.producerEmail}`} className="text-sky-600 hover:underline dark:text-sky-400">{producerContact.producerEmail}</a></>}.
              </p>
            )}
            <button
              type="button"
              onClick={handleNotifyProducer}
              disabled={notifying}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600 min-h-[44px] min-w-[44px] touch-manipulation"
              aria-label="Notify producer about link issue"
            >
              {notifying ? "Sending…" : "Notify producer"}
            </button>
          </>
        ) : null}
        {err && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{err}</p>}
      </div>
    </div>
  );
}
