"use client";

import { useState, useEffect } from "react";
import { TrtLogo } from "@/components/TrtLogo";

type StatusData = {
  status: string;
  statusRaw: string;
  invoiceNumber: string;
  guestName?: string;
  programName?: string;
  paidDate: string | null;
  downloadUrl: string;
};

export function GuestInvoiceStatusClient({ token }: { token: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/guest-invoice-submit/status/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load status"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/60 text-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/30">
        <p className="font-medium text-rose-800 dark:text-rose-200">{error ?? "Status not found"}</p>
      </div>
    );
  }

  const statusColor =
    data.status === "Paid"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : data.status === "Approved"
        ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
        : data.status === "Rejected"
          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Invoice status</h1>
      {data.guestName && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {data.guestName}
          {data.programName && ` · ${data.programName}`}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${statusColor}`}>
          {data.status}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Ref: {data.invoiceNumber}
        </span>
      </div>
      {data.paidDate && (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          Paid on {new Date(data.paidDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      )}
      {data.status === "Processing" && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Payment is typically made within 10–14 working days after approval.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={data.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-600"
        >
          Download invoice
        </a>
      </div>
    </div>
  );
}
