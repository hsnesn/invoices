"use client";

import { useState, useEffect } from "react";

interface Department {
  id: string;
  name: string;
}

interface Program {
  id: string;
  department_id: string;
  name: string;
}

export default function AdminSetupPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
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
  };

  useEffect(() => {
    refresh();
  }, []);

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
      setMessage({ type: "error", text: "Bağlantı hatası. Sunucu çalışıyor mu kontrol edin." });
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
      setMessage({ type: "error", text: "Bağlantı hatası. Sunucu çalışıyor mu kontrol edin." });
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
      setMessage({ type: "error", text: "Bağlantı hatası. Sunucu çalışıyor mu kontrol edin." });
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
      setMessage({ type: "error", text: "Bağlantı hatası. Sunucu çalışıyor mu kontrol edin." });
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
      setMessage({ type: "error", text: "Bağlantı hatası. Sunucu çalışıyor mu kontrol edin." });
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
      setMessage({ type: "error", text: "Bağlantı hatası. Sunucu çalışıyor mu kontrol edin." });
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
      setMessage({ type: "error", text: "Bağlantı hatası. Sunucu çalışıyor mu kontrol edin." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-100">Setup</h1>
        <button
          type="button"
          onClick={() => setResetConfirm(true)}
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
        >
          Listeyi en baş haline getir
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/50 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="mb-4 font-medium text-slate-200">Departments</h2>
        <form onSubmit={addDepartment} className="mb-4 flex gap-2">
          <input
            type="text"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            placeholder="Department name"
            className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        <ul className="space-y-1 text-sm text-slate-300">
          {departments.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded border border-slate-600 bg-slate-800/50 px-3 py-2">
              {editingDept?.id === d.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const inp = (e.currentTarget).querySelector("input");
                    if (inp) updateDepartment(inp.value);
                  }}
                >
                  <input
                    type="text"
                    defaultValue={d.name}
                    autoFocus
                    className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
                    onKeyDown={(e) => e.key === "Escape" && setEditingDept(null)}
                  />
                  <button type="submit" className="rounded bg-sky-600 px-2 py-1 text-sm text-white">Save</button>
                  <button type="button" onClick={() => setEditingDept(null)} className="rounded bg-slate-600 px-2 py-1 text-sm text-slate-200">Cancel</button>
                </form>
              ) : (
                <>
                  <span>{d.name}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingDept(d)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ type: "dept", id: d.id })}
                      className="rounded p-1 text-red-400 hover:bg-slate-700 hover:text-red-300"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="mb-4 font-medium text-slate-200">Programs</h2>
        <form onSubmit={addProgram} className="mb-4 flex flex-wrap gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
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
            className="flex-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
          />
          <button
            type="submit"
            disabled={loading || !selectedDept}
            className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        <ul className="space-y-1 text-sm text-slate-300">
          {programs.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded border border-slate-600 bg-slate-800/50 px-3 py-2">
              {editingProg?.id === p.id ? (
                <form
                  className="flex flex-1 flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const inp = form.querySelector<HTMLInputElement>("input[name=progName]");
                    const sel = form.querySelector<HTMLSelectElement>("select[name=progDept]");
                    if (inp && sel) updateProgram(inp.value, sel.value);
                  }}
                >
                  <select
                    name="progDept"
                    defaultValue={p.department_id}
                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <input
                    name="progName"
                    type="text"
                    defaultValue={p.name}
                    autoFocus
                    className="min-w-[120px] flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
                    onKeyDown={(e) => e.key === "Escape" && setEditingProg(null)}
                  />
                  <button type="submit" className="rounded bg-sky-600 px-2 py-1 text-sm text-white">Save</button>
                  <button type="button" onClick={() => setEditingProg(null)} className="rounded bg-slate-600 px-2 py-1 text-sm text-slate-200">Cancel</button>
                </form>
              ) : (
                <>
                  <span>{p.name} ({departments.find((d) => d.id === p.department_id)?.name ?? "—"})</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingProg(p)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                      title="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ type: "prog", id: p.id })}
                      className="rounded p-1 text-red-400 hover:bg-slate-700 hover:text-red-300"
                      title="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {resetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <p className="mb-4 text-slate-200">Tüm bölüm ve programlar silinip varsayılanlar eklenecek. Devam?</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setResetConfirm(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
              >
                İptal
              </button>
              <button
                onClick={resetList}
                disabled={loading}
                className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-500 disabled:opacity-50"
              >
                Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <p className="mb-4 text-slate-200">
              Delete this {deleteConfirm.type === "dept" ? "department" : "program"}?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={deleteConfirm.type === "dept" ? deleteDepartment : deleteProgram}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50"
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
