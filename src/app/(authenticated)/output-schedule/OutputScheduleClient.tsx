"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Profile = { id: string; full_name: string | null; role: string };

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

export function OutputScheduleClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<"availability" | "admin">("availability");
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isAdminOrOps = profile?.role === "admin" || profile?.role === "operations";

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!profile) return;
    fetch(`/api/output-schedule/availability?month=${month}`)
      .then((r) => r.json())
      .then((d) => setSelectedDates(new Set((d.dates ?? []) as string[])))
      .catch(() => setSelectedDates(new Set()));
  }, [profile, month]);

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
        body: JSON.stringify({ dates: Array.from(selectedDates) }),
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
  const nextMonth = new Date(y, m, 1);
  const days = getDaysInMonth(y, m);

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
          onClick={() => setTab("availability")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === "availability"
              ? "bg-sky-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          My Availability
        </button>
        {isAdminOrOps && (
          <button
            type="button"
            onClick={() => setTab("admin")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === "admin"
                ? "bg-sky-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            Schedule & Settings
          </button>
        )}
      </div>

      {tab === "availability" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Select your available days</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Choose the days you are available for output in the next month. Click a day to toggle.
          </p>

          <div className="mb-4 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

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

          <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
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
                  className={`rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                    isPast
                      ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                      : isSelected
                        ? "bg-sky-600 text-white hover:bg-sky-500"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {d.getDate()}
                </button>
              );
            })}
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

      {tab === "admin" && isAdminOrOps && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h2 className="mb-4 font-medium text-gray-900 dark:text-white">Schedule & Settings</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            AI scheduling, booking emails, weekly report and attendance tracking will be available in the next update.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Phase 1 complete: availability form. Phase 2 (AI assign, emails) and Phase 3 (door log, attendance) coming soon.
          </div>
        </div>
      )}
    </div>
  );
}
