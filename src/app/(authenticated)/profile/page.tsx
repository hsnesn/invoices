"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  department_id: string | null;
  department_name: string | null;
  is_active: boolean;
  receive_invoice_emails: boolean;
  created_at?: string;
  updated_at?: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  finance: "Finance",
  operations: "Operations",
  submitter: "Submitter",
  viewer: "Viewer",
};

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editName, setEditName] = useState("");
  const [receiveInvoiceEmails, setReceiveInvoiceEmails] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load profile");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setEditName(d.full_name ?? "");
        setReceiveInvoiceEmails(d.receive_invoice_emails !== false);
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: editName.trim() || null }),
      });
      const result = await res.json();
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, full_name: result.full_name } : null));
        router.refresh();
      } else {
        setError(result?.error ?? "Failed to update name.");
      }
    } catch {
      setError("Connection error.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmailPref = async (checked: boolean) => {
    if (!data || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receive_invoice_emails: checked }),
      });
      const result = await res.json();
      if (res.ok) {
        setReceiveInvoiceEmails(checked);
        setData((prev) => (prev ? { ...prev, receive_invoice_emails: checked } : null));
        router.refresh();
      } else {
        setError(result?.error ?? "Failed to update preference.");
      }
    } catch {
      setError("Connection error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-xl py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Profile</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* Name - editable */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
          <form onSubmit={handleSaveName} className="flex gap-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={255}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Enter your name"
            />
            <button
              type="submit"
              disabled={saving || editName.trim() === (data.full_name ?? "")}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </form>
          <p className="mt-1 text-xs text-gray-400">{editName.length}/255</p>
        </div>

        {/* Read-only info */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
            {data.email ?? "—"}
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Role</label>
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
            {ROLE_LABELS[data.role] ?? data.role}
          </p>
        </div>

        {data.department_name && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Department</label>
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
              {data.department_name}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-400">
            {data.is_active ? (
              <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Inactive
              </span>
            )}
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email Preferences</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700/50">
            <input
              type="checkbox"
              checked={receiveInvoiceEmails}
              onChange={(e) => handleToggleEmailPref(e.target.checked)}
              disabled={saving}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Receive invoice update emails
            </span>
          </label>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            When off, invoice status emails (approval, rejection, etc.) are not sent. Booking form emails are always sent.
          </p>
        </div>
      </div>
    </div>
  );
}
