"use client";

import { useState, useEffect } from "react";

type RoleItem = { id: string; value: string; sort_order: number };
type ApprovalUser = { id: string; full_name: string; role: string; canApprove: boolean };

export function ContractorAvailabilityRolesSection() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [newRole, setNewRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [approvalUsers, setApprovalUsers] = useState<ApprovalUser[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [approvalSaving, setApprovalSaving] = useState(false);

  const fetchRoles = () => {
    fetch("/api/contractor-availability/roles")
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  };

  const fetchApprovalSettings = () => {
    fetch("/api/contractor-availability/approval-settings")
      .then((r) => r.json())
      .then((d) => setApprovalUsers(Array.isArray(d.users) ? d.users : []))
      .catch(() => setApprovalUsers([]))
      .finally(() => setApprovalLoading(false));
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    fetchApprovalSettings();
  }, []);

  const handleAdd = async () => {
    const val = newRole.trim();
    if (!val) {
      setMessage({ type: "error", text: "Enter a role name." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewRole("");
        setMessage({ type: "success", text: "Role added." });
        fetchRoles();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/contractor-availability/roles?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Role removed." });
        fetchRoles();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to remove." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading roles...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-sky-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
        Contractor Availability Roles
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Roles shown in the Contractor Availability form. Add or remove as needed.
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

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          placeholder="New role (e.g. Output, Camera)"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white w-48"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !newRole.trim()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <ul className="space-y-2">
        {roles.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <span className="font-medium text-gray-900 dark:text-white">{r.value}</span>
            <button
              type="button"
              onClick={() => handleDelete(r.id)}
              disabled={saving}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {/* Approval users */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Who can approve assignments
        </h3>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Admin can always approve. Select which operations/manager users can also approve contractor assignments.
        </p>
        {approvalLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : (
          <ul className="space-y-2">
            {approvalUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{u.full_name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">({u.role})</span>
                </div>
                {u.role === "admin" ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Always can approve</span>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={u.canApprove}
                      onChange={async (e) => {
                        setApprovalSaving(true);
                        const base = approvalUsers.filter((x) => x.canApprove && x.role !== "admin").map((x) => x.id);
                        const newIds = e.target.checked
                          ? Array.from(new Set([...base, u.id]))
                          : base.filter((id) => id !== u.id);
                        try {
                          const res = await fetch("/api/contractor-availability/approval-settings", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userIds: newIds }),
                          });
                          if (res.ok) fetchApprovalSettings();
                        } finally {
                          setApprovalSaving(false);
                        }
                      }}
                      disabled={approvalSaving}
                      className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Can approve</span>
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
