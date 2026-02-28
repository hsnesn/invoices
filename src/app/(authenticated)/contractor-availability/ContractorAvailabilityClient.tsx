"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Profile = { id: string; full_name: string | null; role: string };
type RoleItem = { id: string; value: string; sort_order: number };
type DepartmentItem = { id: string; name: string };
type ProgramItem = { id: string; name: string; department_id: string };
type ByUserItem = { userId: string; name: string; email: string; role: string; dates: string[] };
type ReqItem = { date: string; role: string; count_needed: number };
type AssignItem = { id: string; user_id: string; date: string; role: string | null; status: string; notes?: string | null };
type PreferenceUser = { user_id: string; full_name: string; assignment_count: number };
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

export function ContractorAvailabilityClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [tab, setTab] = useState<"form" | "all" | "requirements" | "assignments">("form");
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [blackoutDates, setBlackoutDates] = useState<Set<string>>(new Set());
  const [copyAvailLoading, setCopyAvailLoading] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"available" | "blocked">("available");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [byUser, setByUser] = useState<ByUserItem[]>([]);
  const [listMonth, setListMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [listDepartment, setListDepartment] = useState("");
  const [listProgram, setListProgram] = useState("");
  const [listPrograms, setListPrograms] = useState<ProgramItem[]>([]);
  const [monthLabel, setMonthLabel] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<ReqItem[]>([]);
  const [reqMonth, setReqMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reqByDate, setReqByDate] = useState<Record<string, Record<string, number>>>({});
  const [reqSaving, setReqSaving] = useState(false);
  const [editingReq, setEditingReq] = useState<{ date: string; role: string; val: string } | null>(null);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [recurringSaving, setRecurringSaving] = useState(false);
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
  const [coverage, setCoverage] = useState<{ slotsFilled: number; slotsShort: number } | null>(null);
  const [addDate, setAddDate] = useState("");
  const [addRole, setAddRole] = useState("");
  const [addUserId, setAddUserId] = useState("");
  const [preferenceList, setPreferenceList] = useState<PreferenceUser[]>([]);
  const [preferenceLoading, setPreferenceLoading] = useState(false);

  const canManage = profile?.role === "admin" || profile?.role === "operations" || profile?.role === "manager";
  const [canApprove, setCanApprove] = useState(false);
  const [canRunAiSuggest, setCanRunAiSuggest] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "assignments" && canManage) setTab("assignments");
    const m = searchParams.get("month");
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      setAssignMonth(m);
      setReqMonth(m);
    }
  }, [searchParams, canManage, profile]);

  useEffect(() => {
    fetch("/api/contractor-availability/roles")
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]));
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
    if (!listDepartment) {
      setListPrograms([]);
      setListProgram("");
      return;
    }
    fetch(`/api/programs?department_id=${listDepartment}`)
      .then((r) => r.json())
      .then((d) => setListPrograms(Array.isArray(d) ? d : []))
      .catch(() => setListPrograms([]));
    setListProgram("");
  }, [listDepartment]);

  useEffect(() => {
    if (!profile || !selectedDepartment) return;
    const params = new URLSearchParams({ month, department_id: selectedDepartment });
    if (selectedProgram) params.set("program_id", selectedProgram);
    fetch(`/api/output-schedule/availability?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setSelectedDates(new Set((d.dates ?? []) as string[]));
        if (d.role) setSelectedRole(d.role);
      })
      .catch(() => setSelectedDates(new Set()));
  }, [profile, month, selectedDepartment, selectedProgram]);

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
    if (!profile) return;
    fetch(`/api/output-schedule/unavailability?month=${month}`)
      .then((r) => r.json())
      .then((d) => setBlackoutDates(new Set((d.dates ?? []) as string[])))
      .catch(() => setBlackoutDates(new Set()));
  }, [profile, month]);

  useEffect(() => {
    if (!canManage || tab !== "all" || !listDepartment) return;
    const params = new URLSearchParams({ month: listMonth, department_id: listDepartment });
    if (listProgram) params.set("program_id", listProgram);
    fetch(`/api/contractor-availability/list?${params}`)
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
  }, [canManage, tab, listMonth, listDepartment, listProgram]);

  useEffect(() => {
    if (!canManage || tab !== "assignments") return;
    setAssignLoading(true);
    const assignParams = new URLSearchParams({ month: assignMonth });
    if (listDepartment) {
      assignParams.set("department_id", listDepartment);
      if (listProgram) assignParams.set("program_id", listProgram);
    }
    const listParams = new URLSearchParams({ month: assignMonth });
    if (listDepartment) {
      listParams.set("department_id", listDepartment);
      if (listProgram) listParams.set("program_id", listProgram);
    }
    Promise.all([
      fetch(`/api/contractor-availability/assignments?${assignParams}`).then((r) => r.json()),
      fetch(`/api/contractor-availability/list?${listParams}`).then((r) => r.json()),
    ])
      .then(([assignData, listData]) => {
        const arr = assignData.assignments ?? [];
        setAssignments(arr);
        setAssignEditable(arr);
        setAssignMonthLabel(assignData.monthLabel ?? null);
        setCanApprove(!!assignData.canApprove);
        setCanRunAiSuggest(!!assignData.canRunAiSuggest);
        setCoverage(listData.coverage ?? null);
        const map: Record<string, string> = {};
        for (const u of listData.byUser ?? []) {
          map[u.userId] = u.name;
        }
        setAssignNameMap(map);
      })
      .catch(() => setAssignments([]))
      .finally(() => setAssignLoading(false));
  }, [canManage, tab, assignMonth, listDepartment, listProgram]);

  useEffect(() => {
    if (!canManage || !listDepartment || !addRole?.trim()) {
      setPreferenceList([]);
      return;
    }
    setPreferenceLoading(true);
    const params = new URLSearchParams({
      department_id: listDepartment,
      role: addRole.trim(),
    });
    if (listProgram) params.set("program_id", listProgram);
    if (addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate)) params.set("date", addDate);
    fetch(`/api/contractor-availability/preference-list?${params}`)
      .then((r) => r.json())
      .then((d) => setPreferenceList(d.users ?? []))
      .catch(() => setPreferenceList([]))
      .finally(() => setPreferenceLoading(false));
  }, [canManage, listDepartment, listProgram, addRole, addDate]);

  useEffect(() => {
    if (!canManage || tab !== "requirements" || !listDepartment) return;
    const params = new URLSearchParams({ month: reqMonth, department_id: listDepartment });
    if (listProgram) params.set("program_id", listProgram);
    fetch(`/api/contractor-availability/requirements?${params}`)
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
  }, [canManage, tab, reqMonth, listDepartment, listProgram]);

  useEffect(() => {
    if (!canManage || tab !== "requirements" || !listDepartment) return;
    const params = new URLSearchParams({ department_id: listDepartment });
    if (listProgram) params.set("program_id", listProgram);
    fetch(`/api/contractor-availability/recurring-requirements?${params}`)
      .then((r) => r.json())
      .then((d) => setRecurring(Array.isArray(d) ? d : []))
      .catch(() => setRecurring([]));
  }, [canManage, tab, listDepartment, listProgram]);

  const handleSetRequirement = async (dateStr: string, role: string, count: number) => {
    if (!listDepartment) return;
    setReqSaving(true);
    try {
      if (count <= 0) {
        const params = new URLSearchParams({ date: dateStr, role: encodeURIComponent(role), department_id: listDepartment });
        if (listProgram) params.set("program_id", listProgram);
        await fetch(`/api/contractor-availability/requirements?${params}`, { method: "DELETE" });
      } else {
        await fetch("/api/contractor-availability/requirements", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: dateStr,
            role,
            count_needed: count,
            department_id: listDepartment,
            program_id: listProgram || undefined,
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

  const handleToggleDate = (dateStr: string) => {
    if (calendarMode === "available") {
      setSelectedDates((prev) => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
      setBlackoutDates((prev) => {
        const next = new Set(prev);
        next.delete(dateStr);
        return next;
      });
    } else {
      setBlackoutDates((prev) => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
      setSelectedDates((prev) => {
        const next = new Set(prev);
        next.delete(dateStr);
        return next;
      });
    }
  };

  const handleSaveAvailability = async () => {
    if (!selectedDepartment) {
      setMessage({ type: "error", text: "Please select a department before saving." });
      return;
    }
    if (!selectedRole?.trim()) {
      setMessage({ type: "error", text: "Please select a role before saving." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const [res, unavRes] = await Promise.all([
        fetch("/api/output-schedule/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dates: Array.from(selectedDates),
            role: selectedRole.trim(),
            department_id: selectedDepartment,
            program_id: selectedProgram || undefined,
          }),
        }),
        fetch("/api/output-schedule/unavailability", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, dates: Array.from(blackoutDates) }),
        }),
      ]);
      const data = await res.json();
      const unavData = await unavRes.json();
      if (res.ok && unavRes.ok) {
        setMessage({ type: "success", text: "Availability and blackout days saved." });
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || unavData.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const [y, m] = month.split("-").map(Number);
  const days = getDaysInMonth(y, m);
  const prevMonthDate = new Date(y, m - 2, 1);
  const prevMonthLabel = prevMonthDate.toLocaleString("en-GB", { month: "long" });
  const firstDayOfWeek = new Date(y, m - 1, 1).getDay();
  const padStart = Array.from({ length: firstDayOfWeek }, (_, i) => (
    <div key={`pad-${i}`} className="aspect-square min-w-[1.75rem] sm:min-w-[2.25rem]" />
  ));

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-wrap gap-2 -mx-1 sm:mx-0">
        <button
          type="button"
          onClick={() => setTab("form")}
          className={`rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium ${
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
              className={`rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium ${
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
              className={`rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium ${
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
              className={`rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium ${
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
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900/80 min-w-0">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-red-500">*</span></label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white max-w-xs"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program</label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white max-w-xs"
              >
                <option value="">All programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role <span className="text-red-500">*</span></label>
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
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedDepartment) {
                      setMessage({ type: "error", text: "Please select a department first." });
                      return;
                    }
                    setCopyAvailLoading(true);
                    setMessage(null);
                    try {
                      const [curY, curM] = month.split("-").map(Number);
                      const prev = new Date(curY, curM - 2, 1);
                      const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
                      const params = new URLSearchParams({ month: prevMonth, department_id: selectedDepartment });
                      if (selectedProgram) params.set("program_id", selectedProgram);
                      const res = await fetch(`/api/output-schedule/availability?${params}`);
                      const data = await res.json();
                      const prevDates: string[] = data.dates ?? [];
                      const daysInCurrent = new Date(curY, curM, 0).getDate();
                      const mapped = new Set<string>();
                      for (const d of prevDates) {
                        const day = parseInt(d.slice(8, 10), 10);
                        if (day <= daysInCurrent) {
                          mapped.add(`${month}-${String(day).padStart(2, "0")}`);
                        }
                      }
                      setSelectedDates(mapped);
                      if (data.role) setSelectedRole(data.role);
                      setMessage({ type: "success", text: `Copied ${mapped.size} day${mapped.size !== 1 ? "s" : ""} from ${prevMonthLabel}.` });
                      setTimeout(() => setMessage(null), 3000);
                    } catch {
                      setMessage({ type: "error", text: "Failed to copy from last month." });
                    } finally {
                      setCopyAvailLoading(false);
                    }
                  }}
                  disabled={copyAvailLoading || !selectedDepartment}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                    <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                  </svg>
                  {copyAvailLoading ? "Copying..." : `Copy from ${prevMonthLabel}`}
                </button>
              </div>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select days</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5">
              <button
                type="button"
                onClick={() => setCalendarMode("available")}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  calendarMode === "available"
                    ? "bg-sky-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Available
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode("blocked")}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  calendarMode === "blocked"
                    ? "bg-red-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Blocked
              </button>
            </div>
          </div>
          <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
            Click a day to toggle. Past days are disabled. <span className="text-emerald-600 dark:text-emerald-400">Green</span> = booked. <span className="text-sky-600 dark:text-sky-400">Blue</span> = available. <span className="text-red-600 dark:text-red-400">Red</span> = blocked.
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

          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-gray-50/50 p-3 sm:p-4 dark:border-gray-600 dark:bg-gray-800/50 min-w-0">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 place-items-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="w-full flex justify-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1.5">
                  {d}
                </div>
              ))}
              {padStart}
              {days.map((d) => {
                const dateStr = toYMD(d);
                const isSelected = selectedDates.has(dateStr);
                const isBlocked = blackoutDates.has(dateStr);
                const isBooked = bookedDates.has(dateStr);
                const isPast = d < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => !isPast && handleToggleDate(dateStr)}
                    disabled={isPast}
                    className={`aspect-square min-w-[1.75rem] sm:min-w-[2.25rem] w-full max-w-8 sm:max-w-10 flex items-center justify-center rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      isPast
                        ? "cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                        : isBooked
                          ? "bg-emerald-600 text-white hover:bg-emerald-500 ring-2 ring-emerald-400"
                          : isBlocked
                            ? "bg-red-600 text-white hover:bg-red-500"
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAvailability}
              disabled={saving || !selectedDepartment || !selectedRole?.trim()}
              className="rounded-lg bg-sky-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Availability"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!selectedDepartment) {
                  setMessage({ type: "error", text: "Please select a department first." });
                  return;
                }
                setCopyAvailLoading(true);
                setMessage(null);
                try {
                  const res = await fetch("/api/output-schedule/availability/copy-previous", {
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
                    const params = new URLSearchParams({ month, department_id: selectedDepartment });
                    if (selectedProgram) params.set("program_id", selectedProgram);
                    const r = await fetch(`/api/output-schedule/availability?${params}`);
                    const d = await r.json();
                    setSelectedDates(new Set((d.dates ?? []) as string[]));
                    if (d.role) setSelectedRole(d.role);
                    setMessage({ type: "success", text: `Copied ${data.count ?? 0} days from last month.` });
                    setTimeout(() => setMessage(null), 3000);
                  } else {
                    setMessage({ type: "error", text: data.error || "Copy failed." });
                  }
                } catch {
                  setMessage({ type: "error", text: "Connection error." });
                } finally {
                  setCopyAvailLoading(false);
                }
              }}
              disabled={copyAvailLoading}
              className="rounded-lg border border-gray-300 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {copyAvailLoading ? "Copying..." : "Copy from last month"}
            </button>
            <a
              href={`/api/contractor-availability/export/ical?month=${month}`}
              download={`contractor-schedule-${month}.ics`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Export to calendar (.ics)
            </a>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {selectedDates.size} day{selectedDates.size !== 1 ? "s" : ""} selected
            </span>
          </div>
        </div>
      )}

      {tab === "all" && canManage && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900/80 min-w-0 overflow-hidden">
          <h2 className="mb-4 font-medium text-gray-900 dark:text-white">
            All contractor availability records {monthLabel && `– ${monthLabel}`}
          </h2>
          <div className="mb-4 flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-red-500">*</span></label>
              <select
                value={listDepartment}
                onChange={(e) => { setListDepartment(e.target.value); setListProgram(""); }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program</label>
              <select
                value={listProgram}
                onChange={(e) => setListProgram(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All programs</option>
                {listPrograms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
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
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300 hidden sm:table-cell">Email</th>
                    <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.map((u) => (
                    <tr key={u.userId} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-2 sm:px-3 text-gray-900 dark:text-white max-w-[80px] sm:max-w-[200px] truncate" title={u.name}>{u.name}</td>
                      <td className="py-2 px-2 sm:px-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{u.email}</td>
                      <td className="py-2 px-2 sm:px-3 text-gray-700 dark:text-gray-300">{u.role || "—"}</td>
                      <td className="py-2 px-2 sm:px-3 text-gray-600 dark:text-gray-400 text-xs">
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
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900/80 min-w-0 overflow-hidden">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-white">
            Assignments {assignMonthLabel && `– ${assignMonthLabel}`}
          </h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            AI suggests assignments from requirements and availability. Review, modify if needed, then approve to send confirmation emails.
          </p>
          {coverage && (
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                {coverage.slotsFilled} slot{coverage.slotsFilled !== 1 ? "s" : ""} filled
              </span>
              {coverage.slotsShort > 0 && (
                <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                  {coverage.slotsShort} short
                </span>
              )}
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-2 min-w-0 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Department <span className="text-red-500">*</span></label>
              <select
                value={listDepartment}
                onChange={(e) => { setListDepartment(e.target.value); setListProgram(""); }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Program</label>
              <select
                value={listProgram}
                onChange={(e) => setListProgram(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All</option>
                {listPrograms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Month</label>
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
            {canRunAiSuggest && (
            <button
              type="button"
              onClick={async () => {
                setAssignSaving(true);
                try {
                  const res = await fetch("/api/contractor-availability/ai-suggest", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      month: assignMonth,
                      department_id: listDepartment,
                      program_id: listProgram || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    const assignParams = new URLSearchParams({ month: assignMonth });
                    if (listDepartment) {
                      assignParams.set("department_id", listDepartment);
                      if (listProgram) assignParams.set("program_id", listProgram);
                    }
                    const r2 = await fetch(`/api/contractor-availability/assignments?${assignParams}`);
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
              disabled={assignLoading || assignSaving || !listDepartment}
              className="rounded-lg bg-violet-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {assignSaving ? "Running..." : "AI Suggest"}
            </button>
            )}
            {canApprove && (
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
                      department_id: listDepartment || undefined,
                      program_id: listProgram || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setMessage({ type: "success", text: "Changes saved." });
                    setTimeout(() => setMessage(null), 3000);
                    const r2Params = new URLSearchParams({ month: assignMonth });
                    if (listDepartment) { r2Params.set("department_id", listDepartment); if (listProgram) r2Params.set("program_id", listProgram); }
                    const r2 = await fetch(`/api/contractor-availability/assignments?${r2Params}`);
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
              className="rounded-lg bg-sky-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              Save Changes
            </button>
            )}
            {canApprove && (
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
                      department_id: listDepartment || undefined,
                      program_id: listProgram || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setMessage({ type: "success", text: `Approved. Emails sent to ${data.approved ?? 0} people.` });
                    setTimeout(() => setMessage(null), 4000);
                    const rParams = new URLSearchParams({ month: assignMonth });
                    if (listDepartment) { rParams.set("department_id", listDepartment); if (listProgram) rParams.set("program_id", listProgram); }
                    const r = await fetch(`/api/contractor-availability/assignments?${rParams}`);
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
              className="rounded-lg bg-emerald-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Approve & Send Emails
            </button>
            )}
            <a
              href={`/api/contractor-availability/export/pdf?month=${assignMonth}`}
              className="rounded-lg border border-gray-300 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              download={`schedule-${assignMonth}.pdf`}
            >
              Export PDF
            </a>
            </div>
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
          {canManage && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/50">
              <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Add assignment (preference list)</h3>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                {listDepartment ? "Select role and date above. People are listed by most requested first. With a date, only available people are shown." : "Select department and program above first."}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
                  <select
                    value={addDate}
                    onChange={(e) => { setAddDate(e.target.value); setAddUserId(""); }}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Select date...</option>
                    {getDaysInMonth(
                      parseInt(assignMonth.split("-")[0], 10),
                      parseInt(assignMonth.split("-")[1], 10)
                    ).map((d) => {
                      const dateStr = toYMD(d);
                      return (
                        <option key={dateStr} value={dateStr}>
                          {d.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
                  <select
                    value={addRole}
                    onChange={(e) => { setAddRole(e.target.value); setAddUserId(""); }}
                    disabled={!listDepartment}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                  >
                    <option value="">{listDepartment ? "Select role..." : "Select dept first"}</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.value}>{r.value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Person</label>
                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    disabled={preferenceLoading || !addRole?.trim() || !listDepartment}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white min-w-[160px]"
                  >
                    <option value="">
                      {preferenceLoading ? "Loading..." : !listDepartment ? "Select dept first" : !addRole?.trim() ? "Select role first" : preferenceList.length === 0 ? "No one available" : "Select person..."}
                    </option>
                    {preferenceList.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name} ({u.assignment_count}×)
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!addDate || !addRole?.trim() || !addUserId) {
                      setMessage({ type: "error", text: "Select date, role and person." });
                      setTimeout(() => setMessage(null), 3000);
                      return;
                    }
                    const existingKey = `${addUserId}|${addDate}`;
                    const alreadyAssigned = assignEditable.some((a) => `${a.user_id}|${a.date}` === existingKey);
                    if (alreadyAssigned) {
                      setMessage({ type: "error", text: "This person is already assigned for that date." });
                      setTimeout(() => setMessage(null), 3000);
                      return;
                    }
                    const newItem: AssignItem = {
                      id: `temp-${Date.now()}`,
                      user_id: addUserId,
                      date: addDate,
                      role: addRole.trim(),
                      status: "pending",
                    };
                    setAssignEditable((prev) => [...prev, newItem].sort((a, b) => a.date.localeCompare(b.date) || (a.role ?? "").localeCompare(b.role ?? "")));
                    setAssignNameMap((prev) => ({ ...prev, [addUserId]: preferenceList.find((u) => u.user_id === addUserId)?.full_name ?? "Unknown" }));
                    setAddUserId("");
                    setMessage({ type: "success", text: "Assignment added. Click Save Changes to persist." });
                    setTimeout(() => setMessage(null), 3000);
                  }}
                  disabled={!addDate || !addRole?.trim() || !addUserId}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}
          {assignLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : assignEditable.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No assignments. Set daily requirements and availability, then click &quot;AI Suggest&quot;.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                    {(canApprove && assignEditable.some((a) => a.status === "pending")) || assignEditable.some((a) => a.status === "confirmed") ? (
                      <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300 w-20" />
                    ) : null}
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
                      <td className="py-2 px-3">
                        {a.status === "pending" && canApprove ? (
                          <button
                            type="button"
                            onClick={() =>
                              setAssignEditable((prev) => prev.filter((x) => x.id !== a.id))
                            }
                            className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900/70"
                          >
                            Remove
                          </button>
                        ) : a.status === "confirmed" && canApprove ? (
                          <button
                            type="button"
                            onClick={async () => {
                              setAssignSaving(true);
                              try {
                                const res = await fetch("/api/contractor-availability/assignments", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "cancel",
                                    month: assignMonth,
                                    user_id: a.user_id,
                                    date: a.date,
                                  }),
                                });
                                if (res.ok) {
                                  const cancelParams = new URLSearchParams({ month: assignMonth });
                                  if (listDepartment) { cancelParams.set("department_id", listDepartment); if (listProgram) cancelParams.set("program_id", listProgram); }
                                  const r = await fetch(`/api/contractor-availability/assignments?${cancelParams}`);
                                  const d = await r.json();
                                  const arr = d.assignments ?? [];
                                  setAssignments(arr);
                                  setAssignEditable(arr);
                                  setMessage({ type: "success", text: "Assignment cancelled." });
                                  setTimeout(() => setMessage(null), 3000);
                                } else {
                                  const data = await res.json();
                                  setMessage({ type: "error", text: data.error || "Cancel failed." });
                                }
                              } catch {
                                setMessage({ type: "error", text: "Connection error." });
                              } finally {
                                setAssignSaving(false);
                              }
                            }}
                            disabled={assignSaving}
                            className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-900/70 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "requirements" && canManage && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900/80 min-w-0 overflow-hidden">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Daily requirements (demand)</h2>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Set how many people per role are needed each day. AI will use this for scheduling.
          </p>
          <div className="mb-4 flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-red-500">*</span></label>
              <select
                value={listDepartment}
                onChange={(e) => { setListDepartment(e.target.value); setListProgram(""); }}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program</label>
              <select
                value={listProgram}
                onChange={(e) => setListProgram(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">All programs</option>
                {listPrograms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
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
              <button
                type="button"
                onClick={async () => {
                  if (!listDepartment) return;
                  setReqSaving(true);
                  try {
                    const res = await fetch("/api/contractor-availability/requirements/copy-previous", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        month: reqMonth,
                        department_id: listDepartment,
                        program_id: listProgram || undefined,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setMessage({ type: "success", text: `Copied ${data.count ?? 0} requirements from previous month.` });
                      setTimeout(() => setMessage(null), 3000);
                      const params = new URLSearchParams({ month: reqMonth, department_id: listDepartment });
                      if (listProgram) params.set("program_id", listProgram);
                      const r = await fetch(`/api/contractor-availability/requirements?${params}`);
                      const d = await r.json();
                      const byDate: Record<string, Record<string, number>> = {};
                      for (const x of d.requirements ?? []) {
                        if (!byDate[x.date]) byDate[x.date] = {};
                        byDate[x.date][x.role] = x.count_needed;
                      }
                      setReqByDate(byDate);
                    } else {
                      setMessage({ type: "error", text: data.error || "Copy failed." });
                    }
                  } catch {
                    setMessage({ type: "error", text: "Connection error." });
                  } finally {
                    setReqSaving(false);
                  }
                }}
                disabled={reqSaving}
                className="rounded-lg border border-sky-500/50 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-200 dark:hover:bg-sky-900/30 disabled:opacity-50"
              >
                Copy from previous month
              </button>
            </div>
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
            <h3 className="text-sm font-medium text-violet-900 dark:text-violet-200 mb-2">Recurring requirements</h3>
            <p className="text-xs text-violet-700 dark:text-violet-300 mb-3">
              e.g. &quot;Every Monday 2 Output&quot; – applied when no explicit requirement exists for that day.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                id="rec-day"
                className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
              <select
                id="rec-role"
                className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.value}>{r.value}</option>
                ))}
              </select>
              <input
                type="number"
                id="rec-count"
                min={1}
                max={99}
                defaultValue={1}
                className="w-14 rounded border border-gray-300 px-2 py-1.5 text-sm text-center dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!listDepartment) return;
                  const dayEl = document.getElementById("rec-day") as HTMLSelectElement;
                  const roleEl = document.getElementById("rec-role") as HTMLSelectElement;
                  const countEl = document.getElementById("rec-count") as HTMLInputElement;
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
                        department_id: listDepartment,
                        program_id: listProgram || undefined,
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
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {recurring.length > 0 && (
              <ul className="space-y-1 text-sm">
                {recurring.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="rounded bg-violet-100 px-2 py-0.5 dark:bg-violet-900/50">
                      Every {(r.dayLabel ?? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][r.day_of_week])} – {r.role}: {r.count_needed}
                    </span>
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
                      className="text-red-600 hover:text-red-700 text-xs dark:text-red-400"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
                  {roles.map((r) => (
                    <th key={r.id} className="text-left py-2 px-1 sm:px-3 font-medium text-gray-700 dark:text-gray-300">
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
                          <td key={r.id} className="py-1 px-1 sm:px-2">
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
                              className="w-10 sm:w-14 rounded border border-gray-300 px-1 sm:px-2 py-1 text-center text-xs sm:text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
