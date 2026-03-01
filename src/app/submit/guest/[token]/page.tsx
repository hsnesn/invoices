"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TrtLogo } from "@/components/TrtLogo";

export default function GuestInvoiceSubmitPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<{
    guest_name: string;
    program_name: string | null;
    recording_date: string | null;
    recording_topic: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [currency, setCurrency] = useState("GBP");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/guest-invoice-submit/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !token) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("file", file);
      formData.set("currency", currency);
      const res = await fetch("/api/guest-invoice-submit/upload", {
        method: "POST",
        body: formData,
      });
      const d = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(d.error ?? "Upload failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <div className="mt-6 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/30">
          <p className="font-medium text-rose-800 dark:text-rose-200">{error}</p>
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
            Please contact the producer if you need a new link.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <div className="mt-6 max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Invoice submitted successfully</p>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            Thank you! We will process your payment as soon as possible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-8 px-4">
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center mb-6">
          <TrtLogo size="md" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Submit your invoice</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hello {data?.guest_name}. Please upload your invoice below.
          </p>
          {data?.program_name && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Program: {data.program_name}
              {data.recording_date && ` · Recorded: ${data.recording_date}`}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice file</label>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">PDF, Word, Excel or JPEG. Max 10 MB.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !file}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              {submitting ? "Submitting…" : "Submit invoice"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
