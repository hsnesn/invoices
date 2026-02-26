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
        if (!r.ok && d?.error && String(d.error).toLowerCase().includes("program_manager")) {
          setTableMissing(true);
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
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Program-specific Dept EP</h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Override the default Dept EP for specific programs. When Newsmaker is selected, the chosen manager will be assigned.
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
