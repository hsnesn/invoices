"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

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

const TEMPLATES_KEY = "request-demand-templates";

export function RequestClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [month, setMonth] = useState(() => {
    const m = searchParams.get("month");
    return m && /^\d{4}-\d{2}$/.test(m) ? m : "";
  });
  const [reqByDate, setReqByDate] = useState<Record<string, Record<string, number>>>({});
  const [reqSaving, setReqSaving] = useState(false);
  const [editingReq, setEditingReq] = useState<{ date: string; role: string; val: string } | null>(null);
  const [byUser, setByUser] = useState<ByUserItem[]>([]);
  const [coverage, setCoverage] = useState<{ byDateRole: Record<string, { needed: number; filled: number }> }>({ byDateRole: {} });
  const [assignmentNamesByDateRole, setAssignmentNamesByDateRole] = useState<Record<string, string[]>>({});
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
  const [selectedDepartment, setSelectedDepartment] = useState(() => searchParams.get("dept") || "");
  const [selectedProgram, setSelectedProgram] = useState(() => searchParams.get("program") || "");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRequestLoading, setBulkRequestLoading] = useState(false);
  const [bulkRequestText, setBulkRequestText] = useState("");
  const [assignModal, setAssignModal] = useState<{ date: string; role: string; needed: number } | null>(null);
  const [quickAssignSaving, setQuickAssignSaving] = useState(false);
  const [templates, setTemplates] = useState<{ name: string; month: string; byDate: Record<string, Record<string, number>> }[]>([]);

  /** Only admin and operations can run AI suggest. Manager can only enter demand. */
  const canRunAiSuggest = profile?.role === "admin" || profile?.role === "operations";
  const canManage = profile?.role === "admin" || profile?.role === "operations" || profile?.role === "manager";

  const [y, m] = month ? month.split("-").map(Number) : [0, 0];
  const monthLabel = month ? new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" }) : "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedDepartment) params.set("dept", selectedDepartment);
    if (selectedProgram) params.set("program", selectedProgram);
    if (month) params.set("month", month);
    const qs = params.toString();
    const url = qs ? `/request?${qs}` : "/request";
    if (typeof window !== "undefined" && window.location.pathname + (window.location.search || "") !== url) {
      router.replace(url, { scroll: false });
    }
  }, [selectedDepartment, selectedProgram, month, router]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(TEMPLATES_KEY) : null;
      setTemplates(raw ? JSON.parse(raw) : []);
    } catch { setTemplates([]); }
  }, []);

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
    if (!selectedDepartment || !month || !selectedProgram) {
      setLoading(false);
      setReqByDate({});
      setRequirements([]);
      setByUser([]);
      setCoverage({ byDateRole: {} });
      setAssignmentNamesByDateRole({});
      return;
    }
    setLoading(true);
    const reqParams = new URLSearchParams({ month, department_id: selectedDepartment });
    if (selectedProgram && selectedProgram !== "__all__") reqParams.set("program_id", selectedProgram);
    const listParams = new URLSearchParams({ month, department_id: selectedDepartment });
    if (selectedProgram && selectedProgram !== "__all__") listParams.set("program_id", selectedProgram);
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
        setCoverage(listData.coverage ?? { byDateRole: {} });
        setAssignmentNamesByDateRole(listData.assignmentNamesByDateRole ?? {});
      })
      .catch(() => {
        setReqByDate({});
        setRequirements([]);
        setByUser([]);
        setCoverage({ byDateRole: {} });
        setAssignmentNamesByDateRole({});
      })
      .finally(() => setLoading(false));
  }, [month, selectedDepartment, selectedProgram]);

  useEffect(() => {
    if (!canManage || !selectedDepartment) return;
    const params = new URLSearchParams({ department_id: selectedDepartment });
    if (selectedProgram && selectedProgram !== "__all__") params.set("program_id", selectedProgram);
    fetch(`/api/contractor-availability/recurring-requirements?${params}`)
      .then((r) => r.json())
      .then((d) => setRecurring(Array.isArray(d) ? d : []))
      .catch(() => setRecurring([]));
  }, [canManage, selectedDepartment, selectedProgram]);

  const handleSetRequirement = async (dateStr: string, role: string, count: number) => {
    if (!selectedDepartment) return;
    setReqSaving(true);
    setMessage(null);
    try {
      if (count <= 0) {
        const params = new URLSearchParams({ date: dateStr, role: encodeURIComponent(role), department_id: selectedDepartment });
        if (selectedProgram && selectedProgram !== "__all__") params.set("program_id", selectedProgram);
        const res = await fetch(`/api/contractor-availability/requirements?${params}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: "error", text: data.error || `Failed to save (${res.status}).` });
          return;
        }
      } else {
        const res = await fetch("/api/contractor-availability/requirements", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: dateStr,
            role,
            count_needed: count,
            department_id: selectedDepartment,
            program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMessage({ type: "error", text: data.error || `Failed to save (${res.status}).` });
          return;
        }
      }
      setReqByDate((prev) => {
        const next = { ...prev };
        if (!next[dateStr]) next[dateStr] = {};
        if (count <= 0) delete next[dateStr][role];
        else next[dateStr][role] = count;
        return next;
      });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message || "Failed to save." });
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

  const hasRequiredFilters = month && selectedDepartment && selectedProgram;
  const days = hasRequiredFilters && y && m ? getDaysInMonth(y, m) : [];

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

  const summaryStats = useMemo(() => {
    let totalDemand = 0;
    let totalBooked = 0;
    let slotsShort = 0;
    for (const r of requirements) {
      totalDemand += r.count_needed;
      const cov = coverage.byDateRole[`${r.date}|${r.role}`];
      const filled = cov?.filled ?? 0;
      totalBooked += filled;
      if (filled < r.count_needed) slotsShort += r.count_needed - filled;
    }
    const coveragePct = totalDemand > 0 ? Math.round((totalBooked / totalDemand) * 100) : 100;
    return { totalDemand, totalBooked, slotsShort, coveragePct };
  }, [requirements, coverage]);

  const refetchData = async () => {
    if (!selectedDepartment || !month || !selectedProgram) return;
    const reqParams = new URLSearchParams({ month, department_id: selectedDepartment });
    if (selectedProgram && selectedProgram !== "__all__") reqParams.set("program_id", selectedProgram);
    const listParams = new URLSearchParams({ month, department_id: selectedDepartment });
    if (selectedProgram && selectedProgram !== "__all__") listParams.set("program_id", selectedProgram);
    const [reqData, listData] = await Promise.all([
      fetch(`/api/contractor-availability/requirements?${reqParams}`).then((r) => r.json()),
      fetch(`/api/contractor-availability/list?${listParams}`).then((r) => r.json()),
    ]);
    const byDate: Record<string, Record<string, number>> = {};
    for (const r of reqData.requirements ?? []) {
      if (!byDate[r.date]) byDate[r.date] = {};
      byDate[r.date][r.role] = r.count_needed;
    }
    setReqByDate(byDate);
    setRequirements(reqData.requirements ?? []);
    setByUser(listData.byUser ?? []);
    setCoverage(listData.coverage ?? { byDateRole: {} });
    setAssignmentNamesByDateRole(listData.assignmentNamesByDateRole ?? {});
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    );
  }

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
              <option value="">Select program...</option>
              <option value="__all__">All programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="min-w-[70px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Year</label>
              <select
                value={month ? month.split("-")[0] : ""}
                onChange={(e) => {
                  const yr = e.target.value;
                  const mo = month ? month.split("-")[1] : "01";
                  setMonth(yr ? `${yr}-${mo}` : "");
                }}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:focus:border-gray-500 dark:focus:bg-gray-800 dark:focus:ring-gray-700"
              >
                <option value="">Select year...</option>
                {Array.from({ length: 5 }, (_, i) => {
                  const yr = new Date().getFullYear() - 1 + i;
                  return (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-sm font-medium text-gray-900 transition-colors focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:focus:border-gray-500 dark:focus:bg-gray-800 dark:focus:ring-gray-700"
              >
                <option value="">Select month...</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const mo = String(i + 1).padStart(2, "0");
                  const yr = month ? month.split("-")[0] : String(new Date().getFullYear());
                  const label = new Date(2000, i).toLocaleString("en-GB", { month: "long" });
                  return (
                    <option key={mo} value={`${yr}-${mo}`}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      </div>

      {!hasRequiredFilters && !selectedDepartment && (
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/50 px-4 py-6 text-center dark:border-gray-700/60 dark:bg-gray-900/20">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Select department, program, month and year to view demand and supply.
          </p>
        </div>
      )}

      {canManage && selectedDepartment && !hasRequiredFilters && (
        <div className="rounded-2xl border border-gray-200/80 bg-amber-50/50 px-4 py-4 dark:border-amber-800/30 dark:bg-amber-950/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Select program and month to view the calendar. Or use the Freelancer request below to create requirements from text.
          </p>
        </div>
      )}

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

      {canManage && selectedDepartment && (
        <>
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 min-w-0 overflow-hidden">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Freelancer request</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Describe your needs in plain English. The system will add requirements to the calendar and email London Operations.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <input
              type="text"
              value={bulkRequestText}
              onChange={(e) => setBulkRequestText(e.target.value)}
              placeholder="e.g. 4 outputs every weekday in March"
              className="flex-1 min-w-[200px] rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm font-medium dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:placeholder-gray-500"
            />
            <button
              type="button"
              onClick={async () => {
                if (!bulkRequestText.trim()) {
                  setMessage({ type: "error", text: "Enter your request (e.g. 4 outputs every weekday in March)." });
                  return;
                }
                if (!selectedDepartment) {
                  setMessage({ type: "error", text: "Please select a department first." });
                  return;
                }
                setBulkRequestLoading(true);
                setMessage(null);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);
                try {
                  const res = await fetch("/api/contractor-availability/requirements/bulk-request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: bulkRequestText.trim(),
                      department_id: selectedDepartment,
                      program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined,
                    }),
                    signal: controller.signal,
                  });
                  clearTimeout(timeoutId);
                  const data = await res.json();
                  if (res.ok) {
                    setMessage({ type: "success", text: data.message ?? `Created ${data.count} requirements. London Operations notified.` });
                    setBulkRequestText("");
                    setTimeout(() => setMessage(null), 5000);
                    await refetchData();
                  } else {
                    setMessage({ type: "error", text: data.error ?? "Request failed." });
                  }
                } catch (e) {
                  clearTimeout(timeoutId);
                  const isAbort = (e as Error).name === "AbortError";
                  setMessage({
                    type: "error",
                    text: isAbort
                      ? "Request timed out. Try again or use Recurring rules below."
                      : "Connection error. Check your network or try again.",
                  });
                } finally {
                  setBulkRequestLoading(false);
                }
              }}
              disabled={bulkRequestLoading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
            >
              {bulkRequestLoading ? "Processing…" : "Submit & notify London Ops"}
            </button>
          </div>
        </div>
        </>
      )}

      {canManage && hasRequiredFilters && (
        <>
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
              <option value="">Select day...</option>
              {[
                { label: "Monday", value: 1 },
                { label: "Tuesday", value: 2 },
                { label: "Wednesday", value: 3 },
                { label: "Thursday", value: 4 },
                { label: "Friday", value: 5 },
                { label: "Saturday", value: 6 },
                { label: "Sunday", value: 0 },
              ].map(({ label, value }) => (
                <option key={label} value={value}>{label}</option>
              ))}
            </select>
            <select
              id="req-rec-role"
              className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm font-medium dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
            >
              <option value="">Select role...</option>
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
                const dayVal = dayEl.value;
                const day_of_week = dayVal === "" ? -1 : parseInt(dayVal, 10);
                const role = roleEl.value;
                const count = Math.max(1, Math.min(99, parseInt(countEl.value, 10) || 1));
                if (day_of_week < 0 || day_of_week > 6 || !role) {
                  setMessage({ type: "error", text: "Please select a day and role." });
                  return;
                }
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
                      program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setRecurring((prev) => [...prev.filter((x) => !(x.day_of_week === day_of_week && x.role === role)), { id: data.id, day_of_week, role, count_needed: count, dayLabel: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day_of_week] }]);
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
                      program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setMessage({ type: "success", text: `Applied ${data.count ?? 0} requirements from recurring rules.` });
                    setTimeout(() => setMessage(null), 3000);
                    const reqParams = new URLSearchParams({ month, department_id: selectedDepartment });
                    if (selectedProgram && selectedProgram !== "__all__") reqParams.set("program_id", selectedProgram);
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
          <div className="flex flex-wrap gap-2 mb-2">
            <select
              id="req-template"
              className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800/80 dark:text-white"
            >
              <option value="">Apply template...</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                const name = prompt("Template name:");
                if (!name?.trim()) return;
                try {
                  const next = [...templates.filter((x) => x.name !== name.trim()), { name: name.trim(), month, byDate: reqByDate }];
                  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
                  setTemplates(next);
                  setMessage({ type: "success", text: "Template saved." });
                  setTimeout(() => setMessage(null), 2000);
                } catch {
                  setMessage({ type: "error", text: "Failed to save template." });
                }
              }}
              disabled={Object.keys(reqByDate).length === 0}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Save as template
            </button>
            <button
              type="button"
              onClick={async () => {
                const el = document.getElementById("req-template") as HTMLSelectElement;
                const name = el?.value;
                if (!name) return;
                try {
                  const t = templates.find((x) => x.name === name);
                  if (!t || !t.byDate) return;
                  const [ty, tm] = month.split("-").map(Number);
                  const toDays = new Date(ty, tm, 0).getDate();
                  setReqSaving(true);
                  for (const [dateStr, roles] of Object.entries(t.byDate as Record<string, Record<string, number>>)) {
                    const dayNum = parseInt(dateStr.slice(8), 10);
                    if (dayNum > toDays) continue;
                    const targetDate = `${ty}-${String(tm).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    if (targetDate.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) continue;
                    for (const [role, count] of Object.entries(roles)) {
                      if (count <= 0) continue;
                      await fetch("/api/contractor-availability/requirements", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ date: targetDate, role, count_needed: count, department_id: selectedDepartment, program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined }),
                      });
                    }
                  }
                  await refetchData();
                  setMessage({ type: "success", text: "Template applied." });
                  setTimeout(() => setMessage(null), 2000);
                } catch {
                  setMessage({ type: "error", text: "Failed to apply template." });
                } finally {
                  setReqSaving(false);
                }
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Apply
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
        </>
      )}

      {hasRequiredFilters && (
      <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Total demand</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summaryStats.totalDemand}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Booked</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summaryStats.totalBooked}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Slots short</p>
          <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">{summaryStats.slotsShort}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/40">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Coverage</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{summaryStats.coveragePct}%</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Demand</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              People needed per role per day · {monthLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Legend:</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs dark:bg-rose-900/40">Unfulfilled</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs dark:bg-emerald-900/40">Booked</span>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={async () => { if (!confirm("Copy demand from previous month?")) return; setBulkLoading(true); try { const [fy, fm] = month.split("-").map(Number); const prevMonth = fm === 1 ? `${fy - 1}-12` : `${fy}-${String(fm - 1).padStart(2, "0")}`; const res = await fetch("/api/contractor-availability/requirements/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "copy_from_prev", from_month: prevMonth, to_month: month, department_id: selectedDepartment, program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined }) }); const d = await res.json(); if (res.ok && d.count > 0) { setMessage({ type: "success", text: `Copied ${d.count} requirements.` }); await refetchData(); } else if (res.ok) { setMessage({ type: "success", text: "No requirements to copy." }); } else { setMessage({ type: "error", text: d.error || "Copy failed." }); } } catch { setMessage({ type: "error", text: "Copy failed." }); } finally { setBulkLoading(false); } }} disabled={bulkLoading} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Copy from prev</button>
              <button type="button" onClick={async () => { if (!confirm("Copy to next month?")) return; setBulkLoading(true); try { const res = await fetch("/api/contractor-availability/requirements/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "copy_to_next", from_month: month, department_id: selectedDepartment, program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined }) }); const d = await res.json(); if (res.ok && d.count > 0) { setMessage({ type: "success", text: `Copied ${d.count} to next month.` }); } else if (res.ok) { setMessage({ type: "success", text: "No requirements to copy." }); } else { setMessage({ type: "error", text: d.error || "Copy failed." }); } } catch { setMessage({ type: "error", text: "Copy failed." }); } finally { setBulkLoading(false); } }} disabled={bulkLoading} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Copy to next</button>
              <button type="button" onClick={async () => { if (!confirm("Clear all demand?")) return; setBulkLoading(true); try { const res = await fetch("/api/contractor-availability/requirements/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clear", to_month: month, department_id: selectedDepartment, program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined }) }); const d = await res.json(); if (res.ok) { setMessage({ type: "success", text: "Demand cleared." }); await refetchData(); } else { setMessage({ type: "error", text: d.error || "Clear failed." }); } } catch { setMessage({ type: "error", text: "Clear failed." }); } finally { setBulkLoading(false); } }} disabled={bulkLoading} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">Clear all</button>
              <button type="button" onClick={() => { const rows = [["Date", "Role", "Demand", "Booked", "Available"]]; for (const r of requirements) { const cov = coverage.byDateRole[`${r.date}|${r.role}`]; const filled = cov?.filled ?? 0; const avail = supplyByDateRole.get(`${r.date}|${r.role}`) ?? 0; rows.push([r.date, r.role, String(r.count_needed), String(filled), String(avail)]); } const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `demand-${month}.csv`; a.click(); URL.revokeObjectURL(url); setMessage({ type: "success", text: "Exported." }); setTimeout(() => setMessage(null), 2000); }} disabled={requirements.length === 0} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Export CSV</button>
            </div>
          )}
          {roles.length > 0 && (() => {
            const weekdayCount = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).length;
            return (
              <div className="flex flex-wrap items-center gap-2">
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
                                  program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined,
                                }),
                              })
                            )
                          );
                          const reqParams = new URLSearchParams({ month, department_id: selectedDepartment });
                          if (selectedProgram && selectedProgram !== "__all__") reqParams.set("program_id", selectedProgram);
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
                      const cov = coverage.byDateRole[`${dateStr}|${r.value}`];
                      const filled = cov?.filled ?? 0;
                      const hasDemand = stored > 0;
                      const isBooked = hasDemand && filled >= stored;
                      const isUnfulfilled = hasDemand && filled < stored;
                      const names = assignmentNamesByDateRole[`${dateStr}|${r.value}`] ?? [];
                      return (
                        <td key={r.id} className="py-1.5 px-2 text-center group/cell">
                          <span className="relative inline-block">
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
                              isBooked
                                ? "border-emerald-200 bg-emerald-50/80 text-emerald-800 focus:ring-emerald-200 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:focus:ring-emerald-800/50"
                                : isUnfulfilled
                                ? "border-rose-200 bg-rose-50/80 text-rose-800 focus:ring-rose-200 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200 dark:focus:ring-rose-800/50"
                                : hasDemand
                                ? "border-gray-300 bg-gray-50 text-gray-900 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:focus:ring-gray-600"
                                : isWeekend
                                ? "border-gray-200 bg-gray-50/50 text-gray-400 focus:ring-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-500 dark:focus:ring-gray-700"
                                : "border-gray-200 bg-white text-gray-700 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-200 dark:focus:ring-gray-600"
                            }`}
                            disabled={reqSaving}
                          />
                          {isBooked && names.length > 0 && (
                            <span className="absolute bottom-full left-1/2 z-20 -translate-x-1/2 mb-1 hidden rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-800 shadow-lg group-hover/cell:block dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 whitespace-nowrap">
                              {names.join(", ")}
                            </span>
                          )}
                          {isUnfulfilled && canRunAiSuggest && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAssignModal({ date: dateStr, role: r.value, needed: stored }); }}
                              className="absolute -right-1 -top-1 rounded-full bg-gray-900 p-1 text-white shadow hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                              title="Quick assign"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </button>
                          )}
                          </span>
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
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No availability submitted for this month.</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Contractors can submit their availability in My Availability.</p>
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
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Booked</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Available</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => {
                  const cov = coverage.byDateRole[`${r.date}|${r.role}`];
                  const filled = cov?.filled ?? 0;
                  const avail = supplyByDateRole.get(`${r.date}|${r.role}`) ?? 0;
                  const ok = filled >= r.count_needed;
                  return (
                    <tr key={`${r.date}-${r.role}`} className="border-b border-gray-100 transition-colors hover:bg-gray-50/50 dark:border-gray-800 dark:hover:bg-gray-800/30">
                      <td className="py-2.5 px-4 text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                        {new Date(r.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-gray-800 dark:text-gray-200">{r.role}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.count_needed}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-600 dark:text-gray-400">{filled}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-500 dark:text-gray-400">{avail}</td>
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
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAssignModal(null)}>
          <div className="max-h-[80vh] w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Quick assign</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{assignModal.date} · {assignModal.role}</p>
            </div>
            <div className="max-h-64 overflow-y-auto p-4">
              {byUser
                .filter((u) => u.dates.includes(assignModal.date) && (u.role || "").trim() === assignModal.role)
                .map((u) => (
                  <button
                    key={u.userId}
                    type="button"
                    onClick={async () => {
                      setQuickAssignSaving(true);
                      try {
                        const res = await fetch("/api/contractor-availability/assignments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "save",
                            month: assignModal.date.slice(0, 7),
                            assignments: [{ user_id: u.userId, date: assignModal.date, role: assignModal.role }],
                            department_id: selectedDepartment,
                            program_id: selectedProgram && selectedProgram !== "__all__" ? selectedProgram : undefined,
                          }),
                        });
                        const d = await res.json();
                        if (res.ok) {
                          setMessage({ type: "success", text: `Assigned ${u.name}.` });
                          setAssignModal(null);
                          await refetchData();
                        } else {
                          setMessage({ type: "error", text: d.error || "Assign failed." });
                        }
                      } catch {
                        setMessage({ type: "error", text: "Assign failed." });
                      } finally {
                        setQuickAssignSaving(false);
                      }
                    }}
                    disabled={quickAssignSaving}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
                  >
                    {u.name}
                  </button>
                ))}
              {byUser.filter((u) => u.dates.includes(assignModal.date) && (u.role || "").trim() === assignModal.role).length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No one available for this date and role.</p>
              )}
            </div>
            <div className="border-t border-gray-100 p-3 dark:border-gray-800">
              <button type="button" onClick={() => setAssignModal(null)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button>
            </div>
          </div>
        </div>
      )}

      </>
      )}
    </div>
  );
}
