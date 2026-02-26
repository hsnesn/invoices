"use client";

import React, { useState, useCallback, useEffect } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "./EmptyState";
import { BulkMoveModal, type MoveGroup } from "./BulkMoveModal";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data;
};

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
  updated_at?: string;
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

const SALARY_COLUMNS = [
  { key: "employee", label: "Employee" },
  { key: "net_pay", label: "Net Pay" },
  { key: "sort_code", label: "Sort Code" },
  { key: "account", label: "Account" },
  { key: "reference", label: "Reference" },
  { key: "month", label: "Month" },
  { key: "date", label: "Date" },
  { key: "total_cost", label: "Total Cost" },
  { key: "file", label: "File" },
  { key: "actions", label: "Actions" },
] as const;
const DEFAULT_VISIBLE_COLUMNS = SALARY_COLUMNS.map((c) => c.key);
const COL_STORAGE_KEY = "salaries_visible_columns";

function getRowTooltip(s: SalaryRow, bank: { sortCode: string; account: string }): string {
  const parts = [
    `Net Pay: ${fmtCurrency(s.net_pay)}`,
    `Reference: ${s.reference ?? "—"}`,
    `Sort Code: ${bank.sortCode}`,
    `Account: ${bank.account}`,
    `Month: ${s.payment_month ?? "—"} ${s.payment_year ?? ""}`,
  ];
  return parts.join(" • ");
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Edit salary" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Edit Salary</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="edit-employee-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employee Name</label>
            <input id="edit-employee-name" type="text" value={employee_name} onChange={(e) => setEmployeeName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-net-pay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Net Pay</label>
              <input id="edit-net-pay" type="number" step="0.01" value={net_pay} onChange={(e) => setNetPay(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="edit-gross-pay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gross Pay</label>
              <input id="edit-gross-pay" type="number" step="0.01" value={total_gross_pay} onChange={(e) => setTotalGrossPay(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-sort-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort Code</label>
              <input id="edit-sort-code" type="text" value={sort_code} onChange={(e) => setSortCode(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="edit-account-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
              <input id="edit-account-number" type="text" value={bank_account_number} onChange={(e) => setBankAccount(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-payment-month" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Month</label>
              <input id="edit-payment-month" type="text" value={payment_month} onChange={(e) => setPaymentMonth(e.target.value)} placeholder="e.g. January" className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label htmlFor="edit-process-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Process Date</label>
              <input id="edit-process-date" type="text" value={process_date} onChange={(e) => setProcessDate(e.target.value)} placeholder="YYYY-MM-DD" className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div>
            <label htmlFor="edit-reference" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference</label>
            <input id="edit-reference" type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-700 dark:text-white" />
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

  const { data: salariesRaw, error: salariesError, mutate } = useSWR<SalaryRow[] | { error?: string }>("/api/salaries", fetcher);
  const { data: stats, error: statsError, mutate: mutateStats } = useSWR<{ pending: { count: number; netTotal: number; costTotal: number }; paid: { count: number; netTotal: number; costTotal: number }; monthlyTrend: { month: string; count: number; netTotal: number; costTotal: number }[] }>("/api/salaries/stats", fetcher);

  const salaries = Array.isArray(salariesRaw) ? salariesRaw : [];
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [sortField, setSortField] = useState<"date" | "net_pay" | "employee">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [urlSynced, setUrlSynced] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  useEffect(() => {
    try {
      const s = localStorage.getItem(COL_STORAGE_KEY);
      if (s) {
        const parsed = JSON.parse(s) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) setVisibleColumns(parsed);
      }
    } catch {}
  }, []);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<SalaryRow | null>(null);
  const [addEmployeeName, setAddEmployeeName] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadEmployeeId, setUploadEmployeeId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reExtractingId, setReExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [auditSalaryId, setAuditSalaryId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewSalary, setPreviewSalary] = useState<SalaryRow | null>(null);
  const previewShowRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewHideRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (nameFilter && (s.employee_name ?? "").toLowerCase() !== nameFilter.toLowerCase()) return false;
      return true;
    });
  }, [salaries, search, statusFilter, monthFilter, yearFilter, nameFilter]);

  const sortedRows = React.useMemo(() => {
    const arr = [...filtered];
    const mult = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sortField === "date") {
        const da = a.paid_date || a.process_date || a.created_at || "";
        const db = b.paid_date || b.process_date || b.created_at || "";
        return mult * (da.localeCompare(db) || 0);
      }
      if (sortField === "net_pay") {
        const na = a.net_pay ?? 0;
        const nb = b.net_pay ?? 0;
        return mult * (na - nb);
      }
      if (sortField === "employee") {
        const ea = (a.employee_name ?? "").toLowerCase();
        const eb = (b.employee_name ?? "").toLowerCase();
        return mult * ea.localeCompare(eb);
      }
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = React.useMemo(
    () => sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [sortedRows, currentPage, pageSize]
  );

  const filteredSummary = React.useMemo(() => {
    const pending = filtered.filter((s) => statusToGroup(s.status) !== "paid");
    const paid = filtered.filter((s) => s.status === "paid");
    const netTotal = filtered.reduce((sum, s) => sum + (s.net_pay ?? 0), 0);
    const pendingNet = pending.reduce((sum, s) => sum + (s.net_pay ?? 0), 0);
    const costTotal = filtered.reduce((sum, s) => sum + (s.employer_total_cost ?? 0), 0);
    const pendingCost = pending.reduce((sum, s) => sum + (s.employer_total_cost ?? 0), 0);
    return { netTotal, pendingNet, costTotal, pendingCost, pendingCount: pending.length, paidCount: paid.length };
  }, [filtered]);

  const duplicateIds = React.useMemo(() => {
    const key = (s: SalaryRow) => `${(s.employee_name ?? "").toLowerCase()}|${s.payment_month ?? ""}|${s.payment_year ?? ""}`;
    const byKey = new Map<string, string[]>();
    for (const s of salaries) {
      const k = key(s);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(s.id);
    }
    const dupeIds = new Set<string>();
    byKey.forEach((ids) => {
      if (ids.length > 1) ids.forEach((id) => dupeIds.add(id));
    });
    return dupeIds;
  }, [salaries]);

  useEffect(() => {
    let disposed = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (disposed) return;
        const supabase = createClient();
        sub = supabase.channel("salaries-rt").on("postgres_changes", { event: "*", schema: "public", table: "salaries" }, () => {
          if (!disposed) {
            void mutate();
            void mutateStats();
          }
        }).subscribe();
      } catch { /* realtime not critical */ }
    })();
    return () => { disposed = true; sub?.unsubscribe(); };
  }, [mutate, mutateStats]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isCol = (key: string) => visibleColumns.includes(key);

  const uniqueMonths = React.useMemo(() => Array.from(new Set(salaries.map((s) => s.payment_month).filter(Boolean))).sort(), [salaries]);
  const uniqueYears = React.useMemo(() => Array.from(new Set(salaries.map((s) => s.payment_year).filter(Boolean))).sort((a, b) => (b ?? 0) - (a ?? 0)), [salaries]);
  const uniqueEmployeeNames = React.useMemo(() => Array.from(new Set(salaries.map((s) => s.employee_name).filter(Boolean))).sort((a, b) => String(a ?? "").localeCompare(String(b ?? ""))), [salaries]);

  const filterCount = [search, statusFilter, monthFilter, yearFilter, nameFilter].filter(Boolean).length;
  const hasActiveFilters = filterCount > 0;
  const clearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    setMonthFilter("");
    setYearFilter("");
    setNameFilter("");
  }, []);

  const applyPreset = useCallback((preset: "this_month" | "pending" | "paid") => {
    const now = new Date();
    const thisMonth = MONTH_NAMES[now.getMonth()];
    const thisYear = String(now.getFullYear());
    if (preset === "this_month") {
      setMonthFilter(thisMonth);
      setYearFilter(thisYear);
      setStatusFilter("");
      setSearch("");
      setNameFilter("");
    } else if (preset === "pending") {
      setStatusFilter("pending");
      setMonthFilter("");
      setYearFilter("");
      setSearch("");
      setNameFilter("");
    } else if (preset === "paid") {
      setStatusFilter("paid");
      setMonthFilter("");
      setYearFilter("");
      setSearch("");
      setNameFilter("");
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    const status = searchParams.get("status");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const name = searchParams.get("name");
    if (q != null) setSearch(q);
    if (status != null) setStatusFilter(status);
    if (month != null) setMonthFilter(month);
    if (year != null) setYearFilter(year);
    if (name != null) setNameFilter(name);
    setUrlSynced(true);
  }, []);

  useEffect(() => {
    if (!urlSynced) return;
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    if (monthFilter) params.set("month", monthFilter);
    if (yearFilter) params.set("year", yearFilter);
    if (nameFilter) params.set("name", nameFilter);
    const qs = params.toString();
    const url = qs ? `/salaries?${qs}` : "/salaries";
    window.history.replaceState(null, "", url);
  }, [urlSynced, search, statusFilter, monthFilter, yearFilter, nameFilter]);

  useEffect(() => {
    setCurrentPage(0);
  }, [search, statusFilter, monthFilter, yearFilter, nameFilter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (hasActiveFilters) clearFilters();
        else if (focusedRowId) setFocusedRowId(null);
        return;
      }
      const flatRows = sortedRows;
      const idx = focusedRowId ? flatRows.findIndex((r) => r.id === focusedRowId) : -1;
      if (e.key === "ArrowDown" && idx < flatRows.length - 1) {
        e.preventDefault();
        setFocusedRowId(flatRows[idx + 1].id);
      } else if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        setFocusedRowId(flatRows[idx - 1].id);
      } else if (e.key === "Enter" && focusedRowId && canEdit) {
        e.preventDefault();
        const row = flatRows.find((r) => r.id === focusedRowId);
        if (row) setShowEditModal(row);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasActiveFilters, clearFilters, focusedRowId, sortedRows, canEdit]);

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

  const handleExportExcel = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (monthFilter) params.set("month", monthFilter);
      if (yearFilter) params.set("year", yearFilter);
      if (nameFilter) params.set("name", nameFilter);
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
  }, [statusFilter, monthFilter, yearFilter, nameFilter]);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      doc.setFontSize(14);
      doc.text("Salary Report", 14, 15);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")} | ${filtered.length} records`, 14, 20);
      const bank = (s: SalaryRow) => getBankDisplay(s);
      autoTable(doc, {
        startY: 25,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        head: [["Employee", "Net Pay", "Sort Code", "Account", "Reference", "Month", "Date"]],
        body: filtered.map((s) => {
          const b = bank(s);
          return [
            s.employee_name ?? "—",
            fmtCurrency(s.net_pay),
            b.sortCode,
            b.account,
            s.reference ?? "—",
            s.payment_month ?? "—",
            s.paid_date ?? s.process_date ?? "—",
          ];
        }),
      });
      doc.save(`salaries-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exported");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }, [filtered]);

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

  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (previewSalary) { setPreviewSalary(null); return; }
      if (showEditModal) { setShowEditModal(null); return; }
      if (rejectModalId) { setRejectModalId(null); return; }
      if (auditSalaryId) { setAuditSalaryId(null); return; }
      if (showUploadModal) { setShowUploadModal(false); return; }
      if (showAddModal) { setShowAddModal(false); return; }
      if (showMoveModal) { setShowMoveModal(false); return; }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [previewSalary, showEditModal, rejectModalId, auditSalaryId, showUploadModal, showAddModal, showMoveModal]);

  const handleReject = useCallback(async (id: string, reason: string) => {
    if (!reason?.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setRejectingId(id);
    try {
      const res = await fetch(`/api/salaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_needs_review", rejection_reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reject");
      toast.success("Moved to Needs Review.");
      mutate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRejectingId(null);
      setRejectModalId(null);
      setRejectReason("");
    }
  }, [mutate]);

  const openRejectModal = useCallback((id: string) => {
    setRejectModalId(id);
    setRejectReason("");
  }, []);

  const submitReject = useCallback(() => {
    if (rejectModalId) handleReject(rejectModalId, rejectReason);
  }, [rejectModalId, rejectReason, handleReject]);

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
      toast.success(`${selectedIds.size} salar${selectedIds.size === 1 ? "y" : "ies"} deleted`);
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
      const groupLabel = groupKey === "paid" ? "Paid" : groupKey === "pending" ? "Pending" : "Needs Review";
      toast.success(`${ids.length} salar${ids.length === 1 ? "y" : "ies"} moved to ${groupLabel}`);
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

  const showPreview = useCallback((s: SalaryRow) => {
    if (previewHideRef.current) {
      clearTimeout(previewHideRef.current);
      previewHideRef.current = null;
    }
    if (previewShowRef.current) clearTimeout(previewShowRef.current);
    previewShowRef.current = setTimeout(() => {
      if (s.payslip_storage_path) setPreviewSalary(s);
      previewShowRef.current = null;
    }, 400);
  }, []);

  const hidePreview = useCallback(() => {
    if (previewShowRef.current) {
      clearTimeout(previewShowRef.current);
      previewShowRef.current = null;
    }
    if (previewHideRef.current) clearTimeout(previewHideRef.current);
    previewHideRef.current = setTimeout(() => {
      setPreviewSalary(null);
      previewHideRef.current = null;
    }, 200);
  }, []);

  const cancelHidePreview = useCallback(() => {
    if (previewHideRef.current) {
      clearTimeout(previewHideRef.current);
      previewHideRef.current = null;
    }
  }, []);

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

  if (salariesError || statsError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950/30">
        <p className="font-medium text-red-800 dark:text-red-200">
          {(salariesError ?? statsError)?.message ?? "Failed to load data"}
        </p>
        <button
          onClick={() => void mutate()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Try again
        </button>
      </div>
    );
  }

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
            onClick={() => void handleExportExcel()}
            disabled={exporting || salaries.length === 0}
            title={filtered.length > 0 ? `Export ${filtered.length} record(s) to Excel` : "Export Excel"}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {exporting ? "..." : `Export Excel${filtered.length > 0 ? ` (${filtered.length})` : ""}`}
          </button>
          <button
            onClick={() => void handleExportPdf()}
            disabled={exporting || filtered.length === 0}
            title={filtered.length > 0 ? `Export ${filtered.length} record(s) to PDF` : "Export PDF"}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {exporting ? "..." : `Export PDF${filtered.length > 0 ? ` (${filtered.length})` : ""}`}
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

      {hasActiveFilters && filtered.length > 0 && (
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Filtered summary</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span>Net: {fmtCurrency(filteredSummary.netTotal)}</span>
            <span>Pending cost: {fmtCurrency(filteredSummary.pendingCost)}</span>
            <span>{filteredSummary.pendingCount} pending • {filteredSummary.paidCount} paid</span>
          </div>
        </div>
      )}

      {duplicateIds.size > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Duplicate detection</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Found {duplicateIds.size} salary record(s) with same employee + month + year. Please review.</p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Presets:</span>
          <button onClick={() => applyPreset("this_month")} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">This month</button>
          <button onClick={() => applyPreset("pending")} className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-800">Pending</button>
          <button onClick={() => applyPreset("paid")} className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:hover:bg-emerald-800">Paid</button>
          <span className="mx-1 text-slate-300 dark:text-slate-500">|</span>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-40 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="needs_review">Needs Review</option>
            <option value="paid">Paid</option>
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">All months</option>
            {uniqueMonths.map((m) => <option key={m!} value={m!}>{m}</option>)}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">All years</option>
            {uniqueYears.map((y) => <option key={y!} value={y!}>{y}</option>)}
          </select>
          <select value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="">All employees</option>
            {uniqueEmployeeNames.map((n) => <option key={n!} value={n!}>{n}</option>)}
          </select>
          <select value={sortField} onChange={(e) => setSortField(e.target.value as typeof sortField)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="date">Sort: Date</option>
            <option value="net_pay">Sort: Net Pay</option>
            <option value="employee">Sort: Employee</option>
          </select>
          <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" title={sortDir === "asc" ? "Ascending" : "Descending"}>
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
          {hasActiveFilters && (
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              {filterCount} filter{filterCount !== 1 ? "s" : ""} active
            </span>
          )}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
              Clear filters
            </button>
          )}
          <button
            onClick={(e) => { setShowColumnPicker((p) => !p); (e.target as HTMLElement).getBoundingClientRect(); }}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            Columns
          </button>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value={25}>25/page</option>
            <option value={50}>50/page</option>
            <option value={100}>100/page</option>
          </select>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0} className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-600">←</button>
            <span className="text-xs text-gray-500">Page {currentPage + 1} of {totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1} className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-600">→</button>
          </div>
          <span className="text-xs text-gray-500">{filtered.length} of {salaries.length}</span>
        </div>
        {showColumnPicker && (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-gray-100 pt-2 dark:border-gray-600">
            <span className="text-xs font-medium text-gray-500">Toggle columns:</span>
            {SALARY_COLUMNS.filter((c) => c.key !== "actions").map((c) => (
              <label key={c.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={() => toggleColumn(c.key)} className="rounded" />
                {c.label}
              </label>
            ))}
            <button onClick={() => { setVisibleColumns([...DEFAULT_VISIBLE_COLUMNS]); localStorage.removeItem(COL_STORAGE_KEY); }} className="text-xs text-gray-600 hover:underline dark:text-gray-400">Reset</button>
          </div>
        )}
        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2 dark:border-gray-600">
            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                &quot;{search}&quot;
                <button onClick={() => setSearch("")} className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100">✕</button>
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {statusFilter}
                <button onClick={() => setStatusFilter("")} className="ml-0.5 hover:text-amber-900 dark:hover:text-amber-100">✕</button>
              </span>
            )}
            {monthFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {monthFilter}
                <button onClick={() => setMonthFilter("")} className="ml-0.5 hover:text-emerald-900 dark:hover:text-emerald-100">✕</button>
              </span>
            )}
            {yearFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {yearFilter}
                <button onClick={() => setYearFilter("")} className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-100">✕</button>
              </span>
            )}
            {nameFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                {nameFilter}
                <button onClick={() => setNameFilter("")} className="ml-0.5 hover:text-teal-900 dark:hover:text-teal-100">✕</button>
              </span>
            )}
            <button onClick={clearFilters} className="ml-auto rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
              Clear all
            </button>
          </div>
        )}
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
            const rows = paginatedRows.filter((r) => statusToGroup(r.status) === g.key);
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
                        {(canEdit || canMarkPaid) && (
                          <th className="w-20 px-2 py-3">
                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <input
                                  type="checkbox"
                                  checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                                  onChange={(e) => onToggleAll(rows.map((r) => r.id), e.target.checked)}
                                  className="h-4 w-4 rounded border-2 border-gray-400 text-indigo-600 accent-indigo-600"
                                />
                              )}
                            </div>
                          </th>
                        )}
                        {isCol("employee") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Employee</th>}
                        {isCol("net_pay") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Net Pay</th>}
                        {isCol("sort_code") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sort Code</th>}
                        {isCol("account") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Account</th>}
                        {isCol("reference") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Reference</th>}
                        {isCol("month") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month</th>}
                        {isCol("date") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</th>}
                        {isCol("total_cost") && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Cost</th>}
                        {isCol("file") && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">File</th>}
                        {isCol("actions") && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => {
                        const bank = getBankDisplay(s);
                        const isFocused = focusedRowId === s.id;
                        const isDupe = duplicateIds.has(s.id);
                        return (
                        <tr
                          key={s.id}
                          title={getRowTooltip(s, bank)}
                          tabIndex={0}
                          onFocus={() => setFocusedRowId(s.id)}
                          className={`group cursor-pointer border-b-2 border-gray-200 transition-colors hover:bg-amber-50/50 dark:border-gray-600 dark:hover:bg-amber-950/20 ${isFocused ? "ring-2 ring-indigo-500 ring-inset bg-amber-50/80 dark:bg-amber-950/30" : ""} ${isDupe ? "border-l-4 border-l-amber-500" : ""}`}
                          onClick={(e) => handleRowClick(s, e)}
                          onDoubleClick={() => handleRowDoubleClick(s)}
                        >
                          {(canEdit || canMarkPaid) && (
                            <td className="whitespace-nowrap px-2 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(s.id)}
                                    onChange={() => onToggleSelect(s.id)}
                                    className="h-4 w-4 rounded border-2 border-gray-400 text-indigo-600 accent-indigo-600"
                                  />
                                )}
                                {canMarkPaid && s.status !== "paid" && (
                                  <>
                                    <button
                                      onClick={() => handleMarkPaid(s.id)}
                                      disabled={markingPaidId === s.id || !s.net_pay}
                                      title={s.net_pay ? `Net Pay: ${fmtCurrency(s.net_pay)} — Click to mark paid` : "Mark as paid"}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                                    >
                                      {markingPaidId === s.id ? "…" : "£"}
                                    </button>
                                    <button
                                      onClick={() => openRejectModal(s.id)}
                                      disabled={rejectingId === s.id}
                                      title="Reject (reason required)"
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                                    >
                                      {rejectingId === s.id ? "…" : "✗"}
                                    </button>
                                  </>
                                )}
                                {canMarkPaid && s.status === "paid" && (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold" title="Paid">✓</span>
                                )}
                              </div>
                            </td>
                          )}
                          {isCol("employee") && (
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className="inline-flex rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm"
                              style={{ backgroundColor: getEmployeeBadgeColor(s, nameToColor) }}
                            >
                              {s.employee_name ?? "—"}
                            </span>
                          </td>
                          )}
                          {isCol("net_pay") && (
                          <td
                            className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-gray-900 dark:text-gray-100 cursor-pointer"
                            onMouseEnter={() => showPreview(s)}
                            onMouseLeave={hidePreview}
                            title="Hover to preview payslip"
                          >
                            {fmtCurrency(s.net_pay)}
                          </td>
                          )}
                          {isCol("sort_code") && <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-800 dark:text-gray-200">{bank.sortCode}</td>}
                          {isCol("account") && <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-800 dark:text-gray-200">{bank.account}</td>}
                          {isCol("reference") && <td className="whitespace-nowrap px-4 py-3 text-gray-800 dark:text-gray-200" title={s.reference ?? undefined}>{s.reference ?? "—"}</td>}
                          {isCol("month") && <td className="whitespace-nowrap px-4 py-3 text-gray-800 dark:text-gray-200">{s.payment_month ?? "—"}</td>}
                          {isCol("date") && <td className="whitespace-nowrap px-4 py-3 text-gray-800 dark:text-gray-200">{s.process_date ?? "—"}</td>}
                          {isCol("total_cost") && <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100" title="GBP">{fmtCurrency(s.employer_total_cost)}</td>}
                          {isCol("file") && (
                          <td
                            className="whitespace-nowrap px-4 py-3 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={() => showPreview(s)}
                            onMouseLeave={hidePreview}
                            title="Hover to preview payslip"
                          >
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
                          )}
                          {isCol("actions") && (
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
                          )}
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

      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Reject payment" onClick={() => setRejectModalId(null)}>
          <div
            className="mx-4 w-full max-w-md rounded-xl border-2 border-gray-300 bg-white p-6 shadow-xl dark:border-gray-600 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Reject Payment</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Rejection reason is required.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRejectModalId(null); setRejectReason(""); }}
                className="rounded-lg border-2 border-gray-400 px-4 py-2 font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || rejectingId === rejectModalId}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {rejectingId === rejectModalId ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {auditSalaryId && (
        <AuditLogModal
          salaryId={auditSalaryId}
          employeeName={salaries.find((s) => s.id === auditSalaryId)?.employee_name ?? null}
          onClose={() => setAuditSalaryId(null)}
        />
      )}

      {previewSalary?.payslip_storage_path && (
        <div
          className="fixed left-4 top-24 z-50 flex w-[420px] flex-col rounded-xl border-2 border-gray-300 bg-white shadow-2xl sm:left-[420px] dark:border-gray-600 dark:bg-gray-900"
          onMouseEnter={cancelHidePreview}
          onMouseLeave={hidePreview}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
              {previewSalary.employee_name ?? "Payslip"} — {fmtCurrency(previewSalary.net_pay)}
            </span>
            <div className="flex gap-1">
              <a
                href={`/api/salaries/download?path=${encodeURIComponent(previewSalary.payslip_storage_path)}&view=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
              >
                Open
              </a>
              <button
                onClick={() => setPreviewSalary(null)}
                className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="h-[500px] overflow-hidden">
            <iframe
              src={`/api/salaries/download?path=${encodeURIComponent(previewSalary.payslip_storage_path)}&view=1`}
              className="h-full w-full border-0"
              title="Payslip preview"
            />
          </div>
        </div>
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
