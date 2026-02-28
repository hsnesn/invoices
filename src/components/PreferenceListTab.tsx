"use client";

import { useState, useEffect } from "react";

type PrefUser = { user_id: string; full_name: string };
type UserOption = { id: string; full_name: string };

export function PreferenceListTab() {
  const [users, setUsers] = useState<PrefUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addUserId, setAddUserId] = useState("");

  const fetchList = () => {
    fetch("/api/contractor-availability/preference-list-mine")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d.users) ? d.users : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    fetch("/api/contractor-availability/preference-list-users")
      .then((r) => r.json())
      .then((d) => setAllUsers(Array.isArray(d) ? d : []))
      .catch(() => setAllUsers([]));
  }, []);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserId.trim()) return;
    const newIds = [...users.map((u) => u.user_id), addUserId];
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: newIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddUserId("");
        setMessage({ type: "success", text: "Added to your preference list." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (userId: string) => {
    const newIds = users.map((u) => u.user_id).filter((id) => id !== userId);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: newIds }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Removed from your preference list." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to remove." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const moveUp = async (index: number) => {
    if (index <= 0) return;
    const ids = users.map((u) => u.user_id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Order updated." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const moveDown = async (index: number) => {
    if (index >= users.length - 1) return;
    const ids = users.map((u) => u.user_id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Order updated." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const inList = new Set(users.map((u) => u.user_id));
  const availableUsers = allUsers.filter((u) => !inList.has(u.id));

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading your preference list...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-violet-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
        My Preference List
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        People you prefer to work with. AI will prefer assigning people who appear in more users&apos; lists when they
        are available. Order matters: higher in the list = higher preference.
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

      <form onSubmit={addUser} className="mb-4 flex flex-wrap gap-2">
        <select
          value={addUserId}
          onChange={(e) => setAddUserId(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white min-w-[200px]"
        >
          <option value="">Select person to add</option>
          {availableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !addUserId}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {users.map((u, i) => (
          <li
            key={u.user_id}
            className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-6 shrink-0">{i + 1}.</span>
              <span className="font-medium text-gray-900 dark:text-white truncate">{u.full_name}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={saving || i === 0}
                className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                title="Move up"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={saving || i === users.length - 1}
                className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                title="Move down"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => removeUser(u.user_id)}
                disabled={saving}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {users.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          No one in your preference list yet. Add people above. AI will prefer them when they are available.
        </p>
      )}
    </div>
  );
}
