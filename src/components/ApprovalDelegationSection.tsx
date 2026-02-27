"use client";

import { useState, useEffect } from "react";

type DelegationRow = {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  valid_from: string;
  valid_until: string;
  delegator_name: string;
  delegate_name: string;
};

type UserOption = { id: string; full_name: string | null; email?: string | null; role: string; is_active?: boolean };

export function ApprovalDelegationSection() {
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    delegator_user_id: "",
    delegate_user_id: "",
    valid_from: "",
    valid_until: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ valid_from: string; valid_until: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = () => {
    fetch("/api/admin/approval-delegations")
      .then((r) => r.json())
      .then((d) => setDelegations(Array.isArray(d) ? d : []))
      .catch(() => setDelegations([]));
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  const managerUsers = users.filter((u) => u.is_active !== false && (u.role === "manager" || u.role === "admin"));

  const addDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.delegator_user_id || !form.delegate_user_id || !form.valid_from || !form.valid_until) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/approval-delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        refresh();
        setForm({ delegator_user_id: "", delegate_user_id: "", valid_from: "", valid_until: "" });
        setShowForm(false);
        setMessage({ type: "success", text: "Delegation added." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const updateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editForm) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/approval-delegations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        refresh();
        setEditingId(null);
        setEditForm(null);
        setMessage({ type: "success", text: "Delegation updated." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const removeDelegation = async () => {
    if (!deleteId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/approval-delegations?id=${deleteId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      setDeleteId(null);
      if (res.ok) {
        refresh();
        setMessage({ type: "success", text: "Delegation removed." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed." });
      }
    } catch {
      setDeleteId(null);
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-sky-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
        Approval Delegation
        <span className="text-xs font-normal text-gray-400">({delegations.length})</span>
      </h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        When a manager is absent, assign a backup approver. During the valid date range, the delegate can approve or reject invoices assigned to the delegator.
      </p>
      {message && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${
          message.type === "success"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
            : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {showForm ? (
        <form onSubmit={addDelegation} className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">Add delegation</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Manager (delegator)</label>
              <select
                value={form.delegator_user_id}
                onChange={(e) => setForm((f) => ({ ...f, delegator_user_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              >
                <option value="">Select manager</option>
                {managerUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email || u.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Backup approver (delegate)</label>
              <select
                value={form.delegate_user_id}
                onChange={(e) => setForm((f) => ({ ...f, delegate_user_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              >
                <option value="">Select delegate</option>
                {managerUsers.filter((u) => u.id !== form.delegator_user_id).map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email || u.id.slice(0, 8)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Valid from</label>
              <input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Valid until</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                min={form.valid_from || today}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              Add
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mb-4 rounded-lg border border-dashed border-sky-400 px-4 py-2 text-sm text-sky-600 hover:bg-sky-50 dark:border-sky-600 dark:text-sky-400 dark:hover:bg-sky-900/30"
        >
          + Add delegation
        </button>
      )}

      <ul className="space-y-2 text-sm">
        {delegations.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
            {editingId === d.id && editForm ? (
              <form className="flex flex-1 flex-wrap items-center gap-2" onSubmit={updateDelegation}>
                <span className="text-gray-700 dark:text-gray-300">{d.delegator_name} → {d.delegate_name}</span>
                <input
                  type="date"
                  value={editForm.valid_from}
                  onChange={(e) => setEditForm((f) => f ? { ...f, valid_from: e.target.value } : null)}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={editForm.valid_until}
                  onChange={(e) => setEditForm((f) => f ? { ...f, valid_until: e.target.value } : null)}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <button type="submit" disabled={loading} className="rounded bg-sky-600 px-2 py-1 text-sm text-white">Save</button>
                <button type="button" onClick={() => { setEditingId(null); setEditForm(null); }} className="rounded bg-gray-200 px-2 py-1 text-sm text-gray-700 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
              </form>
            ) : (
              <>
                <span className="text-gray-800 dark:text-gray-200">
                  <strong>{d.delegator_name}</strong> → <strong>{d.delegate_name}</strong>
                  <span className="ml-2 text-gray-500">({d.valid_from} – {d.valid_until})</span>
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => { setEditingId(d.id); setEditForm({ valid_from: d.valid_from, valid_until: d.valid_until }); }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    title="Edit dates"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(d.id)}
                    className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-300"
                    title="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
        {delegations.length === 0 && <li className="py-2 text-gray-400">No delegations yet. Add one when a manager will be absent.</li>}
      </ul>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-4 text-gray-800 dark:text-gray-200">Remove this delegation?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={removeDelegation} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50">Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
