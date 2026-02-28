"use client";

import { useState, useEffect } from "react";

type UserOption = { id: string; full_name: string | null; email?: string | null; role: string };

export function GuestContactsSetupSection() {
  const [producerScoped, setProducerScoped] = useState(false);
  const [exportRestricted, setExportRestricted] = useState(false);
  const [exportUserIds, setExportUserIds] = useState<string[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const load = async () => {
    try {
      const [settingsRes, usersRes] = await Promise.all([
        fetch("/api/admin/app-settings"),
        fetch("/api/admin/users"),
      ]);
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setProducerScoped(s.guest_contacts_producer_scoped === true);
        setExportRestricted(s.guest_contacts_export_restricted === true);
        const ids = s.guest_contacts_export_user_ids;
        setExportUserIds(Array.isArray(ids) ? ids : []);
      }
      if (usersRes.ok) {
        const u = await usersRes.json();
        setUsers(Array.isArray(u) ? u : []);
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load settings." });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveSetting = async (key: string, value: unknown) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Saved." });
      } else {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: (d as { error?: string }).error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save." });
    } finally {
      setLoading(false);
    }
  };

  const toggleProducerScoped = () => {
    const next = !producerScoped;
    setProducerScoped(next);
    saveSetting("guest_contacts_producer_scoped", next);
  };

  const toggleExportRestricted = () => {
    const next = !exportRestricted;
    setExportRestricted(next);
    saveSetting("guest_contacts_export_restricted", next);
  };

  const toggleExportUser = (userId: string) => {
    const next = exportUserIds.includes(userId)
      ? exportUserIds.filter((id) => id !== userId)
      : [...exportUserIds, userId];
    setExportUserIds(next);
    saveSetting("guest_contacts_export_user_ids", next);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-4 font-medium text-gray-900 dark:text-white">Guest Contacts</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Control who sees which contacts and who can export. Admin and managers always see all contacts.
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

        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Producer-scoped visibility</span>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                When enabled, producers see only guests they invited or marked as paid/unpaid in Invited Guests. Admin and managers see all.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={producerScoped}
              onClick={toggleProducerScoped}
              disabled={loading}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                producerScoped ? "bg-violet-600" : "bg-gray-200 dark:bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  producerScoped ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
            <div>
              <span className="font-medium text-gray-900 dark:text-white">Restrict export</span>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                When enabled, only admin and users below can export. When disabled, all with Guest Contacts access can export.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={exportRestricted}
              onClick={toggleExportRestricted}
              disabled={loading}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                exportRestricted ? "bg-violet-600" : "bg-gray-200 dark:bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  exportRestricted ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>

          {exportRestricted && (
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="mb-2 font-medium text-gray-900 dark:text-white">Users who can export</h3>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Select users (besides admin) who are allowed to export the contact list.
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {users
                  .filter((u) => u.role !== "admin")
                  .map((u) => (
                    <label key={u.id} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportUserIds.includes(u.id)}
                        onChange={() => toggleExportUser(u.id)}
                        className="h-4 w-4 rounded text-violet-600"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {u.full_name || u.email || u.id.slice(0, 8)}
                        <span className="ml-1 text-gray-500">({u.role})</span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
