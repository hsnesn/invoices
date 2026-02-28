"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Profile = { id: string; full_name: string | null; role: string };
type RoleItem = { id: string; value: string; sort_order: number };
type ByUserItem = { userId: string; name: string; email: string; role: string; dates: string[] };
type ReqItem = { date: string; role: string; count_needed: number };
type AssignItem = { id: string; user_id: string; date: string; role: string | null; status: string };

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
  const [tab, setTab] = useState<"form" | "all" | "requirements" | "assignments">("form");
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
  const [monthLabel, setMonthLabel] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<ReqItem[]>([]);
  const [reqMonth, setReqMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reqByDate, setReqByDate] = useState<Record<string, Record<string, number>>>({});
  const [reqSaving, setReqSaving] = useState(false);
  const [editingReq, setEditingReq] = useState<{ date: string; role: string; val: string } | null>(null);
  const [assignments, setAssignments] = useState<AssignItem[]>([]);
  const [assignMonth, setAssignMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [assignMonthLabel, setAssignMonthLabel] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [assignNameMap, setAssignNameMap] = useState<Record<string, string>>({});
  const [assignEditable, setAssignEditable] = useState<AssignItem[]>([]);

  const canManage = profile?.role === "admin" || profile?.role === "operations" || profile?.role === "manager";

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
    if (!profile) return;
    fetch(`/api/contractor-availability/assignments?month=${month}`)
      .then((r) => r.json())
      .then((d) => {
        const confirmed = (d.assignments ?? []).filter((a: AssignItem) => a.status === "confirmed");
        setBookedDates(new Set(confirmed.map((a: AssignItem) => a.date)));
      })
      .catch(() => setBookedDates(new Set()));
  }, [profile, month]);

  useEffect(() => {
    if (!canManage || tab !== "all") return;
    fetch(`/api/contractor-availability/list?month=${listMonth}`)
      .then((r) => r.json())
      .then((d) => {
        setByUser(d.byUser ?? []);
        setMonthLabel(d.monthLabel ?? null);
        setRequirements(d.requirements ?? []);
      })
      .catch(() => {
        setByUser([]);
        setMonthLabel(null);
        setRequirements([]);
      });
  }, [canManage, tab, listMonth]);

  useEffect(() => {
    if (!canManage || tab !== "assignments") return;
    setAssignLoading(true);
    Promise.all([
      fetch(`/api/contractor-availability/assignments?month=${assignMonth}`).then((r) => r.json()),
      fetch(`/api/contractor-availability/list?month=${assignMonth}`).then((r) => r.json()),
    ])
      .then(([assignData, listData]) => {
        const arr = assignData.assignments ?? [];
        setAssignments(arr);
        setAssignEditable(arr);
        setAssignMonthLabel(assignData.monthLabel ?? null);
        const map: Record<string, string> = {};
        for (const u of listData.byUser ?? []) {
          map[u.userId] = u.name;
        }
        setAssignNameMap(map);
      })
      .catch(() => setAssignments([]))
      .finally(() => setAssignLoading(false));
  }, [canManage, tab, assignMonth]);

  useEffect(() => {
    if (!canManage || tab !== "requirements") return;
    fetch(`/api/contractor-availability/requirements?month=${reqMonth}`)
      .then((r) => r.json())
      .then((d) => {
        const byDate: Record<string, Record<string, number>> = {};
        for (const r of d.requirements ?? []) {
          if (!byDate[r.date]) byDate[r.date] = {};
          byDate[r.date][r.role] = r.count_needed;
        }
        setReqByDate(byDate);
      })
      .catch(() => setReqByDate({}));
  }, [canManage, tab, reqMonth]);

  const handleSetRequirement = async (dateStr: string, role: string, count: number) => {
    setReqSaving(true);
    try {
      if (count <= 0) {
        await fetch(`/api/contractor-availability/requirements?date=${dateStr}&role=${encodeURIComponent(role)}`, {
          method: "DELETE",
        });
      } else {
        await fetch("/api/contractor-availability/requirements", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr, role, count_needed: count }),
        });
      }
      setReqByDate((prev) => {
        const next = { ...prev };
        if (!next[dateStr]) next[dateStr] = {};
        if (count <= 0) delete next[dateStr][role];
        else next[dateStr][role] = count;
        return next;
      });
    } finally {
      setReqSaving(false);
    }
  };

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
        {canManage && (
          <>
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
            <button
              type="button"
              onClick={() => setTab("requirements")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === "requirements"
                  ? "bg-sky-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Daily Requirements
            </button>
            <button
              type="button"
              onClick={() => setTab("assignments")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === "assignments"
                  ? "bg-sky-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              Assignments
            </button>
          </>
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
              <div className="flex gap-2">
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, "0");
                    const y = month.split("-")[0];
                    const label = new Date(2000, i).toLocaleString("en-GB", { month: "long" });
                    return (
                      <option key={m} value={`${y}-${m}`}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={month.split("-")[0]}
                  onChange={(e) => {
                    const y = e.target.value;
                    const m = month.split("-")[1];
                    setMonth(`${y}-${m}`);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {Array.from({ length: 4 }, (_, i) => {
                    const y = new Date().getFullYear() - 1 + i;
                    return (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Select available days</p>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Click a day to toggle. Past days are disabled. <span className="text-emerald-600 dark:text-emerald-400">Green</span> = booked (confirmed).
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
                const isBooked = bookedDates.has(dateStr);
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
                        : isBooked
                          ? "bg-emerald-600 text-white hover:bg-emerald-500 ring-2 ring-emerald-400"
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

      {tab === "all" && canManage && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h2 className="mb-4 font-medium text-gray-900 dark:text-white">
            All contractor availability records {monthLabel && `– ${monthLabel}`}
          </h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
            <div className="flex gap-2">
              <select
                value={listMonth}
                onChange={(e) => setListMonth(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, "0");
                  const y = listMonth.split("-")[0];
                  const label = new Date(2000, i).toLocaleString("en-GB", { month: "long" });
                  return (
                    <option key={m} value={`${y}-${m}`}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <select
                value={listMonth.split("-")[0]}
                onChange={(e) => {
                  const y = e.target.value;
                  const m = listMonth.split("-")[1];
                  setListMonth(`${y}-${m}`);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {Array.from({ length: 4 }, (_, i) => {
                  const yr = new Date().getFullYear() - 1 + i;
                  return (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          {requirements.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">Demand (required per day)</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {requirements.map((r) => (
                  <span
                    key={`${r.date}-${r.role}`}
                    className="rounded bg-amber-100 px-2 py-0.5 dark:bg-amber-900/50"
                  >
                    {r.date.slice(8)} {r.role}: {r.count_needed}
                  </span>
                ))}
              </div>
            </div>
          )}
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

      {tab === "assignments" && canManage && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-white">
            Assignments {assignMonthLabel && `– ${assignMonthLabel}`}
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            AI suggests assignments from requirements and availability. Review, modify if needed, then approve to send confirmation emails.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              value={assignMonth}
              onChange={(e) => setAssignMonth(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, "0");
                const y = assignMonth.split("-")[0];
                const label = new Date(2000, i).toLocaleString("en-GB", { month: "long" });
                return (
                  <option key={m} value={`${y}-${m}`}>
                    {label}
                  </option>
                );
              })}
            </select>
            <select
              value={assignMonth.split("-")[0]}
              onChange={(e) => {
                const y = e.target.value;
                const m = assignMonth.split("-")[1];
                setAssignMonth(`${y}-${m}`);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {Array.from({ length: 4 }, (_, i) => {
                const yr = new Date().getFullYear() - 1 + i;
                return (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={async () => {
                setAssignSaving(true);
                try {
                  const res = await fetch("/api/contractor-availability/ai-suggest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ month: assignMonth }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    const r2 = await fetch(`/api/contractor-availability/assignments?month=${assignMonth}`);
                    const d2 = await r2.json();
                    const arr = d2.assignments ?? [];
                    setAssignments(arr);
                    setAssignEditable(arr);
                    setMessage({ type: "success", text: `AI suggested ${data.count ?? 0} assignments.` });
                    setTimeout(() => setMessage(null), 3000);
                  } else {
                    setMessage({ type: "error", text: data.error || "AI suggest failed." });
                  }
                } catch {
                  setMessage({ type: "error", text: "Connection error." });
                } finally {
                  setAssignSaving(false);
                }
              }}
              disabled={assignLoading || assignSaving}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {assignSaving ? "Running..." : "AI Suggest"}
            </button>
            <button
              type="button"
              onClick={async () => {
                setAssignSaving(true);
                try {
                  const pending = assignEditable.filter((a) => a.status === "pending");
                  const res = await fetch("/api/contractor-availability/assignments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "save",
                      month: assignMonth,
                      assignments: pending.map((a) => ({ user_id: a.user_id, date: a.date, role: a.role })),
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setMessage({ type: "success", text: "Changes saved." });
                    setTimeout(() => setMessage(null), 3000);
                    const r2 = await fetch(`/api/contractor-availability/assignments?month=${assignMonth}`);
                    const d2 = await r2.json();
                    setAssignments(d2.assignments ?? []);
                    setAssignEditable(d2.assignments ?? []);
                  } else {
                    setMessage({ type: "error", text: data.error || "Save failed." });
                  }
                } catch {
                  setMessage({ type: "error", text: "Connection error." });
                } finally {
                  setAssignSaving(false);
                }
              }}
              disabled={assignLoading || assignSaving}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={async () => {
                setAssignSaving(true);
                try {
                  const res = await fetch("/api/contractor-availability/assignments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "approve",
                      month: assignMonth,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setMessage({ type: "success", text: `Approved. Emails sent to ${data.approved ?? 0} people.` });
                    setTimeout(() => setMessage(null), 4000);
                    const r = await fetch(`/api/contractor-availability/assignments?month=${assignMonth}`);
                    const d = await r.json();
                    const arr = d.assignments ?? [];
                    setAssignments(arr);
                    setAssignEditable(arr);
                  } else {
                    setMessage({ type: "error", text: data.error || "Approve failed." });
                  }
                } catch {
                  setMessage({ type: "error", text: "Connection error." });
                } finally {
                  setAssignSaving(false);
                }
              }}
              disabled={assignLoading || assignSaving || assignments.filter((a) => a.status === "pending").length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Approve & Send Emails
            </button>
          </div>
          {message && tab === "assignments" && (
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
          {assignLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : assignEditable.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No assignments. Set daily requirements and availability, then click &quot;AI Suggest&quot;.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                    {assignEditable.some((a) => a.status === "pending") && (
                      <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300 w-12" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {assignEditable.map((a) => (
                    <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-gray-900 dark:text-white">
                        {assignNameMap[a.user_id] ?? a.user_id.slice(0, 8)}
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                        {new Date(a.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })}
                      </td>
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{a.role || "—"}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            a.status === "confirmed"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      {assignEditable.some((x) => x.status === "pending") && (
                        <td className="py-2 px-3">
                          {a.status === "pending" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setAssignEditable((prev) => prev.filter((x) => x.id !== a.id))
                              }
                              className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900/70"
                            >
                              Remove
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "requirements" && canManage && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Daily requirements (demand)</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Set how many people per role are needed each day. AI will use this for scheduling.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
            <div className="flex gap-2">
              <select
                value={reqMonth}
                onChange={(e) => setReqMonth(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, "0");
                  const y = reqMonth.split("-")[0];
                  const label = new Date(2000, i).toLocaleString("en-GB", { month: "long" });
                  return (
                    <option key={m} value={`${y}-${m}`}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <select
                value={reqMonth.split("-")[0]}
                onChange={(e) => {
                  const y = e.target.value;
                  const m = reqMonth.split("-")[1];
                  setReqMonth(`${y}-${m}`);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {Array.from({ length: 4 }, (_, i) => {
                  const yr = new Date().getFullYear() - 1 + i;
                  return (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
                  {roles.map((r) => (
                    <th key={r.id} className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                      {r.value}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getDaysInMonth(
                  parseInt(reqMonth.slice(0, 4), 10),
                  parseInt(reqMonth.slice(5, 7), 10)
                ).map((d) => {
                  const dateStr = toYMD(d);
                  return (
                    <tr key={dateStr} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                        {d.getDate()} {new Date(d).toLocaleDateString("en-GB", { weekday: "short" })}
                      </td>
                      {roles.map((r) => {
                        const isEditing = editingReq?.date === dateStr && editingReq?.role === r.value;
                        const displayVal = isEditing
                          ? editingReq!.val
                          : String(reqByDate[dateStr]?.[r.value] ?? "");
                        return (
                          <td key={r.id} className="py-1 px-2">
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={displayVal}
                              onChange={(e) =>
                                setEditingReq({ date: dateStr, role: r.value, val: e.target.value })
                              }
                              onFocus={() =>
                                setEditingReq({
                                  date: dateStr,
                                  role: r.value,
                                  val: String(reqByDate[dateStr]?.[r.value] ?? ""),
                                })
                              }
                              onBlur={(e) => {
                                const v = parseInt(e.target.value, 10);
                                handleSetRequirement(dateStr, r.value, Number.isNaN(v) ? 0 : Math.max(0, v));
                                setEditingReq(null);
                              }}
                              placeholder="0"
                              className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                              disabled={reqSaving}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
