"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

type Profile = { id: string; full_name: string | null; role: string };

type RoleItem = { id: string; value: string; sort_order: number };
type ByUserItem = { userId: string; name: string; email: string; role: string; dates: string[] };
type ReqItem = { date: string; role: string; count_needed: number };
type RecurringItem = { id: string; day_of_week: number; role: string; count_needed: number; dayLabel?: string };

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

export function RequestClient() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reqByDate, setReqByDate] = useState<Record<string, Record<string, number>>>({});
  const [reqSaving, setReqSaving] = useState(false);
  const [editingReq, setEditingReq] = useState<{ date: string; role: string; val: string } | null>(null);
  const [byUser, setByUser] = useState<ByUserItem[]>([]);
  const [requirements, setRequirements] = useState<ReqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [applyRecurringLoading, setApplyRecurringLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string; department_id: string }[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");

  /** Only admin and operations can run AI suggest. Manager can only enter demand. */
  const canRunAiSuggest = profile?.role === "admin" || profile?.role === "operations";
  const canManage = profile?.role === "admin" || profile?.role === "operations" || profile?.role === "manager";

  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : [];
        setDepartments(arr);
      })
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      setPrograms([]);
      setSelectedProgram("");
      return;
    }
    fetch(`/api/programs?department_id=${selectedDepartment}`)
      .then((r) => r.json())
      .then((d) => setPrograms(Array.isArray(d) ? d : []))
      .catch(() => setPrograms([]));
    setSelectedProgram("");
  }, [selectedDepartment]);

  useEffect(() => {
    fetch("/api/contractor-availability/roles")
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const reqParams = new URLSearchParams({ month, department_id: selectedDepartment });
    if (selectedProgram) reqParams.set("program_id", selectedProgram);
    const listParams = new URLSearchParams({ month, department_id: selectedDepartment });
    if (selectedProgram) listParams.set("program_id", selectedProgram);
    Promise.all([
      fetch(`/api/contractor-availability/requirements?${reqParams}`).then((r) => r.json()),
      fetch(`/api/contractor-availability/list?${listParams}`).then((r) => r.json()),
    ])
      .then(([reqData, listData]) => {
        const byDate: Record<string, Record<string, number>> = {};
        for (const r of reqData.requirements ?? []) {
          if (!byDate[r.date]) byDate[r.date] = {};
          byDate[r.date][r.role] = r.count_needed;
        }
        setReqByDate(byDate);
        setRequirements(reqData.requirements ?? []);
        setByUser(listData.byUser ?? []);
      })
      .catch(() => {
        setReqByDate({});
        setRequirements([]);
        setByUser([]);
      })
      .finally(() => setLoading(false));
  }, [month, selectedDepartment, selectedProgram]);

  useEffect(() => {
    if (!canManage || !selectedDepartment) return;
    const params = new URLSearchParams({ department_id: selectedDepartment });
    if (selectedProgram) params.set("program_id", selectedProgram);
    fetch(`/api/contractor-availability/recurring-requirements?${params}`)
      .then((r) => r.json())
      .then((d) => setRecurring(Array.isArray(d) ? d : []))
      .catch(() => setRecurring([]));
  }, [canManage, selectedDepartment, selectedProgram]);

  const handleSetRequirement = async (dateStr: string, role: string, count: number) => {
    if (!selectedDepartment) return;
    setReqSaving(true);
    try {
      if (count <= 0) {
        const params = new URLSearchParams({ date: dateStr, role: encodeURIComponent(role), department_id: selectedDepartment });
        if (selectedProgram) params.set("program_id", selectedProgram);
        await fetch(`/api/contractor-availability/requirements?${params}`, { method: "DELETE" });
      } else {
        await fetch("/api/contractor-availability/requirements", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: dateStr,
            role,
            count_needed: count,
            department_id: selectedDepartment,
            program_id: selectedProgram || undefined,
          }),
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

  const handleAiSuggest = async () => {
    setAiLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `AI suggested ${data.count ?? 0} assignments. Go to My Availability to review and approve.` });
      } else {
        setMessage({ type: "error", text: data.error || "AI suggest failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setAiLoading(false);
    }
  };

  const supplyByDateRole = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of byUser) {
      for (const date of u.dates) {
        const role = u.role || "";
        const key = `${date}|${role}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [byUser]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-12 dark:border-gray-700/60 dark:bg-gray-900/40 shadow-sm">
        <div className="flex items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-400" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const days = getDaysInMonth(y, m);

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      {/* Filters */}
      <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-4 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-end gap-4 sm:gap-6">
          <div className="min-w-[140px]">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:focus:border-gray-500 dark:focus:bg-gray-800 dark:focus:ring-gray-700"
            >
              <option value="">Select department...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[120px]">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Program</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:focus:border-gray-500 dark:focus:bg-gray-800 dark:focus:ring-gray-700"
            >
              <option value="">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="min-w-[100px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:focus:border-gray-500 dark:focus:bg-gray-800 dark:focus:ring-gray-700"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const mo = String(i + 1).padStart(2, "0");
                  const yr = month.split("-")[0];
                  const label = new Date(2000, i).toLocaleString("en-GB", { month: "long" });
                  return (
                    <option key={mo} value={`${yr}-${mo}`}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="min-w-[70px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Year</label>
              <select
                value={month.split("-")[0]}
                onChange={(e) => {
                  const yr = e.target.value;
                  const mo = month.split("-")[1];
                  setMonth(`${yr}-${mo}`);
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:focus:border-gray-500 dark:focus:bg-gray-800 dark:focus:ring-gray-700"
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
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-rose-200 bg-rose-50/80 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 min-w-0 overflow-hidden">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recurring rules</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Set default headcount per weekday (e.g. every Monday 2 Output). Apply to month to generate requirements.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              id="req-rec-day"
              className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm font-medium dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
            >
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <select
              id="req-rec-role"
              className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm font-medium dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.value}>{r.value}</option>
              ))}
            </select>
            <input
              type="number"
              id="req-rec-count"
              min={1}
              max={99}
              defaultValue={1}
              className="w-16 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm font-medium text-center dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
            />
            <button
              type="button"
              onClick={async () => {
                if (!selectedDepartment) {
                  setMessage({ type: "error", text: "Please select a department first." });
                  return;
                }
                const dayEl = document.getElementById("req-rec-day") as HTMLSelectElement;
                const roleEl = document.getElementById("req-rec-role") as HTMLSelectElement;
                const countEl = document.getElementById("req-rec-count") as HTMLInputElement;
                if (!dayEl || !roleEl || !countEl) return;
                const day_of_week = parseInt(dayEl.value, 10);
                const role = roleEl.value;
                const count = Math.max(1, Math.min(99, parseInt(countEl.value, 10) || 1));
                if (!role) return;
                setRecurringSaving(true);
                try {
                  const res = await fetch("/api/contractor-availability/recurring-requirements", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      day_of_week,
                      role,
                      count_needed: count,
                      department_id: selectedDepartment,
                      program_id: selectedProgram || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setRecurring((prev) => [...prev.filter((x) => !(x.day_of_week === day_of_week && x.role === role)), { id: data.id, day_of_week, role, count_needed: count, dayLabel: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day_of_week] }]);
                    countEl.value = "1";
                  } else {
                    setMessage({ type: "error", text: data.error || "Failed to add recurring." });
                  }
                } catch {
                  setMessage({ type: "error", text: "Connection error." });
                } finally {
                  setRecurringSaving(false);
                }
              }}
              disabled={recurringSaving || roles.length === 0}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Add
            </button>
            <button
              type="button"
              onClick={async () => {
                setApplyRecurringLoading(true);
                setMessage(null);
                try {
                  const res = await fetch("/api/contractor-availability/requirements/apply-recurring", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      month,
                      department_id: selectedDepartment,
                      program_id: selectedProgram || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setMessage({ type: "success", text: `Applied ${data.count ?? 0} requirements from recurring rules.` });
                    setTimeout(() => setMessage(null), 3000);
                    const reqParams = new URLSearchParams({ month, department_id: selectedDepartment });
                    if (selectedProgram) reqParams.set("program_id", selectedProgram);
                    const r = await fetch(`/api/contractor-availability/requirements?${reqParams}`);
                    const d = await r.json();
                    const byDate: Record<string, Record<string, number>> = {};
                    for (const x of d.requirements ?? []) {
                      if (!byDate[x.date]) byDate[x.date] = {};
                      byDate[x.date][x.role] = x.count_needed;
                    }
                    setReqByDate(byDate);
                    setRequirements(d.requirements ?? []);
                  } else {
                    setMessage({ type: "error", text: data.error || "Apply failed." });
                  }
                } catch {
                  setMessage({ type: "error", text: "Connection error." });
                } finally {
                  setApplyRecurringLoading(false);
                }
              }}
              disabled={applyRecurringLoading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {applyRecurringLoading ? "Applying…" : "Apply to month"}
            </button>
          </div>
          {recurring.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recurring.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  Every {(r.dayLabel ?? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][r.day_of_week])} · {r.role}: {r.count_needed}
                  <button
                    type="button"
                    onClick={async () => {
                      setRecurringSaving(true);
                      try {
                        const res = await fetch(`/api/contractor-availability/recurring-requirements?id=${r.id}`, { method: "DELETE" });
                        if (res.ok) setRecurring((prev) => prev.filter((x) => x.id !== r.id));
                      } finally {
                        setRecurringSaving(false);
                      }
                    }}
                    disabled={recurringSaving}
                    className="ml-0.5 -mr-1 rounded-full p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    aria-label="Remove"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Demand</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              People needed per role per day · {monthLabel}
            </p>
          </div>
          {roles.length > 0 && (() => {
            const weekdayCount = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).length;
            return (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Fill weekdays:</span>
                <div className="flex gap-1.5">
                {roles.map((r) => {
                  const total = days
                    .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
                    .reduce((s, d) => s + (reqByDate[toYMD(d)]?.[r.value] ?? 0), 0);
                  const avg = weekdayCount > 0 ? Math.round(total / weekdayCount) : 0;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      title={`Fill all weekdays with selected count for ${r.value}`}
                      onClick={async () => {
                        const val = prompt(`Set all weekdays for "${r.value}" to:`, String(avg || 1));
                        if (val == null) return;
                        const n = Math.max(0, Math.min(99, parseInt(val, 10) || 0));
                        if (!selectedDepartment) return;
                        setReqSaving(true);
                        try {
                          const weekdayDates = days
                            .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
                            .map((d) => toYMD(d));
                          await Promise.all(
                            weekdayDates.map((dateStr) =>
                              fetch("/api/contractor-availability/requirements", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  date: dateStr,
                                  role: r.value,
                                  count_needed: n,
                                  department_id: selectedDepartment,
                                  program_id: selectedProgram || undefined,
                                }),
                              })
                            )
                          );
                          const reqParams = new URLSearchParams({ month, department_id: selectedDepartment });
                          if (selectedProgram) reqParams.set("program_id", selectedProgram);
                          const res = await fetch(`/api/contractor-availability/requirements?${reqParams}`);
                          const d = await res.json();
                          const byDate: Record<string, Record<string, number>> = {};
                          for (const x of d.requirements ?? []) {
                            if (!byDate[x.date]) byDate[x.date] = {};
                            byDate[x.date][x.role] = x.count_needed;
                          }
                          setReqByDate(byDate);
                          setRequirements(d.requirements ?? []);
                        } finally {
                          setReqSaving(false);
                        }
                      }}
                      disabled={reqSaving}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:border-gray-300 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {r.value}
                    </button>
                  );
                })}
                </div>
              </div>
            );
          })()}
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 max-h-[58vh] overflow-y-auto">
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-gray-900/95 backdrop-blur-sm">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Date</th>
                {roles.map((r) => (
                  <th key={r.id} className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {r.value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d, idx) => {
                const dateStr = toYMD(d);
                const dayOfWeek = d.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isMonday = dayOfWeek === 1 && idx > 0;
                const hasAnyValue = roles.some((r) => (reqByDate[dateStr]?.[r.value] ?? 0) > 0);
                return (
                  <tr
                    key={dateStr}
                    className={`border-b border-gray-100 transition-colors dark:border-gray-800/80 ${
                      isMonday ? "border-t-2 border-t-gray-200 dark:border-t-gray-700" : ""
                    } ${
                      isWeekend
                        ? "bg-gray-50/80 dark:bg-gray-800/20"
                        : hasAnyValue
                        ? "bg-white dark:bg-gray-900/20"
                        : ""
                    }`}
                  >
                    <td className={`py-2 px-3 text-xs sm:text-sm whitespace-nowrap ${
                      isWeekend
                        ? "text-gray-400 dark:text-gray-500"
                        : "text-gray-700 dark:text-gray-300 font-medium"
                    }`}>
                      <span className="inline-block w-6 text-right tabular-nums mr-2">{d.getDate()}</span>
                      <span>{new Date(d).toLocaleDateString("en-GB", { weekday: "short" })}</span>
                    </td>
                    {roles.map((r) => {
                      const isEditing = editingReq?.date === dateStr && editingReq?.role === r.value;
                      const stored = reqByDate[dateStr]?.[r.value] ?? 0;
                      const displayVal = isEditing ? editingReq!.val : stored > 0 ? String(stored) : "";
                      const supply = supplyByDateRole.get(`${dateStr}|${r.value}`) ?? 0;
                      const hasDemand = stored > 0;
                      const isMet = hasDemand && supply >= stored;
                      const isShort = hasDemand && supply < stored;
                      return (
                        <td key={r.id} className="py-1.5 px-2 text-center">
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
                            placeholder={isWeekend ? "—" : "0"}
                            className={`w-11 sm:w-12 rounded-lg border px-1.5 py-1.5 text-center text-xs sm:text-sm font-medium tabular-nums transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${
                              isMet
                                ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 focus:ring-emerald-200 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:focus:ring-emerald-800/50"
                                : isShort
                                ? "border-rose-200 bg-rose-50/80 text-rose-800 focus:ring-rose-200 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200 dark:focus:ring-rose-800/50"
                                : hasDemand
                                ? "border-gray-300 bg-gray-50 text-gray-900 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-gray-600"
                                : isWeekend
                                ? "border-gray-200 bg-gray-50/50 text-gray-400 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500 dark:focus:ring-gray-700"
                                : "border-gray-200 bg-white text-gray-700 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-200 dark:focus:ring-gray-600"
                            }`}
                            disabled={reqSaving}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/50">
                <td className="py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total</td>
                {roles.map((r) => {
                  const total = days.reduce((s, d) => s + (reqByDate[toYMD(d)]?.[r.value] ?? 0), 0);
                  return (
                    <td key={r.id} className="py-3 px-2 text-center text-sm font-bold tabular-nums text-gray-800 dark:text-gray-200">
                      {total > 0 ? total : "—"}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 min-w-0 overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Supply</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Contractors who submitted availability for {monthLabel}.
          </p>
        </div>
        {byUser.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No availability submitted for this month.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Days</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((u) => (
                  <tr key={u.userId} className="border-b border-gray-100 transition-colors hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/30">
                    <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-white max-w-[140px] truncate" title={u.name}>{u.name}</td>
                    <td className="py-2.5 px-4 text-gray-600 dark:text-gray-400">{u.role || "—"}</td>
                    <td className="py-2.5 px-4 text-gray-500 dark:text-gray-500 text-xs tabular-nums">
                      {u.dates.map((day) => day.slice(8)).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {requirements.length > 0 && (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 min-w-0 overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Demand vs Supply</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Compare required headcount with available contractors per day and role.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Demand</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Supply</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => {
                  const supply = supplyByDateRole.get(`${r.date}|${r.role}`) ?? 0;
                  const ok = supply >= r.count_needed;
                  return (
                    <tr key={`${r.date}-${r.role}`} className="border-b border-gray-100 transition-colors hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/30">
                      <td className="py-2.5 px-4 text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                        {new Date(r.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-gray-800 dark:text-gray-200">{r.role}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.count_needed}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-600 dark:text-gray-400">{supply}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ok
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
                          }`}
                        >
                          {ok ? "OK" : "Short"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center min-w-0 pt-2">
        {canRunAiSuggest && (
          <button
            type="button"
            onClick={handleAiSuggest}
            disabled={aiLoading || requirements.length === 0}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {aiLoading ? "Running AI…" : "AI Suggest Assignments"}
          </button>
        )}
        <Link
          href="/contractor-availability"
          className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {canRunAiSuggest ? "Review & Approve in My Availability" : "View in My Availability"}
          <svg className="ml-1.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        </Link>
      </div>
    </div>
  );
}
