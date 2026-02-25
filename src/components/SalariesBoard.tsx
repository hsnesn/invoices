"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { EmptyState } from "./EmptyState";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SalaryRow = {
  id: string;
  display_id: number | null;
  employee_id: string | null;
  employee_name: string | null;
  ni_number: string | null;
  bank_account_number: string | null;
  sort_code: string | null;
  net_pay: number | null;
  total_gross_pay: number | null;
  paye_tax: number | null;
  employee_ni: number | null;
  employee_pension: number | null;
  employer_pension: number | null;
  employer_ni: number | null;
  employer_total_cost: number | null;
  payment_month: string | null;
  payment_year: number | null;
  process_date: string | null;
  tax_period: string | null;
  reference: string | null;
  payslip_storage_path: string | null;
  status: string;
  paid_date: string | null;
  email_sent_status: string | null;
  created_at: string;
  employees?: { full_name: string | null; email_address: string | null; badge_color: string | null } | null;
};

const GROUPS = [
  { key: "pending", label: "Pending", color: "border-amber-500", headerBg: "bg-amber-50 dark:bg-amber-950/30", textColor: "text-amber-700 dark:text-amber-400" },
  { key: "needs_review", label: "Needs Review", color: "border-orange-500", headerBg: "bg-orange-50 dark:bg-orange-950/30", textColor: "text-orange-700 dark:text-orange-400" },
  { key: "paid", label: "Paid", color: "border-emerald-500", headerBg: "bg-emerald-50 dark:bg-emerald-950/30", textColor: "text-emerald-700 dark:text-emerald-400" },
];

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return "—";
  return `£${Number(v).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function statusToGroup(status: string): string {
  if (status === "paid") return "paid";
  if (status === "needs_review") return "needs_review";
  return "pending";
}

const DEFAULT_BADGE_COLOR = "#64748b";

function getEmployeeBadgeColor(
  salary: SalaryRow,
  nameToColor: Map<string, string>
): string {
  const emp = salary.employees;
  if (emp?.badge_color) return emp.badge_color;
  const name = salary.employee_name?.trim();
  if (name) {
    const exact = nameToColor.get(name);
    if (exact) return exact;
    const lower = name.toLowerCase();
    for (const [empName, color] of Array.from(nameToColor.entries())) {
      if (empName.toLowerCase().includes(lower) || lower.includes(empName.toLowerCase())) return color;
    }
  }
  return DEFAULT_BADGE_COLOR;
}

export function SalariesBoard({ employees }: { employees: { id: string; full_name: string | null; badge_color: string | null }[] }) {
  const { data: salaries = [], mutate } = useSWR<SalaryRow[]>("/api/salaries", fetcher);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [addEmployeeName, setAddEmployeeName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEmployeeId, setUploadEmployeeId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const byGroup: Record<string, SalaryRow[]> = { pending: [], needs_review: [], paid: [] };
    for (const s of salaries) {
      const g = statusToGroup(s.status);
      byGroup[g].push(s);
    }
    return byGroup;
  }, [salaries]);

  const filtered = React.useMemo(() => {
    return salaries.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (![s.employee_name, s.reference, s.payment_month, s.ni_number].some((v) => String(v ?? "").toLowerCase().includes(q))) return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      if (monthFilter && s.payment_month !== monthFilter) return false;
      return true;
    });
  }, [salaries, search, statusFilter, monthFilter]);

  const uniqueMonths = React.useMemo(() => Array.from(new Set(salaries.map((s) => s.payment_month).filter(Boolean))).sort(), [salaries]);

  const nameToColor = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) {
      if (e.full_name && e.badge_color) m.set(e.full_name, e.badge_color);
    }
    return m;
  }, [employees]);

  const handleAddSalary = useCallback(async () => {
    if (!addEmployeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_name: addEmployeeName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add salary");
      toast.success("Salary record added");
      setShowAddModal(false);
      setAddEmployeeName("");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  }, [addEmployeeName, mutate]);

  const handleUpload = useCallback(async () => {
    if (!uploadFile) {
      toast.error("Please select a file");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadEmployeeId) formData.append("employee_id", uploadEmployeeId);
      const res = await fetch("/api/salaries/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success("Payslip uploaded and extracted");
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadEmployeeId("");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, [uploadFile, uploadEmployeeId, mutate]);

  const handleMarkPaid = useCallback(async (id: string) => {
    setMarkingPaidId(id);
    try {
      const res = await fetch(`/api/salaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to mark as paid");
      toast.success("Marked as paid. Confirmation email sent.");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMarkingPaidId(null);
    }
  }, [mutate]);

  const downloadPayslip = useCallback(async (path: string, name: string) => {
    try {
      const res = await fetch(`/api/salaries/download?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "payslip.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download payslip");
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payslips</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <span>+</span> Add Salary
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500"
          >
            <span>↑</span> Upload Payslip
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="needs_review">Needs Review</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All months</option>
          {uniqueMonths.map((m) => (
            <option key={m!} value={m!}>{m}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No payslips yet"
          description="Add a salary record or upload a payslip PDF to get started."
        />
      ) : (
        <div className="space-y-6">
          {GROUPS.map((g) => {
            const rows = filtered.filter((r) => statusToGroup(r.status) === g.key);
            if (rows.length === 0) return null;
            return (
              <div key={g.key} className={`rounded-xl border-2 ${g.color} overflow-hidden`}>
                <div className={`px-4 py-2 ${g.headerBg} ${g.textColor} font-semibold`}>
                  {g.label} ({rows.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                        <th className="px-3 py-2 text-left font-medium">ID</th>
                        <th className="px-3 py-2 text-left font-medium">Employee</th>
                        <th className="px-3 py-2 text-left font-medium">Net Pay</th>
                        <th className="px-3 py-2 text-left font-medium">Gross Pay</th>
                        <th className="px-3 py-2 text-left font-medium">Sort Code</th>
                        <th className="px-3 py-2 text-left font-medium">Account</th>
                        <th className="px-3 py-2 text-left font-medium">Reference</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Month</th>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Total Cost</th>
                        <th className="px-3 py-2 text-left font-medium">File</th>
                        <th className="px-3 py-2 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="px-3 py-2">{s.display_id ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span
                              className="inline-flex rounded px-2 py-1 text-sm font-medium text-white"
                              style={{ backgroundColor: getEmployeeBadgeColor(s, nameToColor) }}
                            >
                              {s.employee_name ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2">{fmtCurrency(s.net_pay)}</td>
                          <td className="px-3 py-2">{fmtCurrency(s.total_gross_pay)}</td>
                          <td className="px-3 py-2">{s.sort_code ?? "—"}</td>
                          <td className="px-3 py-2">{s.bank_account_number ?? "—"}</td>
                          <td className="px-3 py-2">{s.reference ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              s.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" :
                              s.status === "needs_review" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" :
                              "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-3 py-2">{s.payment_month ?? "—"}</td>
                          <td className="px-3 py-2">{s.process_date ?? "—"}</td>
                          <td className="px-3 py-2">{fmtCurrency(s.employer_total_cost)}</td>
                          <td className="px-3 py-2">
                            {s.payslip_storage_path ? (
                              <button
                                onClick={() => downloadPayslip(s.payslip_storage_path!, s.employee_name ? `${s.employee_name}-payslip.pdf` : "payslip.pdf")}
                                className="text-indigo-600 hover:underline dark:text-indigo-400"
                              >
                                PDF
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {s.status !== "paid" && (
                              <button
                                onClick={() => handleMarkPaid(s.id)}
                                disabled={markingPaidId === s.id || !s.net_pay}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {markingPaidId === s.id ? "..." : "Mark Paid"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="text-lg font-semibold">Add Salary</h2>
            <p className="mt-1 text-sm text-gray-500">Create a new salary record (status: Pending)</p>
            <input
              type="text"
              placeholder="Employee name"
              value={addEmployeeName}
              onChange={(e) => setAddEmployeeName(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleAddSalary} disabled={adding} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="text-lg font-semibold">Upload Payslip</h2>
            <p className="mt-1 text-sm text-gray-500">Upload a PDF payslip. AI will extract salary data.</p>
            <select
              value={uploadEmployeeId}
              onChange={(e) => setUploadEmployeeId(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Match from document (optional)</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name ?? e.id}</option>
              ))}
            </select>
            <input
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="mt-3 w-full text-sm"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowUploadModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleUpload} disabled={uploading || !uploadFile} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50">
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
