"use client";

import { useState, useEffect } from "react";
import { DepartmentManagersSection } from "@/components/DepartmentManagersSection";
import { ProgramManagerOverridesSection } from "@/components/ProgramManagerOverridesSection";
import { ApprovalDelegationSection } from "@/components/ApprovalDelegationSection";
import { SlaSettingsSection } from "@/components/SlaSettingsSection";
import { ProducerColorsSection } from "@/components/ProducerColorsSection";

interface Department {
  id: string;
  name: string;
  sort_order?: number;
}

interface Program {
  id: string;
  department_id: string;
  name: string;
  sort_order?: number;
}

type UserOption = { id: string; full_name: string | null; email?: string | null; role: string; is_active?: boolean };

const iconCls = "h-5 w-5 shrink-0";

export function GuestInvoiceSetupSection() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [newDept, setNewDept] = useState("");
  const [newProg, setNewProg] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingProg, setEditingProg] = useState<Program | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "dept" | "prog"; id: string } | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const [linkExpiryDays, setLinkExpiryDays] = useState(7);
  const [linkExpirySaving, setLinkExpirySaving] = useState(false);

  const refresh = () => {
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => setDepartments([]));
    fetch("/api/admin/programs")
      .then((r) => r.json())
      .then((d) => setPrograms(Array.isArray(d) ? d : []))
      .catch(() => setPrograms([]));
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    fetch("/api/admin/app-settings")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object" && d.guest_invoice_link_expiry_days != null) {
          const v = d.guest_invoice_link_expiry_days;
          const n = typeof v === "number" ? v : Number(v);
          if (Number.isFinite(n) && n >= 1) setLinkExpiryDays(Math.min(90, n));
        }
      })
      .catch(() => {});
  }, []);

  const toggleDept = (id: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const moveDepartment = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= departments.length) return;
    const arr = [...departments];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    const ids = arr.map((d) => d.id);
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/departments/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setDepartments(arr);
        setMessage({ type: "success", text: "Order updated." });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to reorder." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const moveProgram = async (deptId: string, index: number, direction: "up" | "down") => {
    const deptPrograms = programs.filter((p) => p.department_id === deptId);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= deptPrograms.length) return;
    const arr = [...deptPrograms];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    const ids = arr.map((p) => p.id);
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/programs/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_id: deptId, ids }),
      });
      if (res.ok) {
        setPrograms((prev) => {
          const result: Program[] = [];
          for (const d of departments) {
            if (d.id === deptId) result.push(...arr);
            else result.push(...prev.filter((p) => p.department_id === d.id));
          }
          return result;
        });
        setMessage({ type: "success", text: "Order updated." });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to reorder." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const addDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDept.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDepartments((prev) => [...prev, data as Department]);
        setNewDept("");
        setMessage({ type: "success", text: "Department added." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to add department." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const addProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProg.trim() || !selectedDept) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProg.trim(), department_id: selectedDept }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPrograms((prev) => [...prev, data as Program]);
        setNewProg("");
        setMessage({ type: "success", text: "Program added." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to add program." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const updateDepartment = async (name: string) => {
    if (!editingDept || !name.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingDept.id, name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDepartments((prev) => prev.map((d) => (d.id === editingDept.id ? (data as Department) : d)));
        setEditingDept(null);
        setMessage({ type: "success", text: "Department updated." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to update department." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const updateProgram = async (name: string, department_id: string) => {
    if (!editingProg) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingProg.id, name: name.trim(), department_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPrograms((prev) => prev.map((p) => (p.id === editingProg.id ? (data as Program) : p)));
        setEditingProg(null);
        setMessage({ type: "success", text: "Program updated." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to update program." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const deleteDepartment = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "dept") return;
    const deptId = deleteConfirm.id;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/departments?id=${deptId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      setDeleteConfirm(null);
      if (res.ok) {
        setDepartments((prev) => prev.filter((d) => d.id !== deptId));
        setPrograms((prev) => prev.filter((p) => p.department_id !== deptId));
        setMessage({ type: "success", text: "Department deleted." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to delete department." });
      }
    } catch {
      setDeleteConfirm(null);
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const deleteProgram = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "prog") return;
    const progId = deleteConfirm.id;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/programs?id=${progId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      setDeleteConfirm(null);
      if (res.ok) {
        setPrograms((prev) => prev.filter((p) => p.id !== progId));
        setMessage({ type: "success", text: "Program deleted." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed to delete program." });
      }
    } catch {
      setDeleteConfirm(null);
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const saveLinkExpiry = async () => {
    setLinkExpirySaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "guest_invoice_link_expiry_days", value: linkExpiryDays }),
      });
      if (res.ok) setMessage({ type: "success", text: "Guest invoice link expiry saved." });
      else setMessage({ type: "error", text: "Failed to save." });
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLinkExpirySaving(false);
    }
  };

  const inputBase = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";
  const btnPrimary = "inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-50";
  const btnIcon = "rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300 disabled:opacity-40";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:from-blue-950/40 dark:to-indigo-950/30">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Guest invoice configuration
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Set up departments, programs, managers, approval rules, SLA and producer branding. Changes apply across the app.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Quick settings */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
              <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Link expiry</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Days until guest submit links expire</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={90}
              value={linkExpiryDays}
              onChange={(e) => setLinkExpiryDays(Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 7)))}
              className={`w-20 ${inputBase}`}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">days</span>
            <button
              type="button"
              onClick={() => void saveLinkExpiry()}
              disabled={linkExpirySaving}
              className={btnPrimary}
            >
              {linkExpirySaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Structure: Departments & Programs */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Structure</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Departments & programs
          </span>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
            <h4 className="mb-3 font-medium text-gray-800 dark:text-gray-200">Departments</h4>
            <form onSubmit={addDepartment} className="mb-4 flex gap-2">
              <input
                type="text"
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder="Add department"
                className={`flex-1 ${inputBase}`}
              />
              <button type="submit" disabled={loading} className={btnPrimary}>
                Add
              </button>
            </form>
            <ul className="space-y-2">
              {departments.map((d, i) => (
                <li
                  key={d.id}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 py-2.5 pl-3 pr-2 dark:border-gray-700 dark:bg-gray-800/50"
                >
                  {editingDept?.id === d.id ? (
                    <form
                      className="flex flex-1 gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const inp = e.currentTarget.querySelector("input");
                        if (inp) updateDepartment(inp.value);
                      }}
                    >
                      <input
                        type="text"
                        defaultValue={d.name}
                        autoFocus
                        className={`flex-1 ${inputBase} py-1.5`}
                        onKeyDown={(e) => e.key === "Escape" && setEditingDept(null)}
                      />
                      <button type="submit" className="rounded-lg bg-blue-600 px-2 py-1.5 text-sm text-white">Save</button>
                      <button type="button" onClick={() => setEditingDept(null)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600">
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{d.name}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveDepartment(i, "up")} disabled={loading || i === 0} className={btnIcon} title="Move up">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => moveDepartment(i, "down")} disabled={loading || i === departments.length - 1} className={btnIcon} title="Move down">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => setEditingDept(d)} className={btnIcon} title="Edit">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm({ type: "dept", id: d.id })} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Delete">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
            <h4 className="mb-3 font-medium text-gray-800 dark:text-gray-200">Programs</h4>
            <form onSubmit={addProgram} className="mb-4 flex flex-wrap gap-2">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className={inputBase}
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={newProg}
                onChange={(e) => setNewProg(e.target.value)}
                placeholder="Program name"
                className={`min-w-[140px] flex-1 ${inputBase}`}
              />
              <button type="submit" disabled={loading || !selectedDept} className={btnPrimary}>
                Add
              </button>
            </form>
            <div className="max-h-[320px] space-y-2 overflow-y-auto">
              {departments.map((dept) => {
                const deptPrograms = programs.filter((p) => p.department_id === dept.id);
                const isExpanded = expandedDepts.has(dept.id) || deptPrograms.length <= 3;
                return (
                  <div key={dept.id} className="rounded-xl border border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => toggleDept(dept.id)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
                    >
                      <span>{dept.name}</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {deptPrograms.length} programs
                      </span>
                      <svg className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isExpanded && (
                      <ul className="border-t border-gray-200 px-2 pb-2 pt-1 dark:border-gray-700">
                        {deptPrograms.map((p, progIdx) => (
                          <li key={p.id} className="flex items-center gap-2 rounded-lg py-1.5 pl-2">
                            {editingProg?.id === p.id ? (
                              <form
                                className="flex flex-1 flex-wrap gap-2"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const inp = e.currentTarget.querySelector<HTMLInputElement>("input[name=progName]");
                                  const sel = e.currentTarget.querySelector<HTMLSelectElement>("select[name=progDept]");
                                  if (inp && sel) updateProgram(inp.value, sel.value);
                                }}
                              >
                                <select name="progDept" defaultValue={p.department_id} className={`${inputBase} py-1.5`}>
                                  {departments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </select>
                                <input name="progName" type="text" defaultValue={p.name} autoFocus className={`min-w-[100px] flex-1 ${inputBase} py-1.5`} onKeyDown={(e) => e.key === "Escape" && setEditingProg(null)} />
                                <button type="submit" className="rounded-lg bg-blue-600 px-2 py-1.5 text-sm text-white">Save</button>
                                <button type="button" onClick={() => setEditingProg(null)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600">Cancel</button>
                              </form>
                            ) : (
                              <>
                                <span className="flex-1 text-gray-700 dark:text-gray-300">{p.name}</span>
                                <div className="flex items-center gap-0.5">
                                  <button type="button" onClick={() => moveProgram(dept.id, progIdx, "up")} disabled={loading || progIdx === 0} className={btnIcon} title="Move up">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button type="button" onClick={() => moveProgram(dept.id, progIdx, "down")} disabled={loading || progIdx === deptPrograms.length - 1} className={btnIcon} title="Move down">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <button type="button" onClick={() => setEditingProg(p)} className={btnIcon} title="Edit">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button type="button" onClick={() => setDeleteConfirm({ type: "prog", id: p.id })} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                        {deptPrograms.length === 0 && (
                          <li className="py-2 text-center text-xs text-gray-400">No programs yet</li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Workflow</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Managers, approval, SLA
          </span>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <DepartmentManagersSection />
          <ProgramManagerOverridesSection />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ApprovalDelegationSection />
          <SlaSettingsSection />
        </div>
      </section>

      {/* Appearance */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Appearance</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Producer colors
          </span>
        </div>
        <ProducerColorsSection />
      </section>

      {/* Roles */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Roles</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Admin & Finance
          </span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Users with Admin and Finance roles. Changes take effect immediately. Edit roles in Admin → Users.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Admins</h4>
              <div className="space-y-2">
                {users.filter((u) => u.role === "admin" && u.is_active !== false).map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-red-50/50 px-3 py-2 dark:border-gray-700 dark:bg-red-900/10">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.full_name || u.email || u.id.slice(0, 8)}</span>
                    <span className="text-xs text-red-600 dark:text-red-400">Admin</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Finance</h4>
              <div className="space-y-2">
                {users.filter((u) => u.role === "finance" && u.is_active !== false).map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-emerald-50/50 px-3 py-2 dark:border-gray-700 dark:bg-emerald-900/10">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.full_name || u.email || u.id.slice(0, 8)}</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Finance</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-4 text-gray-800 dark:text-gray-200">
              Delete this {deleteConfirm.type === "dept" ? "department" : "program"}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.type === "dept" ? deleteDepartment : deleteProgram}
                disabled={loading}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
