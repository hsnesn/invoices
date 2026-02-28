"use client";

import { useState, useEffect } from "react";

type RoleItem = { role: string; label: string; canDelete: boolean };

export function DeletePermissionsSection() {
  const [roleList, setRoleList] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const refresh = () => {
    setLoading(true);
    fetch("/api/admin/delete-permissions")
      .then((r) => r.json())
      .then((d) => setRoleList(d.roleList ?? []))
      .catch(() => setRoleList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const toggleRole = (role: string) => {
    setRoleList((prev) =>
      prev.map((r) => (r.role === role ? { ...r, canDelete: !r.canDelete } : r))
    );
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const roles = roleList.filter((r) => r.canDelete).map((r) => r.role);
      const res = await fetch("/api/admin/delete-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "success", text: "Delete permissions saved." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error ?? "Save failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        Delete permissions (invoices)
      </h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Select which roles can delete invoices (guest, contractor, other). Submitters can only
        delete their own invoices when status is submitted, pending manager, or rejected.
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
        {roleList.map((r) => (
          <label
            key={r.role}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800/50"
          >
            <input
              type="checkbox"
              checked={r.canDelete}
              onChange={() => toggleRole(r.role)}
              className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="font-medium text-gray-900 dark:text-white">{r.label}</span>
            {r.role === "submitter" && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (own invoices only, when pending)
              </span>
            )}
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
