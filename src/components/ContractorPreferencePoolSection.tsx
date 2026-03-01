"use client";

import { useState, useEffect } from "react";

type PoolMember = { id: string; user_id: string; full_name: string; sort_order: number; created_at: string };
type UserOption = { id: string; full_name: string | null; email?: string | null; is_active?: boolean };

export function ContractorPreferencePoolSection() {
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [newUserId, setNewUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = () => {
    Promise.all([
      fetch("/api/admin/contractor-preference-pool").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ])
      .then(([poolData, usersData]) => {
        setMembers(Array.isArray(poolData) ? poolData : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
      })
      .catch(() => {
        setMembers([]);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/contractor-preference-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: newUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewUserId("");
        setMessage({ type: "success", text: "Added to contractor pool." });
        fetchData();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (id: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/contractor-preference-pool?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Removed from contractor pool." });
        fetchData();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to remove." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const memberIds = new Set(members.map((m) => m.user_id));
  const availableUsers = users.filter((u) => u.is_active !== false && !memberIds.has(u.id));

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading contractor pool...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-violet-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
        Contractor Preference Pool
        <span className="text-xs font-normal text-gray-400">({members.length})</span>
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        People who can appear in the &quot;My Preference List&quot; dropdown. Add or remove contractors here. When this list is
        empty, all active users appear. When populated, only these people appear.
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

      <form onSubmit={addMember} className="mb-4 flex gap-2">
        <select
          value={newUserId}
          onChange={(e) => setNewUserId(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white min-w-[200px]"
        >
          <option value="">Select user to add</option>
          {availableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.email || u.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !newUserId}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <span className="font-medium text-gray-900 dark:text-white">{m.full_name}</span>
            <button
              type="button"
              onClick={() => removeMember(m.id)}
              disabled={saving}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {members.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          No contractors in the pool yet. Add people above. When empty, all active users appear in the preference list
          dropdown.
        </p>
      )}
    </div>
  );
}
