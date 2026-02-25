"use client";

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { EmptyState } from "./EmptyState";
import { BulkMoveModal, type MoveGroup } from "./BulkMoveModal";

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
  employees?: { full_name: string | null; email_address: string | null; badge_color: string | null; bank_account_number?: string | null; sort_code?: string | null } | null;
};

const GROUPS = [
  { key: "pending", label: "Pending", color: "border-amber-600", headerBg: "bg-amber-100 dark:bg-amber-900/50", textColor: "text-amber-900 dark:text-amber-100" },
  { key: "needs_review", label: "Needs Review", color: "border-orange-600", headerBg: "bg-orange-100 dark:bg-orange-900/50", textColor: "text-orange-900 dark:text-orange-100" },
  { key: "paid", label: "Paid", color: "border-emerald-600", headerBg: "bg-emerald-100 dark:bg-emerald-900/50", textColor: "text-emerald-900 dark:text-emerald-100" },
];

const SALARY_MOVE_GROUPS: MoveGroup[] = [
  { key: "pending", label: "Pending", color: "border-amber-500", bgHex: "#fef3c7" },
  { key: "needs_review", label: "Needs Review", color: "border-orange-500", bgHex: "#ffedd5" },
  { key: "paid", label: "Paid", color: "border-emerald-500", bgHex: "#d1fae5" },
];

function getSalaryMoveGroups(canMarkPaid: boolean): MoveGroup[] {
  return canMarkPaid ? SALARY_MOVE_GROUPS : SALARY_MOVE_GROUPS.filter((g) => g.key !== "paid");
}

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

