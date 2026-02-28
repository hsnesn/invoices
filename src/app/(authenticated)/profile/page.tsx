"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { UploadOverlay } from "@/components/UploadOverlay";
import { LogoLoader } from "@/components/LogoLoader";

type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  department_id: string | null;
  department_name: string | null;
  is_active: boolean;
  receive_invoice_emails: boolean;
  preferred_theme?: "light" | "dark" | null;
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
  const themeContext = useTheme();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editName, setEditName] = useState("");
  const [receiveInvoiceEmails, setReceiveInvoiceEmails] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !data || uploadingAvatar) return;
    setUploadingAvatar(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const result = await res.json();
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, avatar_url: result.avatar_url } : null));
        router.refresh();
      } else {
        setError(result?.error ?? "Upload failed.");
      }
    } catch {
      setError("Upload failed.");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    if (!data || uploadingAvatar) return;
    setUploadingAvatar(true);
    setError("");
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, avatar_url: null } : null));
        router.refresh();
      } else {
        setError("Failed to remove photo.");
      }
    } catch {
      setError("Failed to remove photo.");
    } finally {
      setUploadingAvatar(false);
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
    const isDark = themeContext?.theme === "dark";
    return (
      <div className="mx-auto max-w-xl py-12 flex flex-col items-center justify-center gap-4">
        <LogoLoader size="md" variant={isDark ? "light" : "dark"} />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
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
    <>
      {uploadingAvatar && <UploadOverlay message="Uploading..." />}
      <div className="mx-auto max-w-xl py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Profile</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* Profile photo */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Profile Photo</label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ring-2 ring-gray-300 dark:ring-gray-600">
              {data.avatar_url ? (
                <img src={data.avatar_url} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-medium text-gray-500 dark:text-gray-400">
                  {(data.full_name || data.email || "?")[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
                {uploadingAvatar ? "Uploading..." : data.avatar_url ? "Change photo" : "Add photo"}
              </label>
              {data.avatar_url && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={uploadingAvatar}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">JPEG, PNG or WebP. Max 2MB.</p>
        </div>

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

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Theme</label>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            Choose light or dark mode. Saved to your preference across devices.
          </p>
          {themeContext && (
            <button
              type="button"
              onClick={themeContext.toggleTheme}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Switch to {themeContext.theme === "light" ? "dark" : "light"} mode
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
