"use client";

import { useState, useEffect } from "react";

type OverrideRow = { program_name_key: string; manager_user_id: string; manager_name: string };
type UserOption = { id: string; full_name: string | null; email?: string | null; role: string; is_active?: boolean };

export function ProgramManagerOverridesSection() {
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const refresh = () => {
    setTableMissing(false);
    fetch("/api/admin/program-manager-overrides")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok && d?.error) {
          const err = String(d.error).toLowerCase();
          if (err.includes("program_manager") || err.includes("does not exist") || err.includes("42P01")) {
            setTableMissing(true);
          }
          setOverrides([]);
        } else if (Array.isArray(d)) {
          setOverrides(d);
        } else {
          setOverrides([]);
        }
      })
      .catch(() => setOverrides([]));
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveNewsmakerManager = async (managerUserId: string | null) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/program-manager-overrides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_name_key: "newsmaker",
          manager_user_id: managerUserId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        refresh();
        setMessage({ type: "success", text: managerUserId ? "Dept EP saved." : "Override cleared." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const newsmakerOverride = overrides.find((o) => o.program_name_key === "newsmaker");
  const managerUsers = users.filter((u) => u.is_active !== false && (u.role === "manager" || u.role === "admin"));

  if (tableMissing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
        <h2 className="mb-2 font-medium text-amber-900 dark:text-amber-200">Newsmaker Dept EP (e.g. Simonetta Fornasiero)</h2>
        <p className="mb-4 text-sm text-amber-800 dark:text-amber-300">
          Run the migration to create the <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">program_manager_overrides</code> table.
        </p>
        <p className="mb-2 text-sm text-amber-700 dark:text-amber-400">
          Supabase Dashboard → SQL Editor → run <code className="rounded bg-amber-200/50 px-1">00037_program_manager_overrides.sql</code>
        </p>
        <p className="mb-4 text-xs text-amber-600 dark:text-amber-500">Or run: <code>supabase db push</code></p>
        <button type="button" onClick={refresh} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-500">
          Retry after migration
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-violet-200 bg-white p-6 shadow-sm dark:border-violet-800/50 dark:bg-gray-900/80">
      <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Newsmaker Dept EP (e.g. Simonetta Fornasiero)</h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        When Newsmaker program is selected, assign this Dept EP. Choose Simonetta Fornasiero or another manager.
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Newsmaker:</label>
          <select
            value={newsmakerOverride?.manager_user_id ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              void saveNewsmakerManager(v || null);
            }}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          >
            <option value="">Use default (department / program)</option>
            {managerUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email || u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
