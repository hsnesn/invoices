"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Profile = { id: string; full_name: string | null; role: string };
type RoleItem = { id: string; value: string; sort_order: number };
type ByUserItem = { userId: string; name: string; email: string; role: string; dates: string[] };

function getDaysInMonth(year: number, month: number): Date[] {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ContractorAvailabilityClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [tab, setTab] = useState<"form" | "all">("form");
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [byUser, setByUser] = useState<ByUserItem[]>([]);
  const [listMonth, setListMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  const isAdminOrOps = profile?.role === "admin" || profile?.role === "operations";

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/contractor-availability/roles")
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/output-schedule/availability?month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        setSelectedDates(new Set((d.dates ?? []) as string[]));
        if (d.role) setSelectedRole(d.role);
      })
      .catch(() => setSelectedDates(new Set()));
  }, [profile, month]);

  useEffect(() => {
    if (!isAdminOrOps || tab !== "all") return;
    fetch(`/api/contractor-availability/list?month=${listMonth}`)
      .then((r) => r.json())
      .then((d) => setByUser(d.byUser ?? []))
      .catch(() => setByUser([]));
  }, [isAdminOrOps, tab, listMonth]);

  const handleToggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const handleSaveAvailability = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/output-schedule/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: Array.from(selectedDates), role: selectedRole || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Availability saved." });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const [y, m] = month.split("-").map(Number);
  const days = getDaysInMonth(y, m);
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
  const padStart = Array.from({ length: firstDayOfWeek }, (_, i) => (
    <div key={`pad-${i}`} className="aspect-square min-w-[2.25rem]" />
  ));

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("form")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "form"
              ? "bg-sky-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          My Availability
        </button>
        {isAdminOrOps && (
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === "all"
                ? "bg-sky-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            All Records
          </button>
        )}
      </div>

      {tab === "form" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Submit your availability</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Your name, role and available days. Each submission creates a record. Others see only their own; admin sees all.
          </p>

          <div className="mb-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={profile?.full_name ?? ""}
                readOnly
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 w-full max-w-xs"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white max-w-xs"
              >
                <option value="">Select role...</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.value}>
                    {r.value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Select available days</p>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">Click a day to toggle. Past days are disabled.</p>

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

          <div className="max-w-md rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/50">
            <div className="grid grid-cols-7 gap-2 place-items-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="w-full flex justify-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1.5">
                  {d}
                </div>
              ))}
              {padStart}
              {days.map((d) => {
                const dateStr = toYMD(d);
                const isSelected = selectedDates.has(dateStr);
                const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => !isPast && handleToggleDate(dateStr)}
                    disabled={isPast}
                    className={`aspect-square min-w-[2.25rem] w-full max-w-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      isPast
                        ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                        : isSelected
                          ? "bg-sky-600 text-white hover:bg-sky-500"
                          : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 border border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAvailability}
              disabled={saving}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Availability"}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedDates.size} day{selectedDates.size !== 1 ? "s" : ""} selected
            </span>
          </div>
        </div>
      )}

      {tab === "all" && isAdminOrOps && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h2 className="mb-4 font-medium text-gray-900 dark:text-white">All contractor availability records</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
            <input
              type="month"
              value={listMonth}
              onChange={(e) => setListMonth(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          {byUser.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No records for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((u) => (
                    <tr key={u.userId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-gray-900 dark:text-white">{u.name}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{u.role || "—"}</td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                        {u.dates.map((d) => d.slice(8)).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
