"use client";

import { useState, useEffect } from "react";
import { DepartmentManagersSection } from "@/components/DepartmentManagersSection";
import { ProducerColorsSection } from "@/components/ProducerColorsSection";
import { EmailSetupSection } from "@/components/EmailSetupSection";
import { ContractorTemplatesSection } from "@/components/ContractorTemplatesSection";
import { SalariesSetupSection } from "@/components/SalariesSetupSection";

interface Department {
  id: string;
  name: string;
}

interface Program {
  id: string;
  department_id: string;
  name: string;
}

const TABS = [
  { key: "guest", label: "Guest Invoices", color: "bg-blue-500" },
  { key: "freelancer", label: "Freelancer Invoices", color: "bg-teal-500" },
  { key: "email", label: "Email", color: "bg-amber-500" },
  { key: "salaries", label: "Salaries", color: "bg-indigo-500" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminSetupPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("guest");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Setup</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-gray-700 dark:bg-gray-800/60">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${tab.color}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "guest" && <GuestInvoiceSetup />}
      {activeTab === "freelancer" && <FreelancerSetup />}
      {activeTab === "email" && <EmailSetupSection />}
      {activeTab === "salaries" && <SalariesSetupSection />}
    </div>
  );
}

function PlaceholderSetup({ section, color }: { section: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: "border-teal-500/30 bg-teal-500/5 text-teal-400",
    indigo: "border-indigo-500/30 bg-indigo-500/5 text-indigo-400",
  };
  return (
    <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${colorMap[color] ?? "border-gray-500/30 bg-gray-500/5 text-gray-400"}`}>
      <svg className="mx-auto h-12 w-12 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <h3 className="mt-4 text-lg font-semibold">{section} Setup</h3>
      <p className="mt-2 text-sm opacity-70">
        Configuration for {section.toLowerCase()} will be available here soon.
      </p>
    </div>
  );
}

type UserOption = { id: string; full_name: string | null; email?: string | null; role: string; is_active?: boolean };

function GuestInvoiceSetup() {
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
  const [resetConfirm, setResetConfirm] = useState(false);

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

  const resetList = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/setup/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setResetConfirm(false);
      if (res.ok) {
        refresh();
        setMessage({ type: "success", text: "List reset to defaults." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Reset failed." });
      }
    } catch {
      setResetConfirm(false);
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setResetConfirm(true)}
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 hover:bg-amber-500/20 dark:text-amber-200"
        >
          Reset to defaults
        </button>
      </div>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${
          message.type === "success"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
            : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Departments */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-4 font-medium text-gray-900 dark:text-white">Departments</h2>
        <form onSubmit={addDepartment} className="mb-4 flex gap-2">
          <input
            type="text"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            placeholder="Department name"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
          <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
            Add
          </button>
        </form>
        <ul className="space-y-1 text-sm">
          {departments.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
              {editingDept?.id === d.id ? (
                <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); const inp = e.currentTarget.querySelector("input"); if (inp) updateDepartment(inp.value); }}>
                  <input type="text" defaultValue={d.name} autoFocus className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" onKeyDown={(e) => e.key === "Escape" && setEditingDept(null)} />
                  <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-sm text-white">Save</button>
                  <button type="button" onClick={() => setEditingDept(null)} className="rounded bg-gray-200 px-2 py-1 text-sm text-gray-700 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="text-gray-800 dark:text-gray-200">{d.name}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditingDept(d)} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200" title="Edit">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm({ type: "dept", id: d.id })} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-300" title="Delete">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Programs */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-4 font-medium text-gray-900 dark:text-white">Programs</h2>
        <form onSubmit={addProgram} className="mb-4 flex flex-wrap gap-2">
          <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">Select department</option>
            {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
          <input type="text" value={newProg} onChange={(e) => setNewProg(e.target.value)} placeholder="Program name" className="min-w-[200px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500" />
          <button type="submit" disabled={loading || !selectedDept} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
            Add
          </button>
        </form>
        <ul className="space-y-1 text-sm">
          {programs.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
              {editingProg?.id === p.id ? (
                <form className="flex flex-1 flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const inp = e.currentTarget.querySelector<HTMLInputElement>("input[name=progName]"); const sel = e.currentTarget.querySelector<HTMLSelectElement>("select[name=progDept]"); if (inp && sel) updateProgram(inp.value, sel.value); }}>
                  <select name="progDept" defaultValue={p.department_id} className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                    {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                  </select>
                  <input name="progName" type="text" defaultValue={p.name} autoFocus className="min-w-[120px] flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" onKeyDown={(e) => e.key === "Escape" && setEditingProg(null)} />
                  <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-sm text-white">Save</button>
                  <button type="button" onClick={() => setEditingProg(null)} className="rounded bg-gray-200 px-2 py-1 text-sm text-gray-700 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="text-gray-800 dark:text-gray-200">{p.name} <span className="text-gray-400">({departments.find((d) => d.id === p.department_id)?.name ?? "—"})</span></span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditingProg(p)} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200" title="Edit">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm({ type: "prog", id: p.id })} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-300" title="Delete">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <DepartmentManagersSection />

      <ProducerColorsSection />

      {/* Admin & Finance Assignment */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Admin & Finance</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Assign Admin and Finance roles. Changes take effect immediately.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Admins</h3>
            <div className="space-y-1">
              {users.filter((u) => u.role === "admin" && u.is_active !== false).map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded bg-red-50 px-2 py-1 dark:bg-red-900/20">
                  <span className="text-sm">{u.full_name || u.email || u.id.slice(0, 8)}</span>
                  <span className="text-xs text-gray-500">Admin</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Finance</h3>
            <div className="space-y-1">
              {users.filter((u) => u.role === "finance" && u.is_active !== false).map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded bg-emerald-50 px-2 py-1 dark:bg-emerald-900/20">
                  <span className="text-sm">{u.full_name || u.email || u.id.slice(0, 8)}</span>
                  <span className="text-xs text-gray-500">Finance</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          To change roles, go to Admin → Users and edit each user&apos;s role.
        </p>
      </div>

      {/* Reset Confirm Modal */}
      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-4 text-gray-800 dark:text-gray-200">All departments and programs will be deleted and reset to defaults. Continue?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setResetConfirm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={resetList} disabled={loading} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-500 disabled:opacity-50">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-4 text-gray-800 dark:text-gray-200">
              Delete this {deleteConfirm.type === "dept" ? "department" : "program"}?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={deleteConfirm.type === "dept" ? deleteDepartment : deleteProgram} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Freelancer Setup ─────────────────────── */

interface SetupItem { id: string; category: string; value: string; sort_order: number; }

const FL_CATEGORIES = [
  { key: "service_description", label: "Service Descriptions", placeholder: "e.g. Audio Production Services", borderColor: "border-l-violet-500", dotColor: "bg-violet-500", btnColor: "bg-violet-600 hover:bg-violet-500", focusColor: "focus:border-violet-500 focus:ring-violet-500" },
  { key: "booked_by", label: "Booked By", placeholder: "e.g. Hasan ESEN", borderColor: "border-l-sky-500", dotColor: "bg-sky-500", btnColor: "bg-sky-600 hover:bg-sky-500", focusColor: "focus:border-sky-500 focus:ring-sky-500" },
  { key: "additional_cost_reason", label: "Additional Cost Reasons", placeholder: "e.g. Travel expenses", borderColor: "border-l-amber-500", dotColor: "bg-amber-500", btnColor: "bg-amber-600 hover:bg-amber-500", focusColor: "focus:border-amber-500 focus:ring-amber-500" },
  { key: "istanbul_team", label: "Istanbul Team Options", placeholder: "e.g. Istanbul Team", borderColor: "border-l-emerald-500", dotColor: "bg-emerald-500", btnColor: "bg-emerald-600 hover:bg-emerald-500", focusColor: "focus:border-emerald-500 focus:ring-emerald-500" },
];

type OrMember = { id: string; user_id: string; full_name: string; created_at: string };

function FreelancerSetup() {
  const [items, setItems] = useState<SetupItem[]>([]);
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<SetupItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDept, setNewDept] = useState("");
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);

  const [orMembers, setOrMembers] = useState<OrMember[]>([]);
  const [orNewUserId, setOrNewUserId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);

  const refresh = () => {
    fetch("/api/admin/freelancer-setup")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]));
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => setDepartments([]));
    fetch("/api/admin/operations-room")
      .then((r) => r.json())
      .then((d) => setOrMembers(Array.isArray(d) ? d : []))
      .catch(() => setOrMembers([]));
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  };

  useEffect(() => { refresh(); }, []);

  const addItem = async (category: string) => {
    const val = newValues[category]?.trim();
    if (!val) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/freelancer-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, value: val }) });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => [...prev, data as SetupItem]);
        setNewValues((prev) => ({ ...prev, [category]: "" }));
        setMessage({ type: "success", text: "Added." });
      } else setMessage({ type: "error", text: data.error || "Failed." });
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setLoading(false); }
  };

  const updateItem = async (value: string) => {
    if (!editingItem || !value.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/freelancer-setup", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingItem.id, value: value.trim() }) });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === editingItem.id ? (data as SetupItem) : i)));
        setEditingItem(null);
        setMessage({ type: "success", text: "Updated." });
      } else setMessage({ type: "error", text: data.error || "Failed." });
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setLoading(false); }
  };

  const deleteItem = async () => {
    if (!deleteId) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch(`/api/admin/freelancer-setup?id=${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== deleteId));
        setMessage({ type: "success", text: "Deleted." });
      } else { const d = await res.json(); setMessage({ type: "error", text: d.error || "Failed." }); }
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setDeleteId(null); setLoading(false); }
  };

  const inputCls = "flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:ring-1 focus:border-teal-500 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

  const restoreDefaults = async () => {
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/freelancer-setup/seed", { method: "POST" });
      if (res.ok) { refresh(); setMessage({ type: "success", text: "Defaults restored (Service Descriptions, Booked By, Cost Reasons)." }); }
      else { const d = await res.json(); setMessage({ type: "error", text: d.error || "Failed." }); }
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setLoading(false); }
  };

  const addDept = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newDept.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newDept.trim() }) });
      const data = await res.json();
      if (res.ok) { setDepartments(prev => [...prev, data as Department]); setNewDept(""); setMessage({ type: "success", text: "Department added." }); }
      else setMessage({ type: "error", text: data.error || "Failed." });
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setLoading(false); }
  };

  const updateDept = async (name: string) => {
    if (!editingDept || !name.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/departments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingDept.id, name: name.trim() }) });
      const data = await res.json();
      if (res.ok) { setDepartments(prev => prev.map(d => d.id === editingDept.id ? (data as Department) : d)); setEditingDept(null); setMessage({ type: "success", text: "Department updated." }); }
      else setMessage({ type: "error", text: data.error || "Failed." });
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setLoading(false); }
  };

  const deleteDept = async () => {
    if (!deleteDeptId) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch(`/api/admin/departments?id=${deleteDeptId}`, { method: "DELETE" });
      if (res.ok) { setDepartments(prev => prev.filter(d => d.id !== deleteDeptId)); setMessage({ type: "success", text: "Department deleted." }); }
      else { const d = await res.json(); setMessage({ type: "error", text: d.error || "Failed." }); }
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setDeleteDeptId(null); setLoading(false); }
  };

  const addOrMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orNewUserId.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/operations-room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: orNewUserId }) });
      const data = await res.json();
      if (res.ok) { refresh(); setOrNewUserId(""); setMessage({ type: "success", text: "Added to The Operations Room." }); }
      else setMessage({ type: "error", text: data.error || "Failed." });
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setLoading(false); }
  };

  const removeOrMember = async (id: string) => {
    setLoading(true); setMessage(null);
    try {
      const res = await fetch(`/api/admin/operations-room?id=${id}`, { method: "DELETE" });
      if (res.ok) { refresh(); setMessage({ type: "success", text: "Removed from The Operations Room." }); }
      else { const d = await res.json(); setMessage({ type: "error", text: d.error || "Failed." }); }
    } catch { setMessage({ type: "error", text: "Connection error." }); }
    finally { setLoading(false); }
  };

  const availableUsers = users.filter((u) => u.is_active !== false && !orMembers.some((m) => m.user_id === u.id));

  return (
    <div className="space-y-6">
      <ContractorTemplatesSection />
      <div className="flex justify-end">
        <button type="button" onClick={restoreDefaults} disabled={loading} className="rounded-lg border border-teal-500/50 bg-teal-500/10 px-4 py-2 text-sm text-teal-700 hover:bg-teal-500/20 dark:text-teal-200 disabled:opacity-50">
          Restore defaults
        </button>
      </div>
      {message && (
        <div className={`rounded-lg border p-3 text-sm ${message.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* Departments (shared - used as Department 1 & Department 2) */}
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-blue-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Departments
          <span className="text-xs font-normal text-gray-400">({departments.length})</span>
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">Used for both Department and Department 2 dropdowns in the freelancer form.</p>
        <form onSubmit={addDept} className="mb-4 flex gap-2">
          <input type="text" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="e.g. News Output" className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500" />
          <button type="submit" disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">Add</button>
        </form>
        <ul className="space-y-1 text-sm">
          {departments.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
              {editingDept?.id === d.id ? (
                <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); const inp = e.currentTarget.querySelector("input"); if (inp) updateDept(inp.value); }}>
                  <input type="text" defaultValue={d.name} autoFocus className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" onKeyDown={(e) => e.key === "Escape" && setEditingDept(null)} />
                  <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-sm text-white">Save</button>
                  <button type="button" onClick={() => setEditingDept(null)} className="rounded bg-gray-200 px-2 py-1 text-sm text-gray-700 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="text-gray-800 dark:text-gray-200">{d.name}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setEditingDept(d)} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200" title="Edit">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button type="button" onClick={() => setDeleteDeptId(d.id)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-300" title="Delete">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
          {departments.length === 0 && <li className="text-gray-400 text-xs py-2">No departments yet.</li>}
        </ul>
      </div>

      <DepartmentManagersSection />

      {/* The Operations Room */}
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-orange-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          The Operations Room
          <span className="text-xs font-normal text-gray-400">({orMembers.length})</span>
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">Users assigned here can approve freelancer invoices when they are in The Operations Room stage. They see all freelancer invoices but can only act when the invoice is awaiting Operations Room approval.</p>
        <form onSubmit={addOrMember} className="mb-4 flex gap-2">
          <select value={orNewUserId} onChange={(e) => setOrNewUserId(e.target.value)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">Select user to add</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name || u.id} {u.email ? `(${u.email})` : ""}</option>
            ))}
          </select>
          <button type="submit" disabled={loading || !orNewUserId} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50">Add</button>
        </form>
        <ul className="space-y-1 text-sm">
          {orMembers.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
              <span className="text-gray-800 dark:text-gray-200">{m.full_name}</span>
              <button type="button" onClick={() => void removeOrMember(m.id)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-300" title="Remove">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </li>
          ))}
          {orMembers.length === 0 && <li className="text-gray-400 text-xs py-2">No members yet. Add users who will approve invoices at The Operations Room stage.</li>}
        </ul>
      </div>

      {FL_CATEGORIES.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.key);
        return (
          <div key={cat.key} className={`rounded-xl border border-gray-200 border-l-4 ${cat.borderColor} bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80`}>
            <h2 className="mb-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${cat.dotColor}`} />
              {cat.label}
              <span className="text-xs font-normal text-gray-400">({catItems.length})</span>
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); addItem(cat.key); }} className="mb-4 flex gap-2">
              <input type="text" value={newValues[cat.key] ?? ""} onChange={(e) => setNewValues((prev) => ({ ...prev, [cat.key]: e.target.value }))} placeholder={cat.placeholder} className={inputCls.replace("focus:border-teal-500 focus:ring-teal-500", cat.focusColor)} />
              <button type="submit" disabled={loading} className={`rounded-lg ${cat.btnColor} px-4 py-2 text-sm font-medium text-white disabled:opacity-50`}>Add</button>
            </form>
            <ul className="space-y-1 text-sm">
              {catItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                  {editingItem?.id === item.id ? (
                    <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); const inp = e.currentTarget.querySelector("input"); if (inp) updateItem(inp.value); }}>
                      <input type="text" defaultValue={item.value} autoFocus className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" onKeyDown={(e) => e.key === "Escape" && setEditingItem(null)} />
                      <button type="submit" className={`rounded ${cat.btnColor} px-2 py-1 text-sm text-white`}>Save</button>
                      <button type="button" onClick={() => setEditingItem(null)} className="rounded bg-gray-200 px-2 py-1 text-sm text-gray-700 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <span className="text-gray-800 dark:text-gray-200">{item.value}</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setEditingItem(item)} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200" title="Edit">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button type="button" onClick={() => setDeleteId(item.id)} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-300" title="Delete">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {catItems.length === 0 && <li className="text-gray-400 text-xs py-2">No items yet.</li>}
            </ul>
          </div>
        );
      })}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-4 text-gray-800 dark:text-gray-200">Delete this item?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={deleteItem} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-4 text-gray-800 dark:text-gray-200">Delete this department? This affects both Guest and Freelancer invoices.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteDeptId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">Cancel</button>
              <button onClick={deleteDept} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
