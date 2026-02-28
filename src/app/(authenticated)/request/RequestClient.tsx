"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

type Profile = { id: string; full_name: string | null; role: string };

type RoleItem = { id: string; value: string; sort_order: number };
type ByUserItem = { userId: string; name: string; email: string; role: string; dates: string[] };
type ReqItem = { date: string; role: string; count_needed: number };

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

  /** Only admin and operations can run AI suggest. Manager can only enter demand. */
  const canRunAiSuggest = profile?.role === "admin" || profile?.role === "operations";

  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    fetch("/api/contractor-availability/roles")
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/contractor-availability/requirements?month=${month}`).then((r) => r.json()),
      fetch(`/api/contractor-availability/list?month=${month}`).then((r) => r.json()),
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
  }, [month]);

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
        setMessage({ type: "success", text: `AI suggested ${data.count ?? 0} assignments. Go to Contractor Availability to review and approve.` });
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
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const days = getDaysInMonth(y, m);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <div className="flex flex-wrap gap-2 items-center min-w-0">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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
        <select
          value={month.split("-")[0]}
          onChange={(e) => {
            const yr = e.target.value;
            const mo = month.split("-")[1];
            setMonth(`${yr}-${mo}`);
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

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 sm:p-6 dark:border-amber-800 dark:bg-amber-950/20 min-w-0 overflow-hidden">
        <h2 className="mb-2 font-medium text-amber-900 dark:text-amber-100 text-sm sm:text-base">Demand</h2>
        <p className="mb-4 text-xs sm:text-sm text-amber-800/80 dark:text-amber-200/80">
          Enter how many people per role are needed each day.
        </p>
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-amber-200 dark:border-amber-800">
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-amber-900 dark:text-amber-100">Date</th>
                  {roles.map((r) => (
                    <th key={r.id} className="text-left py-2 px-1 sm:px-3 font-medium text-amber-900 dark:text-amber-100">
                    {r.value}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const dateStr = toYMD(d);
                return (
                  <tr key={dateStr} className="border-b border-amber-100 dark:border-amber-900/50">
                    <td className="py-2 px-2 sm:px-3 text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
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
                            className="w-10 sm:w-14 rounded border border-amber-300 px-1 sm:px-2 py-1 text-center text-xs sm:text-sm dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
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

      <div className="rounded-xl border border-sky-200 bg-sky-50/30 p-4 sm:p-6 dark:border-sky-800 dark:bg-sky-950/20 min-w-0 overflow-hidden">
        <h2 className="mb-2 font-medium text-sky-900 dark:text-sky-100 text-sm sm:text-base">Supply</h2>
        <p className="mb-4 text-xs sm:text-sm text-sky-800/80 dark:text-sky-200/80">
          Freelancers who submitted availability for {monthLabel}.
        </p>
        {byUser.length === 0 ? (
          <p className="text-xs sm:text-sm text-sky-700 dark:text-sky-300">No availability submitted for this month.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-sky-200 dark:border-sky-800">
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-sky-900 dark:text-sky-100">Name</th>
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-sky-900 dark:text-sky-100">Role</th>
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-sky-900 dark:text-sky-100">Days</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((u) => (
                  <tr key={u.userId} className="border-b border-sky-100 dark:border-sky-900/50">
                    <td className="py-2 px-2 sm:px-3 text-sky-900 dark:text-sky-100 max-w-[80px] sm:max-w-[120px] truncate" title={u.name}>{u.name}</td>
                    <td className="py-2 px-2 sm:px-3 text-sky-700 dark:text-sky-200">{u.role || "—"}</td>
                    <td className="py-2 px-2 sm:px-3 text-sky-600 dark:text-sky-300 text-xs">
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
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-900/80 min-w-0 overflow-hidden">
          <h2 className="mb-2 font-medium text-gray-900 dark:text-white text-sm sm:text-base">Demand vs Supply</h2>
          <p className="mb-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Compare required headcount with available freelancers per day and role.
          </p>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Role</th>
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Demand</th>
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Supply</th>
                  <th className="text-left py-2 px-2 sm:px-3 font-medium text-gray-700 dark:text-gray-300">Match</th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => {
                  const supply = supplyByDateRole.get(`${r.date}|${r.role}`) ?? 0;
                  const ok = supply >= r.count_needed;
                  return (
                    <tr key={`${r.date}-${r.role}`} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-2 sm:px-3 text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                        {new Date(r.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })}
                      </td>
                      <td className="py-2 px-2 sm:px-3 text-gray-700 dark:text-gray-300">{r.role}</td>
                      <td className="py-2 px-2 sm:px-3 text-amber-600 dark:text-amber-400">{r.count_needed}</td>
                      <td className="py-2 px-2 sm:px-3 text-sky-600 dark:text-sky-400">{supply}</td>
                      <td className="py-2 px-2 sm:px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            ok
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200"
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

      <div className="flex flex-wrap gap-2 sm:gap-4 items-center min-w-0">
        {canRunAiSuggest && (
        <button
          type="button"
          onClick={handleAiSuggest}
          disabled={aiLoading || requirements.length === 0}
          className="rounded-lg bg-violet-600 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {aiLoading ? "Running AI..." : "AI Suggest Assignments"}
        </button>
        )}
        <Link
          href="/contractor-availability"
          className="rounded-lg border border-gray-300 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {canRunAiSuggest ? "Review & Approve in Contractor Availability →" : "View in Contractor Availability →"}
        </Link>
      </div>
    </div>
  );
}
