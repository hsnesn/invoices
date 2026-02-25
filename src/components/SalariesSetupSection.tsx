"use client";

import { useState, useEffect, useCallback } from "react";

type Employee = {
  id: string;
  full_name: string | null;
  ni_number: string | null;
  bank_account_number: string | null;
  sort_code: string | null;
  email_address: string | null;
  badge_color: string | null;
  status: string | null;
};

export function SalariesSetupSection() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ full_name: string; bank_account_number: string; sort_code: string; email_address: string; badge_color: string }>({
    full_name: "",
    bank_account_number: "",
    sort_code: "",
    email_address: "",
    badge_color: "#64748b",
  });
  const [newEmployee, setNewEmployee] = useState({ full_name: "", bank_account_number: "", sort_code: "", email_address: "", badge_color: "#64748b" });

  const refresh = useCallback(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditForm({
      full_name: emp.full_name ?? "",
      bank_account_number: emp.bank_account_number ?? "",
      sort_code: emp.sort_code ?? "",
      email_address: emp.email_address ?? "",
      badge_color: emp.badge_color ?? "#64748b",
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editForm.full_name.trim() || undefined,
          bank_account_number: editForm.bank_account_number.trim() || null,
          sort_code: editForm.sort_code.trim() || null,
          email_address: editForm.email_address.trim() || null,
          badge_color: editForm.badge_color.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...data } : e)));
        setEditingId(null);
        setMessage({ type: "success", text: "Employee updated." });
      } else {
        setMessage({ type: "error", text: data.error ?? "Update failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const deleteEmployee = async () => {
    if (!deleteId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${deleteId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      setDeleteId(null);
      if (res.ok) {
        setEmployees((prev) => prev.filter((e) => e.id !== deleteId));
        setMessage({ type: "success", text: "Employee deleted." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error ?? "Delete failed." });
      }
    } catch {
      setDeleteId(null);
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployee.full_name.trim()) {
      setMessage({ type: "error", text: "Full name is required." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newEmployee.full_name.trim(),
          bank_account_number: newEmployee.bank_account_number.trim() || null,
          sort_code: newEmployee.sort_code.trim() || null,
          email_address: newEmployee.email_address.trim() || null,
          badge_color: newEmployee.badge_color.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmployees((prev) => [...prev, data]);
        setNewEmployee({ full_name: "", bank_account_number: "", sort_code: "", email_address: "", badge_color: "#64748b" });
        setMessage({ type: "success", text: "Employee added." });
      } else {
        setMessage({ type: "error", text: data.error ?? "Add failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border-2 border-indigo-600 border-l-4 border-l-indigo-600 bg-indigo-50 p-6 dark:border-indigo-500 dark:bg-indigo-950/40">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
          Employee Bank Details
          <span className="text-xs font-normal text-gray-400">({employees.length})</span>
        </h2>
        <p className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
          Enter official names and bank details. When a payslip PDF is uploaded and the name is read, these details will be used automatically.
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

        <form onSubmit={addEmployee} className="mb-6 flex flex-wrap gap-3">
          <input
            type="text"
            value={newEmployee.full_name}
            onChange={(e) => setNewEmployee((p) => ({ ...p, full_name: e.target.value }))}
            placeholder="Official full name (e.g. Mr. UNAL SAHIN)"
            className={`min-w-[200px] flex-1 ${inputCls}`}
          />
          <input
            type="text"
            value={newEmployee.sort_code}
            onChange={(e) => setNewEmployee((p) => ({ ...p, sort_code: e.target.value }))}
            placeholder="Sort code (e.g. 40-14-03)"
            className={`w-32 ${inputCls}`}
          />
          <input
            type="text"
            value={newEmployee.bank_account_number}
            onChange={(e) => setNewEmployee((p) => ({ ...p, bank_account_number: e.target.value }))}
            placeholder="Account number"
            className={`w-36 ${inputCls}`}
          />
          <input
            type="email"
            value={newEmployee.email_address}
            onChange={(e) => setNewEmployee((p) => ({ ...p, email_address: e.target.value }))}
            placeholder="Email"
            className={`min-w-[200px] flex-1 ${inputCls}`}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Badge color</label>
            <input
              type="color"
              value={newEmployee.badge_color || "#64748b"}
              onChange={(e) => setNewEmployee((p) => ({ ...p, badge_color: e.target.value }))}
              className="h-9 w-14 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
              title="Badge color"
            />
            <input
              type="text"
              value={newEmployee.badge_color}
              onChange={(e) => setNewEmployee((p) => ({ ...p, badge_color: e.target.value }))}
              placeholder="#64748b"
              className={`w-24 font-mono text-sm ${inputCls}`}
            />
          </div>
          <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            Add
          </button>
        </form>

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
                <th className="px-4 py-3 text-left font-semibold text-gray-800 dark:text-gray-200">Color</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800 dark:text-gray-200">Official Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800 dark:text-gray-200">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800 dark:text-gray-200">Sort Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800 dark:text-gray-200">Account Number</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b-2 border-gray-200 dark:border-gray-600">
                  {editingId === emp.id ? (
                    <td colSpan={6} className="px-4 py-3">
                      <form onSubmit={saveEdit} className="flex flex-wrap items-center gap-3">
                        <input
                          type="text"
                          value={editForm.full_name}
                          onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                          placeholder="Official full name"
                          className={`min-w-[180px] flex-1 ${inputCls}`}
                          required
                        />
                        <input
                          type="email"
                          value={editForm.email_address}
                          onChange={(e) => setEditForm((p) => ({ ...p, email_address: e.target.value }))}
                          placeholder="Email"
                          className={`min-w-[180px] flex-1 ${inputCls}`}
                        />
                        <input
                          type="text"
                          value={editForm.sort_code}
                          onChange={(e) => setEditForm((p) => ({ ...p, sort_code: e.target.value }))}
                          placeholder="Sort code"
                          className={`w-28 ${inputCls}`}
                        />
                        <input
                          type="text"
                          value={editForm.bank_account_number}
                          onChange={(e) => setEditForm((p) => ({ ...p, bank_account_number: e.target.value }))}
                          placeholder="Account number"
                          className={`w-32 ${inputCls}`}
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Color</label>
                          <input
                            type="color"
                            value={editForm.badge_color || "#64748b"}
                            onChange={(e) => setEditForm((p) => ({ ...p, badge_color: e.target.value }))}
                            className="h-8 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
                            title="Badge color"
                          />
                          <input
                            type="text"
                            value={editForm.badge_color}
                            onChange={(e) => setEditForm((p) => ({ ...p, badge_color: e.target.value }))}
                            className={`w-24 font-mono text-sm ${inputCls}`}
                          />
                        </div>
                        <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border-2 border-gray-400 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-700">
                          Cancel
                        </button>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className="inline-block h-6 w-6 rounded-full border-2 border-gray-300 shadow-sm"
                          style={{ backgroundColor: emp.badge_color ?? "#64748b" }}
                          title={emp.badge_color ?? "Default"}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{emp.full_name ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">{emp.email_address ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{emp.sort_code ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-700 dark:text-gray-300">{emp.bank_account_number ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(emp)}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-indigo-600 dark:hover:bg-gray-700 dark:hover:text-indigo-400"
                            title="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(emp.id)}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No employees yet. Add one above.</div>
          )}
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 w-full max-w-sm rounded-xl border-2 border-gray-300 bg-white p-6 shadow-xl dark:border-gray-600 dark:bg-gray-900">
            <p className="mb-4 font-medium text-gray-900 dark:text-gray-100">
              Delete this employee? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-lg border-2 border-gray-400 px-4 py-2 font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={deleteEmployee}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