function EditSalaryModal({
  salary,
  onSave,
  onClose,
  saving,
}: {
  salary: SalaryRow;
  onSave: (updates: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [employee_name, setEmployeeName] = useState(salary.employee_name ?? "");
  const [net_pay, setNetPay] = useState(String(salary.net_pay ?? ""));
  const [total_gross_pay, setTotalGrossPay] = useState(String(salary.total_gross_pay ?? ""));
  const [bank_account_number, setBankAccount] = useState(salary.bank_account_number ?? "");
  const [sort_code, setSortCode] = useState(salary.sort_code ?? "");
  const [payment_month, setPaymentMonth] = useState(salary.payment_month ?? "");
  const [process_date, setProcessDate] = useState(salary.process_date ?? "");
  const [reference, setReference] = useState(salary.reference ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: Record<string, unknown> = {};
    if (employee_name.trim()) updates.employee_name = employee_name.trim();
    const np = parseFloat(net_pay);
    if (!Number.isNaN(np)) updates.net_pay = np;
    const gp = parseFloat(total_gross_pay);
    if (!Number.isNaN(gp)) updates.total_gross_pay = gp;
    if (bank_account_number.trim()) updates.bank_account_number = bank_account_number.trim();
    if (sort_code.trim()) updates.sort_code = sort_code.trim();
    if (payment_month.trim()) updates.payment_month = payment_month.trim();
    if (process_date.trim()) updates.process_date = process_date.trim();
    if (reference.trim()) updates.reference = reference.trim();
    onSave(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Edit Salary</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employee Name</label>
            <input type="text" value={employee_name} onChange={(e) => setEmployeeName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Net Pay</label>
              <input type="number" step="0.01" value={net_pay} onChange={(e) => setNetPay(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gross Pay</label>
              <input type="number" step="0.01" value={total_gross_pay} onChange={(e) => setTotalGrossPay(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort Code</label>
              <input type="text" value={sort_code} onChange={(e) => setSortCode(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
              <input type="text" value={bank_account_number} onChange={(e) => setBankAccount(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Month</label>
              <input type="text" value={payment_month} onChange={(e) => setPaymentMonth(e.target.value)} placeholder="e.g. January" className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Process Date</label>
              <input type="text" value={process_date} onChange={(e) => setProcessDate(e.target.value)} placeholder="YYYY-MM-DD" className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

type AuditEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown>;
  actor_name: string;
  created_at: string;
};

function AuditLogModal({ salaryId, employeeName, onClose }: { salaryId: string; employeeName: string | null; onClose: () => void }) {
  const { data: events = [] } = useSWR<AuditEvent[]>(salaryId ? `/api/salaries/${salaryId}/audit` : null, fetcher);

  const formatEvent = (e: AuditEvent) => {
    if (e.event_type === "salary_edited") {
      const changes = (e.payload?.changes as Record<string, unknown>) ?? {};
      const parts = Object.entries(changes).map(([k, v]) => `${k}: ${String(v)}`);
      return parts.join(", ");
    }
    if (e.event_type === "salary_marked_paid") return `Marked as paid`;
    if (e.event_type === "salary_extracted") return `Extracted from payslip`;
    if (e.event_type === "salary_added") return `Salary record added`;
    return e.event_type;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Change History</h2>
        <p className="mt-1 text-sm text-gray-500">{employeeName ?? "Salary"}</p>
        <ul className="mt-4 space-y-2">
          {events.length === 0 ? (
            <li className="text-sm text-gray-500">No changes recorded</li>
          ) : (
            events.map((e) => (
              <li key={e.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                <p className="text-sm font-medium">{formatEvent(e)}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {e.actor_name} · {new Date(e.created_at).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ul>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getBankDisplay(s: SalaryRow): { sortCode: string; account: string } {
  const sortCode = s.sort_code ?? s.employees?.sort_code ?? null;
  const account = s.bank_account_number ?? s.employees?.bank_account_number ?? null;
  return { sortCode: sortCode ?? "—", account: account ?? "—" };
}

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

type Profile = { role: string };

export function SalariesBoard({
  profile,
  employees,
}: {
  profile: Profile;
  employees: { id: string; full_name: string | null; badge_color: string | null }[];
}) {
  const canEdit = profile.role === "admin" || profile.role === "operations";
  const canMarkPaid = profile.role === "admin" || profile.role === "finance";

  const { data: salaries = [], mutate } = useSWR<SalaryRow[]>("/api/salaries", fetcher);
  const { data: stats } = useSWR<{ pending: { count: number; netTotal: number; costTotal: number }; paid: { count: number; netTotal: number; costTotal: number }; monthlyTrend: { month: string; count: number; netTotal: number; costTotal: number }[] }>("/api/salaries/stats", fetcher);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<SalaryRow | null>(null);
  const [addEmployeeName, setAddEmployeeName] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadEmployeeId, setUploadEmployeeId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [reExtractingId, setReExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [auditSalaryId, setAuditSalaryId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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
        if (![s.employee_name, s.reference, s.payment_month, s.ni_number, s.bank_account_number].some((v) => String(v ?? "").toLowerCase().includes(q))) return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      if (monthFilter && s.payment_month !== monthFilter) return false;
      if (yearFilter && s.payment_year !== parseInt(yearFilter, 10)) return false;
      return true;
    });
  }, [salaries, search, statusFilter, monthFilter, yearFilter]);

  const uniqueMonths = React.useMemo(() => Array.from(new Set(salaries.map((s) => s.payment_month).filter(Boolean))).sort(), [salaries]);
  const uniqueYears = React.useMemo(() => Array.from(new Set(salaries.map((s) => s.payment_year).filter(Boolean))).sort((a, b) => (b ?? 0) - (a ?? 0)), [salaries]);

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
    if (uploadFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of uploadFiles) formData.append("file", f);
      if (uploadEmployeeId) formData.append("employee_id", uploadEmployeeId);
      const res = await fetch("/api/salaries/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(data.bulk || data.count > 1 ? `${data.count ?? 0} payslips imported` : "Payslip uploaded and extracted");
      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadEmployeeId("");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }, [uploadFiles, uploadEmployeeId, mutate]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this salary record? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/salaries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      toast.success("Record deleted");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }, [mutate]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (monthFilter) params.set("month", monthFilter);
      if (yearFilter) params.set("year", yearFilter);
      const res = await fetch(`/api/salaries/export?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salaries-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel exported");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [statusFilter, monthFilter, yearFilter]);

  const handleSaveEdit = useCallback(async (salary: SalaryRow, updates: Record<string, unknown>) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/salaries/${salary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast.success("Updated");
      setShowEditModal(null);
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingEdit(false);
    }
  }, [mutate]);

  const handleReExtract = useCallback(async (id: string) => {
    setReExtractingId(id);
    try {
      const res = await fetch(`/api/salaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "re_extract" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Re-extraction failed");
      toast.success("Data re-extracted from payslip");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReExtractingId(null);
    }
  }, [mutate]);

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

  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const onToggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      for (const id of ids) {
        if (checked) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  }, []);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} salary record(s)? This cannot be undone.`)) return;
    setActionLoadingId("bulk");
    try {
      const errors: string[] = [];
      for (const id of Array.from(selectedIds)) {
        const res = await fetch(`/api/salaries/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) errors.push((data as { error?: string }).error ?? "Delete failed");
      }
      if (errors.length > 0) {
        toast.error(errors.join("\n"));
        return;
      }
      toast.success(`${selectedIds.size} record(s) deleted`);
      setSelectedIds(new Set());
      mutate();
    } finally {
      setActionLoadingId(null);
    }
  }, [selectedIds, mutate]);

  const bulkMoveToGroup = useCallback(async (groupKey: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setShowMoveModal(false);

    let action: string;
    if (groupKey === "pending") action = "set_pending";
    else if (groupKey === "needs_review") action = "set_needs_review";
    else if (groupKey === "paid") action = "mark_paid";
    else return;

    setActionLoadingId("bulk");
    try {
      const errors: string[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/salaries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) errors.push((data as { error?: string }).error ?? "Update failed");
      }
      if (errors.length > 0) {
        toast.error(errors.join("\n"));
        return;
      }
      toast.success(`${ids.length} record(s) moved`);
      setSelectedIds(new Set());
      mutate();
    } finally {
      setActionLoadingId(null);
    }
  }, [selectedIds, mutate]);

  const clickTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRowClick = useCallback((s: SalaryRow, e: React.MouseEvent) => {
    if (e.detail === 2) {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      if (canEdit) setShowEditModal(s);
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        setAuditSalaryId(s.id);
      }, 200);
    }
  }, [canEdit]);
  const handleRowDoubleClick = useCallback((s: SalaryRow) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    if (canEdit) setShowEditModal(s);
  }, [canEdit]);

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
          {canEdit && (
            <>
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
            </>
          )}
          <button
            onClick={handleExport}
            disabled={exporting || salaries.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {exporting ? "..." : "Export Excel"}
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border-2 border-amber-400 bg-amber-100 p-4 dark:border-amber-600 dark:bg-amber-900/50">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Pending</p>
            <p className="mt-1 text-xl font-bold text-amber-950 dark:text-amber-50">{stats.pending?.count ?? 0}</p>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Net: {fmtCurrency(stats.pending?.netTotal)}</p>
          </div>
          <div className="rounded-xl border-2 border-emerald-400 bg-emerald-100 p-4 dark:border-emerald-600 dark:bg-emerald-900/50">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Paid</p>
            <p className="mt-1 text-xl font-bold text-emerald-950 dark:text-emerald-50">{stats.paid?.count ?? 0}</p>
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Net: {fmtCurrency(stats.paid?.netTotal)}</p>
          </div>
          <div className="rounded-xl border-2 border-slate-600 bg-slate-100 p-4 dark:border-slate-500 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Total Pending Cost</p>
            <p className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">{fmtCurrency(stats.pending?.costTotal)}</p>
          </div>
          <div className="rounded-xl border-2 border-slate-600 bg-slate-100 p-4 dark:border-slate-500 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Total Paid Cost</p>
            <p className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">{fmtCurrency(stats.paid?.costTotal)}</p>
          </div>
        </div>
      )}

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
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All years</option>
          {uniqueYears.map((y) => (
            <option key={y!} value={y!}>{y}</option>
          ))}
        </select>
      </div>

      {/* Click-outside overlay: clears selection when clicking empty space */}
      {selectedIds.size > 0 && canEdit && (
        <div
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setSelectedIds(new Set())}
          aria-hidden
        />
      )}
      {/* Bulk action bar - Fixed at bottom */}
      {selectedIds.size > 0 && canEdit && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border-2 border-indigo-600 bg-indigo-50 px-4 py-3 shadow-xl dark:border-indigo-500 dark:bg-indigo-950/60" onClick={(e) => e.stopPropagation()}>
          <span className="flex items-center gap-2 text-sm font-semibold text-indigo-800 dark:text-indigo-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{selectedIds.size}</span>
            Salary selected
          </span>
          <button onClick={() => void bulkDelete()} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Delete
          </button>
          <button onClick={() => setShowMoveModal(true)} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            Move
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto rounded-lg bg-gray-300 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-100 dark:hover:bg-gray-500">
            ✕ Close
          </button>
        </div>
      )}

      {showMoveModal && (
        <BulkMoveModal
          groups={getSalaryMoveGroups(canMarkPaid)}
          onSelect={(key) => void bulkMoveToGroup(key)}
          onClose={() => setShowMoveModal(false)}
        />
      )}

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
              <div key={g.key} className={`overflow-hidden rounded-2xl border-2 ${g.color} shadow-sm`}>
                <div className={`px-5 py-3 ${g.headerBg} ${g.textColor} text-sm font-semibold`}>
                  {g.label} ({rows.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900/80">
                        {canEdit && (
                          <th className="w-10 px-2 py-3">
                            <input
                              type="checkbox"
                              checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                              onChange={(e) => onToggleAll(rows.map((r) => r.id), e.target.checked)}
                              className="h-4 w-4 rounded border-2 border-gray-400 text-indigo-600 accent-indigo-600"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Net Pay</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sort Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Account</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Reference</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Cost</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">File</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const bank = getBankDisplay(s);
                        return (
                        <tr
                          key={s.id}
                          className="group cursor-pointer border-b-2 border-gray-200 transition-colors hover:bg-amber-50/50 dark:border-gray-600 dark:hover:bg-amber-950/20"
                          onClick={(e) => handleRowClick(s, e)}
                          onDoubleClick={() => handleRowDoubleClick(s)}
                        >
                          {canEdit && (
                            <td className="whitespace-nowrap px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(s.id)}
                                onChange={() => onToggleSelect(s.id)}
                                className="h-4 w-4 rounded border-2 border-gray-400 text-indigo-600 accent-indigo-600"
                              />
                            </td>
                          )}
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className="inline-flex rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm"
                              style={{ backgroundColor: getEmployeeBadgeColor(s, nameToColor) }}
                            >
                              {s.employee_name ?? "—"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-gray-900 dark:text-gray-100">{fmtCurrency(s.net_pay)}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-800 dark:text-gray-200">{bank.sortCode}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-800 dark:text-gray-200">{bank.account}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-800 dark:text-gray-200" title={s.reference ?? undefined}>{s.reference ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-800 dark:text-gray-200">{s.payment_month ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-800 dark:text-gray-200">{s.process_date ?? "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100" title="GBP">{fmtCurrency(s.employer_total_cost)}</td>
                          <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {s.payslip_storage_path ? (
                              <div className="flex gap-2">
                                <a
                                  href={`/api/salaries/download?path=${encodeURIComponent(s.payslip_storage_path)}&view=1`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => downloadPayslip(s.payslip_storage_path!, s.employee_name ? `${s.employee_name}-payslip.pdf` : "payslip.pdf")}
                                  className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                                >
                                  Download
                                </button>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {canEdit && s.payslip_storage_path && (
                                <button
                                  onClick={() => handleReExtract(s.id)}
                                  disabled={reExtractingId === s.id}
                                  className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                                >
                                  {reExtractingId === s.id ? "..." : "Re-extract"}
                                </button>
                              )}
                              {canMarkPaid && s.status !== "paid" && (
                                <button
                                  onClick={() => handleMarkPaid(s.id)}
                                  disabled={markingPaidId === s.id || !s.net_pay}
                                  className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  {markingPaidId === s.id ? "..." : "Mark Paid"}
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => handleDelete(s.id)}
                                  disabled={deletingId === s.id}
                                  className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                                >
                                  {deletingId === s.id ? "..." : "Delete"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );})}
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

      {showEditModal && (
        <EditSalaryModal
          salary={showEditModal}
          onSave={(updates) => handleSaveEdit(showEditModal, updates)}
          onClose={() => setShowEditModal(null)}
          saving={savingEdit}
        />
      )}

      {auditSalaryId && (
        <AuditLogModal
          salaryId={auditSalaryId}
          employeeName={salaries.find((s) => s.id === auditSalaryId)?.employee_name ?? null}
          onClose={() => setAuditSalaryId(null)}
        />
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="text-lg font-semibold">Upload Payslip</h2>
            <p className="mt-1 text-sm text-gray-500">Upload one or more PDF payslips. AI will extract salary data. You can select multiple files at once.</p>
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
              multiple
              onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
              className="mt-3 w-full text-sm"
            />
            {uploadFiles.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">{uploadFiles.length} file(s) selected</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setShowUploadModal(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={handleUpload} disabled={uploading || uploadFiles.length === 0} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50">
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
