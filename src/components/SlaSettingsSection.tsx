"use client";

import { useState, useEffect } from "react";

export function SlaSettingsSection() {
  const [slaDays, setSlaDays] = useState(5);
  const [digestFreq, setDigestFreq] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/app-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object") {
          const sla = d.manager_sla_days;
          const freq = d.pending_digest_frequency_days;
          if (typeof sla === "number") setSlaDays(sla);
          else if (sla?.value != null) setSlaDays(Number(sla.value));
          if (typeof freq === "number") setDigestFreq(freq);
          else if (freq?.value != null) setDigestFreq(Number(freq.value));
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await Promise.all([
        fetch("/api/admin/app-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "manager_sla_days", value: slaDays }),
        }),
        fetch("/api/admin/app-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "pending_digest_frequency_days", value: digestFreq }),
        }),
      ]);
      setMessage({ type: "success", text: "Settings saved." });
    } catch {
      setMessage({ type: "error", text: "Failed to save." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-amber-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 flex items-center gap-2 font-medium text-gray-900 dark:text-white">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        Manager SLA & Digest
      </h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        SLA reminder: managers receive an email when invoices exceed the approval deadline. Digest: managers receive a summary of their pending invoices.
      </p>
      {message && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">SLA: days until reminder (overdue)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={slaDays}
            onChange={(e) => setSlaDays(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-400">Managers get a reminder when invoices exceed this many days in pending.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Digest frequency</label>
          <select
            value={digestFreq}
            onChange={(e) => setDigestFreq(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value={1}>Daily (every day at 9am)</option>
            <option value={7}>Weekly (Mondays at 9am)</option>
          </select>
          <p className="mt-1 text-xs text-gray-400">Managers receive a summary of their pending invoices.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={loading}
        className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
