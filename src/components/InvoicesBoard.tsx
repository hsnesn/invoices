"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

const DashboardSection = lazy(() => import("./InvoiceDashboard").then((m) => ({ default: m.InvoiceDashboard })));

type InvoiceRow = {
  id: string;
  submitter_user_id: string;
  service_description: string | null;
  currency: string;
  created_at: string;
  service_date_from: string | null;
  service_date_to: string | null;
  department_id: string | null;
  program_id: string | null;
  previous_invoice_id: string | null;
  invoice_workflows: {
    status: string;
    rejection_reason: string | null;
    manager_user_id: string | null;
    paid_date: string | null;
  }[] | null;
  invoice_extracted_fields: {
    invoice_number: string | null;
    beneficiary_name: string | null;
    account_number: string | null;
    sort_code: string | null;
    gross_amount: number | null;
    extracted_currency: string | null;
    raw_json?: Record<string, unknown> | null;
  }[] | null;
};

type DisplayRow = {
  id: string;
  submitterId: string;
  guest: string;
  title: string;
  producer: string;
  paymentType: string;
  department: string;
  departmentId: string;
  programme: string;
  programmeId: string;
  topic: string;
  tx1: string;
  tx2: string;
  tx3: string;
  invoiceDate: string;
  accountName: string;
  amount: string;
  invNumber: string;
  sortCode: string;
  accountNumber: string;
  lineManager: string;
  lineManagerId: string;
  paymentDate: string;
  status: string;
  rejectionReason: string;
  createdAt: string;
  group: "pending_line_manager" | "ready_for_payment" | "paid_invoices" | "no_payment_needed" | "rejected";
};

type TimelineEvent = {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown> | null;
  actor_name: string;
  created_at: string;
};

type NoteItem = {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
};

type SavedFilter = {
  name: string;
  filters: {
    search: string;
    departmentFilter: string;
    programmeFilter: string;
    groupFilter: string;
    producerFilter: string;
    paymentTypeFilter: string;
    managerFilter: string;
    dateFrom: string;
    dateTo: string;
    sortField: string;
    sortDir: string;
  };
};

const ALL_COLUMNS = [
  { key: "checkbox", label: "" },
  { key: "status", label: "✓" },
  { key: "guest", label: "Guest Name" },
  { key: "title", label: "Title" },
  { key: "producer", label: "Producer" },
  { key: "paymentType", label: "Payment Type" },
  { key: "department", label: "Department" },
  { key: "programme", label: "Programme Name" },
  { key: "topic", label: "Topic" },
  { key: "tx1", label: "TX Date" },
  { key: "tx2", label: "2. TX Date" },
  { key: "tx3", label: "3. TX Date" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "file", label: "Invoice File" },
  { key: "accountName", label: "Account Name" },
  { key: "amount", label: "Amount" },
  { key: "invNumber", label: "INV Number" },
  { key: "sortCode", label: "Sort Code" },
  { key: "accountNumber", label: "Account Number" },
  { key: "lineManager", label: "Line Manager" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "actions", label: "Actions" },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.map((c) => c.key);

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch { /* */ }
  return fallback;
}

const RECENT_FILTERS_KEY = "invoice_recent_filters";
const RECENT_MAX = 5;

function pushRecentFilter(filters: SavedFilter["filters"]) {
  try {
    const recent = loadFromStorage<SavedFilter["filters"][]>(RECENT_FILTERS_KEY, []);
    const key = JSON.stringify(filters);
    const filtered = recent.filter((r) => JSON.stringify(r) !== key);
    const next = [filters, ...filtered].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_FILTERS_KEY, JSON.stringify(next));
  } catch { /* */ }
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

type EditDraft = {
  guest: string;
  title: string;
  producer: string;
  paymentType: string;
  departmentId: string;
  programmeId: string;
  topic: string;
  tx1: string;
  tx2: string;
  tx3: string;
  invoiceDate: string;
  accountName: string;
  amount: string;
  invNumber: string;
  sortCode: string;
  accountNumber: string;
  lineManagerId: string;
};

function programmeBadgeClass(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("newsmaker")) return "bg-teal-200 text-teal-900 border border-teal-400 dark:bg-teal-800 dark:text-teal-100 dark:border-teal-600";
  if (v.includes("roundtable")) return "bg-amber-200 text-amber-900 border border-amber-400 dark:bg-amber-800 dark:text-amber-100 dark:border-amber-600";
  if (v.includes("bigger")) return "bg-sky-200 text-sky-900 border border-sky-400 dark:bg-sky-800 dark:text-sky-100 dark:border-sky-600";
  if (v.includes("haber") || v.includes("news")) return "bg-rose-200 text-rose-900 border border-rose-400 dark:bg-rose-800 dark:text-rose-100 dark:border-rose-600";
  if (v.includes("strait")) return "bg-violet-200 text-violet-900 border border-violet-400 dark:bg-violet-800 dark:text-violet-100 dark:border-violet-600";
  return "bg-emerald-200 text-emerald-900 border border-emerald-400 dark:bg-emerald-800 dark:text-emerald-100 dark:border-emerald-600";
}

function paymentTypeBadge(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("unpaid")) return "bg-slate-300 text-slate-800 border border-slate-500 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500";
  return "bg-emerald-600 text-white border-0 shadow-md font-semibold";
}

function producerColor(name: string): string {
  const colors = [
    "bg-rose-400", "bg-violet-400", "bg-sky-400", "bg-teal-400",
    "bg-amber-400", "bg-fuchsia-400", "bg-indigo-400", "bg-emerald-400",
    "bg-pink-400", "bg-cyan-400", "bg-blue-400", "bg-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function sectionColor(group: DisplayRow["group"]): string {
  if (group === "pending_line_manager") return "text-amber-700 dark:text-amber-300";
  if (group === "ready_for_payment") return "text-sky-700 dark:text-sky-300";
  if (group === "paid_invoices") return "text-emerald-700 dark:text-emerald-300";
  if (group === "rejected") return "text-rose-700 dark:text-rose-300";
  return "text-slate-600 dark:text-slate-400";
}

function parseServiceDescription(value: string | null): Record<string, string> {
  if (!value) return {};
  const out: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const sep = l.includes(":") ? ":" : l.includes("-") ? "-" : null;
    if (!sep) continue;
    const idx = l.indexOf(sep);
    if (idx === -1) continue;
    const key = l
      .slice(0, idx)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const val = l.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = val;
  }
  return out;
}

function fromAliases(
  meta: Record<string, string>,
  aliases: string[],
  fallback = "—"
): string {
  for (const key of aliases) {
    const v = meta[key];
    if (v && v.trim()) return v.trim();
  }
  return fallback;
}

function normalizeInvoiceNumber(value: string): string {
  return value.replace(/\.[^.]+$/, "").trim();
}

function calcGroup(status: string, paymentType: string): DisplayRow["group"] {
  if (status === "rejected") return "rejected";
  if (paymentType === "unpaid guest" || paymentType === "unpaid_guest") return "no_payment_needed";
  if (status === "paid" || status === "archived") return "paid_invoices";
  if (status === "approved_by_manager" || status === "pending_admin" || status === "ready_for_payment") {
    return "ready_for_payment";
  }
  return "pending_line_manager";
}

function sectionTitle(group: DisplayRow["group"]): string {
  if (group === "pending_line_manager") return "Pending Line Manager Approval";
  if (group === "ready_for_payment") return "Ready For Payment";
  if (group === "paid_invoices") return "Paid Invoices";
  if (group === "rejected") return "Rejected Invoices";
  return "No Payment Needed";
}

function InvoiceTable({
  rows,
  currentRole,
  currentUserId,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onManagerApprove,
  onRejectInvoice,
  onResubmit,
  onMarkPaid,
  onDeleteInvoice,
  onReplaceFile,
  openPdf,
  editingId,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
  onSaveEdit,
  actionLoadingId,
  visibleColumns,
  expandedRowId,
  onToggleExpand,
  timelineData,
  notesData,
  newNote,
  onNewNoteChange,
  onAddNote,
  detailLoading,
  duplicates,
  pageSize,
  currentPage,
  onPageChange,
  departmentPairs,
  programPairs,
  profilePairs,
  managerProfilePairs,
}: {
  rows: DisplayRow[];
  currentRole: string;
  currentUserId: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onManagerApprove: (id: string) => Promise<void>;
  onRejectInvoice: (id: string) => Promise<void>;
  onResubmit: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onDeleteInvoice: (id: string) => Promise<void>;
  onReplaceFile: (id: string, file: File) => Promise<void>;
  openPdf: (id: string) => Promise<void>;
  editingId: string | null;
  editDraft: EditDraft | null;
  onStartEdit: (row: DisplayRow) => void;
  onCancelEdit: () => void;
  onChangeDraft: (key: keyof EditDraft, value: string) => void;
  onSaveEdit: (id: string) => Promise<void>;
  actionLoadingId: string | null;
  visibleColumns: string[];
  expandedRowId: string | null;
  onToggleExpand: (id: string) => void;
  timelineData: TimelineEvent[];
  notesData: NoteItem[];
  newNote: string;
  onNewNoteChange: (v: string) => void;
  onAddNote: () => void;
  detailLoading: boolean;
  duplicates: Set<string>;
  pageSize: number;
  currentPage: number;
  onPageChange: (p: number) => void;
  departmentPairs: [string, string][];
  programPairs: [string, string][];
  profilePairs: [string, string][];
  managerProfilePairs?: [string, string][];
}) {
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const colCount = visibleColumns.length;

  const isCol = (key: string) => visibleColumns.includes(key);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRowClick = useCallback((id: string) => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { onToggleExpand(id); clickTimerRef.current = null; }, 250);
  }, [onToggleExpand]);
  const handleRowDblClick = useCallback(() => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
  }, []);

  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <table className="min-w-[2800px] divide-y divide-slate-200 dark:divide-slate-600">
        <thead className="bg-slate-100 dark:bg-slate-700">
          <tr>
            {isCol("checkbox") && (
            <th className="px-2 py-3 text-center w-10">
              <input
                type="checkbox"
                checked={paginatedRows.length > 0 && paginatedRows.every((r) => selectedIds.has(r.id))}
                onChange={(e) => onToggleAll(paginatedRows.map((r) => r.id), e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            )}
            {ALL_COLUMNS.filter((c) => c.key !== "checkbox" && isCol(c.key)).map((c) => (
              <th
                key={c.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-slate-50 dark:divide-slate-600 dark:bg-slate-800">
          {paginatedRows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-6 text-center text-sm text-gray-400">
                No rows in this group.
              </td>
            </tr>
          ) : (
            paginatedRows.map((r) => {
              const isSubmitter = r.submitterId === currentUserId;
              const canApprove = currentRole === "admin" || (!isSubmitter && currentRole === "manager");
              const isDuplicate = duplicates.has(r.id);
              const pendingDays = (r.status === "pending_manager" || r.status === "submitted") ? daysSince(r.createdAt) : 0;
              const canEditRow = currentRole === "admin" || currentRole === "manager" || (isSubmitter && ["submitted", "pending_manager", "rejected"].includes(r.status));
              const editableTdClass = canEditRow && editingId !== r.id ? " cursor-text hover:bg-blue-50/60 dark:hover:bg-blue-950/20" : "";
              const startEditOnDblClick = (e: React.MouseEvent) => { if (canEditRow && editingId !== r.id) { e.stopPropagation(); e.preventDefault(); handleRowDblClick(); onStartEdit(r); } };
              return (
              <React.Fragment key={r.id}>
              <tr data-row-id={r.id} className={`${r.status === "rejected" ? "bg-rose-200 hover:bg-rose-300 dark:bg-rose-900/50 dark:hover:bg-rose-900/70" : isDuplicate ? "bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900/70" : editingId === r.id ? "bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-400 ring-inset" : "hover:bg-slate-100 dark:hover:bg-slate-700/80"} transition-colors duration-150 cursor-pointer`} onClick={() => { if (editingId !== r.id) handleRowClick(r.id); }} onDoubleClick={handleRowDblClick}>
              {isCol("checkbox") && (
              <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => onToggleSelect(r.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              )}
              {isCol("status") && (
              <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                {r.status === "pending_manager" && canApprove ? (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => void onManagerApprove(r.id)}
                      disabled={actionLoadingId === r.id}
                      title="Approve"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {actionLoadingId === r.id ? "…" : "✓"}
                    </button>
                    <button
                      onClick={() => void onRejectInvoice(r.id)}
                      disabled={actionLoadingId === r.id}
                      title="Reject"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white hover:bg-red-500 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      ✗
                    </button>
                  </div>
                ) : r.status === "rejected" ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm" title={r.rejectionReason || "Rejected"}>✗</span>
                    {(r.submitterId === currentUserId || currentRole === "admin") && (
                      <button
                        onClick={() => void onResubmit(r.id)}
                        disabled={actionLoadingId === r.id}
                        title="Resubmit for approval"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm text-sm"
                      >
                        {actionLoadingId === r.id ? "…" : "↻"}
                      </button>
                    )}
                  </div>
                ) : r.status === "ready_for_payment" && (currentRole === "admin" || currentRole === "finance") ? (
                  <button
                    onClick={() => void onMarkPaid(r.id)}
                    disabled={actionLoadingId === r.id}
                    title="Mark as paid"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition-all duration-200 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-500"
                  >
                    {actionLoadingId === r.id ? "…" : "₺"}
                  </button>
                ) : r.status === "paid" || r.status === "archived" ? (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm" title="Paid">✓</span>
                ) : r.status === "ready_for_payment" ? (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm" title="Approved">✓</span>
                ) : (
                  <div className="flex items-center justify-center gap-1">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm dark:bg-amber-900/40 dark:text-amber-300" title="Pending">○</span>
                    {pendingDays >= 3 && (
                      <span className={`text-[9px] font-bold ${pendingDays >= 7 ? "text-red-600" : "text-orange-500"}`} title={`Pending for ${pendingDays} days`}>
                        {pendingDays}d
                      </span>
                    )}
                  </div>
                )}
              {isDuplicate && <div className="mt-0.5 text-[9px] font-bold text-yellow-600" title="Possible duplicate">⚠ DUP</div>}
              </td>
              )}
              {isCol("guest") && (
              <td className={`px-4 py-3 text-sm font-medium text-gray-900${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>
                {editingId === r.id ? (
                  <input autoFocus value={editDraft?.guest ?? ""} onChange={(e) => onChangeDraft("guest", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" />
                ) : (
                  <div>
                    <span>{r.guest}</span>
                    {r.status === "rejected" && r.rejectionReason && (
                      <div className="mt-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
                        <span className="font-semibold">Rejection reason:</span> {r.rejectionReason}
                      </div>
                    )}
                  </div>
                )}
              </td>
              )}
              {isCol("title") && <td className={`px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.title ?? ""} onChange={(e) => onChangeDraft("title", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.title}</td>}
              {isCol("producer") && <td className={`px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.producer ?? ""} onChange={(e) => onChangeDraft("producer", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : <div className="group relative inline-flex items-center"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white cursor-pointer ${producerColor(r.producer)}`}>{r.producer.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2)}</span><span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">{r.producer}</span></div>}</td>}
              {isCol("paymentType") && <td className={`px-4 py-3${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <select value={editDraft?.paymentType ?? "paid guest"} onChange={(e) => onChangeDraft("paymentType", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"><option value="paid guest">Paid Guest</option><option value="unpaid guest">Unpaid Guest</option></select> : <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${paymentTypeBadge(r.paymentType)}`}>{r.paymentType.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</span>}</td>}
              {isCol("department") && <td className={`px-4 py-3${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <select value={editDraft?.departmentId ?? ""} onChange={(e) => { onChangeDraft("departmentId", e.target.value); onChangeDraft("programmeId", ""); }} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">Select...</option>{departmentPairs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select> : <span className="inline-flex rounded-full bg-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900 border-2 border-emerald-400 dark:bg-emerald-800 dark:text-emerald-100 dark:border-emerald-600">{r.department}</span>}</td>}
              {isCol("programme") && <td className={`px-4 py-3${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <select value={editDraft?.programmeId ?? ""} onChange={(e) => onChangeDraft("programmeId", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">Select...</option>{programPairs.filter(([, ]) => true).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select> : <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${programmeBadgeClass(r.programme)}`}>{r.programme}</span>}</td>}
              {isCol("topic") && <td className={`max-w-[220px] truncate px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.topic ?? ""} onChange={(e) => onChangeDraft("topic", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.topic}</td>}
              {isCol("tx1") && <td className={`px-4 py-3 text-sm text-gray-600${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input type="date" value={editDraft?.tx1 ?? ""} onChange={(e) => onChangeDraft("tx1", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.tx1}</td>}
              {isCol("tx2") && <td className={`px-4 py-3 text-sm text-gray-600${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input type="date" value={editDraft?.tx2 ?? ""} onChange={(e) => onChangeDraft("tx2", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.tx2}</td>}
              {isCol("tx3") && <td className={`px-4 py-3 text-sm text-gray-600${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input type="date" value={editDraft?.tx3 ?? ""} onChange={(e) => onChangeDraft("tx3", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.tx3}</td>}
              {isCol("invoiceDate") && <td className={`px-4 py-3 text-sm text-gray-600${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input type="date" value={editDraft?.invoiceDate ?? ""} onChange={(e) => onChangeDraft("invoiceDate", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.invoiceDate}</td>}
              {isCol("file") && <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                <button onClick={() => void openPdf(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"><svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4zM6 10h8v2H6v-2zm0 4h5v2H6v-2z"/></svg>Open</button>
                {(r.submitterId === currentUserId || currentRole === "admin" || currentRole === "manager") && (
                  <label className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-800/40">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>Replace
                    <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onReplaceFile(r.id, f); e.target.value = ""; }} />
                  </label>
                )}
                </div>
              </td>}
              {isCol("accountName") && <td className={`px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.accountName ?? ""} onChange={(e) => onChangeDraft("accountName", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.accountName}</td>}
              {isCol("amount") && <td className={`px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.amount ?? ""} onChange={(e) => onChangeDraft("amount", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.amount}</td>}
              {isCol("invNumber") && <td className={`px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.invNumber ?? ""} onChange={(e) => onChangeDraft("invNumber", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.invNumber}</td>}
              {isCol("sortCode") && <td className={`px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.sortCode ?? ""} onChange={(e) => onChangeDraft("sortCode", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.sortCode}</td>}
              {isCol("accountNumber") && <td className={`px-4 py-3 text-sm text-gray-700${editableTdClass}`} onDoubleClick={editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id ? <input value={editDraft?.accountNumber ?? ""} onChange={(e) => onChangeDraft("accountNumber", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900" /> : r.accountNumber}</td>}
              {isCol("lineManager") && <td className={`px-4 py-3 text-sm text-gray-600${currentRole === "admin" ? editableTdClass : ""}`} onDoubleClick={currentRole === "admin" && editingId !== r.id ? startEditOnDblClick : undefined}>{editingId === r.id && currentRole === "admin" ? <select value={editDraft?.lineManagerId ?? ""} onChange={(e) => onChangeDraft("lineManagerId", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">Unassigned</option>{(managerProfilePairs ?? profilePairs).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select> : r.lineManager}</td>}
              {isCol("paymentDate") && <td className="px-4 py-3 text-sm text-gray-600">{r.paymentDate}</td>}
              {isCol("actions") && <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const submitterCanEdit = isSubmitter && (r.status === "pending_manager" || r.status === "submitted");
                  const submitterCanResubmit = isSubmitter && r.status === "rejected";
                  const managerOrAdmin = currentRole === "manager" || currentRole === "admin";

                  if (editingId === r.id) {
                    return (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <svg className="h-3.5 w-3.5 animate-pulse" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
                          Editing
                        </span>
                        <button onClick={onCancelEdit} className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300" title="Discard changes (Esc)">✕</button>
                      </div>
                    );
                  }

                  if (managerOrAdmin) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onStartEdit(r)} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 shadow-sm dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50">Edit</button>
                        {r.status === "rejected" && (
                          <button onClick={() => void onResubmit(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 shadow-sm">
                            {actionLoadingId === r.id ? "..." : "Resubmit"}
                          </button>
                        )}
                        {currentRole === "admin" && (
                          <button onClick={() => void onDeleteInvoice(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 shadow-sm">
                            {actionLoadingId === r.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (submitterCanEdit) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onStartEdit(r)} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 shadow-sm dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50">Edit</button>
                      </div>
                    );
                  }

                  if (submitterCanResubmit) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onStartEdit(r)} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 shadow-sm dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50">Edit</button>
                        <button onClick={() => void onResubmit(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 shadow-sm">
                          {actionLoadingId === r.id ? "Resubmitting..." : "Resubmit"}
                        </button>
                        <span className="text-xs font-medium text-red-600" title={r.rejectionReason}>
                          {r.rejectionReason || "Rejected"}
                        </span>
                      </div>
                    );
                  }

                  if (r.status === "rejected") {
                    return (
                      <span className="text-xs font-medium text-red-600" title={r.rejectionReason}>
                        Rejected: {r.rejectionReason || "—"}
                      </span>
                    );
                  }

                  return (
                    <span className="text-xs text-gray-400">
                      {r.status === "pending_manager" ? "Pending" : r.status === "paid" ? "Paid" : r.status === "ready_for_payment" ? "Ready" : "Approved"}
                    </span>
                  );
                })()}
              </td>}
              </tr>
              {/* Expanded Detail Row */}
              {expandedRowId === r.id && (
                <tr className="bg-gray-50">
                  <td colSpan={colCount} className="px-6 py-4">
                    {detailLoading ? (
                      <p className="text-sm text-gray-500">Loading...</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {/* Timeline */}
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-gray-700">Timeline</h4>
                          {timelineData.length === 0 ? (
                            <p className="text-xs text-gray-400">No events yet.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {timelineData.map((ev) => {
                                const changes = (ev.payload as Record<string, unknown>)?.changes as Record<string, { from: string; to: string }> | undefined;
                                const hasChanges = changes && Object.keys(changes).length > 0;
                                const eventIcon = ev.event_type === "invoice_updated" ? "bg-amber-400" : ev.event_type.includes("reject") ? "bg-red-400" : ev.event_type.includes("approv") ? "bg-green-400" : ev.event_type.includes("paid") ? "bg-purple-400" : "bg-blue-400";

                                const deptMap = Object.fromEntries(departmentPairs);
                                const progMap = Object.fromEntries(programPairs);
                                const profMap = Object.fromEntries(profilePairs);
                                const resolveName = (field: string, val: string) => {
                                  if (!val || val === "—" || val === "Unassigned") return val;
                                  if (field === "department_id") return deptMap[val] ?? val;
                                  if (field === "program_id") return progMap[val] ?? val;
                                  if (field === "manager") return profMap[val] ?? val;
                                  return val;
                                };

                                return (
                                <div key={ev.id} className="flex items-start gap-2 text-xs">
                                  <div className={`mt-0.5 h-2 w-2 rounded-full ${eventIcon} flex-shrink-0`} />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-700">{ev.actor_name}</span>
                                    <span className="text-gray-500"> — {ev.event_type.replace(/_/g, " ")}</span>
                                    {ev.from_status && ev.to_status && (
                                      <span className="text-gray-400"> ({ev.from_status} → {ev.to_status})</span>
                                    )}
                                    {ev.payload && typeof ev.payload === "object" && typeof (ev.payload as Record<string, string>).rejection_reason === "string" && (
                                      <span className="text-red-600"> — {(ev.payload as Record<string, string>).rejection_reason}</span>
                                    )}
                                    {hasChanges && (
                                      <div className="mt-1 space-y-0.5 rounded bg-gray-50 border border-gray-200 px-2 py-1.5">
                                        {Object.entries(changes!).map(([field, { from, to }]) => (
                                          <div key={field} className="flex items-center gap-1 text-[11px]">
                                            <span className="font-medium text-gray-600 capitalize">{field.replace(/_/g, " ")}:</span>
                                            <span className="text-red-500 line-through">{resolveName(field, from) || "—"}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="text-green-600 font-medium">{resolveName(field, to) || "—"}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="text-gray-400 mt-0.5">{new Date(ev.created_at).toLocaleString("en-GB")}</div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {/* Notes */}
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-gray-700">Notes</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                            {notesData.length === 0 ? (
                              <p className="text-xs text-gray-400">No notes yet.</p>
                            ) : (
                              notesData.map((n) => (
                                <div key={n.id} className="rounded border border-gray-200 bg-white px-3 py-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">{n.author_name}</span>
                                    <span className="text-gray-400">{new Date(n.created_at).toLocaleString("en-GB")}</span>
                                  </div>
                                  <p className="mt-1 text-gray-600">{n.content}</p>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={newNote}
                              onChange={(e) => onNewNoteChange(e.target.value)}
                              placeholder="Add a note..."
                              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                              onKeyDown={(e) => { if (e.key === "Enter") void onAddNote(); }}
                            />
                            <button
                              onClick={() => void onAddNote()}
                              disabled={!newNote.trim()}
                              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </React.Fragment>
            );})
          )}
        </tbody>
      </table>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t-2 border-slate-300 bg-slate-200 px-4 py-3 dark:border-slate-600 dark:bg-slate-700">
          <span className="text-xs text-gray-500">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(0)} disabled={currentPage === 0} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">«</button>
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">‹</button>
            <span className="px-2 text-xs font-medium text-gray-700">{currentPage + 1} / {totalPages}</span>
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">›</button>
            <button onClick={() => onPageChange(totalPages - 1)} disabled={currentPage >= totalPages - 1} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">»</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function InvoicesBoard({
  invoices,
  departmentPairs,
  programPairs,
  profilePairs,
  managerProfilePairs,
  currentRole,
  currentUserId,
}: {
  invoices: InvoiceRow[];
  departmentPairs: [string, string][];
  programPairs: [string, string][];
  profilePairs: [string, string][];
  managerProfilePairs?: [string, string][];
  currentRole: string;
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<"" | DisplayRow["group"]>("");
  const [producerFilter, setProducerFilter] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<"" | "guest" | "invoiceDate" | "amount" | "producer" | "programme">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([...DEFAULT_VISIBLE_COLUMNS]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnsAnchorRef = useRef<HTMLDivElement>(null);
  const [columnPickerPos, setColumnPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!showColumnPicker) {
      setColumnPickerPos(null);
      return;
    }
    const updatePos = () => {
      if (columnsAnchorRef.current) {
        const rect = columnsAnchorRef.current.getBoundingClientRect();
        setColumnPickerPos({ top: rect.bottom + 4, left: rect.right - 224 });
      }
    };
    updatePos();
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (columnsAnchorRef.current?.contains(target)) return;
      const portal = document.getElementById("columns-dropdown-portal");
      if (portal?.contains(target)) return;
      setShowColumnPicker(false);
    };
    document.addEventListener("click", close);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [showColumnPicker]);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineEvent[]>([]);
  const [notesData, setNotesData] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [recentFilters, setRecentFilters] = useState<SavedFilter["filters"][]>([]);
  const [filterName, setFilterName] = useState("");
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [customReportFields, setCustomReportFields] = useState<Record<string, boolean>>(
    () => {
      const defaults: Record<string, boolean> = {};
      ["guest", "producer", "department", "programme", "amount", "invoiceDate", "accountName", "invNumber", "status", "paymentType"].forEach((k) => { defaults[k] = true; });
      return defaults;
    }
  );

  const departmentMap = useMemo(() => new Map(departmentPairs), [departmentPairs]);
  const programMap = useMemo(() => new Map(programPairs), [programPairs]);
  const profileMap = useMemo(() => new Map(profilePairs), [profilePairs]);

  useEffect(() => {
    setHydrated(true);
    setVisibleColumns(loadFromStorage("invoice_visible_columns", [...DEFAULT_VISIBLE_COLUMNS]));
    setSavedFilters(loadFromStorage<SavedFilter[]>("invoice_saved_filters", []));
    setRecentFilters(loadFromStorage<SavedFilter["filters"][]>(RECENT_FILTERS_KEY, []));
  }, []);

  // Push to recently used filters when any filter changes
  React.useEffect(() => {
    if (!hydrated) return;
    const hasAny = search || departmentFilter || programmeFilter || groupFilter || producerFilter || paymentTypeFilter || managerFilter || dateFrom || dateTo;
    if (!hasAny) return;
    const f = { search, departmentFilter, programmeFilter, groupFilter: groupFilter || "", producerFilter, paymentTypeFilter, managerFilter, dateFrom, dateTo, sortField: sortField || "", sortDir };
    pushRecentFilter(f);
    setRecentFilters(loadFromStorage<SavedFilter["filters"][]>(RECENT_FILTERS_KEY, []));
  }, [search, departmentFilter, programmeFilter, groupFilter, producerFilter, paymentTypeFilter, managerFilter, dateFrom, dateTo, sortField, sortDir, hydrated]);

  const rows = useMemo(() => {
    return invoices.map((inv) => {
      const wfRaw = inv.invoice_workflows;
      const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw ?? null;
      const extRaw = inv.invoice_extracted_fields;
      const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw ?? null;
      const raw = (ext?.raw_json ?? {}) as Record<string, unknown>;
      const status = wf?.status ?? "submitted";
      const meta = parseServiceDescription(inv.service_description);

      const guest = fromAliases(meta, ["guest name", "guest", "guest_name"]);
      const title = fromAliases(meta, ["title", "programme title", "program title"]);
      const producer = fromAliases(meta, ["producer", "producer name", "prod"]);
      const paymentType = fromAliases(meta, ["payment type", "payment_type"], "paid_guest").replace(
        /_/g,
        " "
      );
      const department = inv.department_id
        ? departmentMap.get(inv.department_id) ?? inv.department_id
        : fromAliases(meta, ["department name", "department"], "—");
      const programme = inv.program_id
        ? programMap.get(inv.program_id) ?? inv.program_id
        : fromAliases(meta, ["programme name", "program name", "programme", "program"], "—");
      const topic = fromAliases(meta, ["topic", "description", "service description"]);
      const tx1 = fromAliases(meta, ["tx date", "tx date 1", "1. tx date"], inv.service_date_from ?? "—");
      const tx2 = fromAliases(meta, ["2. tx date", "tx date 2"], "—");
      const tx3 = fromAliases(meta, ["3. tx date", "tx date 3"], "—");
      const invoiceDate = fromAliases(meta, ["invoice date", "date"], inv.service_date_to ?? "—");
      const accountName =
        ext?.beneficiary_name ??
        (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name : null) ??
        "—";
      const grossFromRaw =
        typeof raw.gross_amount === "number"
          ? raw.gross_amount
          : typeof raw.gross_amount === "string"
          ? Number(raw.gross_amount)
          : null;
      const amountNum = ext?.gross_amount ?? (Number.isFinite(grossFromRaw ?? NaN) ? grossFromRaw : null);
      const amount = amountNum != null ? String(amountNum) : "—";
      const invNumber =
        ext?.invoice_number ??
        (typeof raw.invoice_number === "string" ? raw.invoice_number : null) ??
        (fromAliases(meta, ["source file name", "file name"], "").trim() || inv.id.slice(0, 8));
      const sortCode =
        ext?.sort_code ?? (typeof raw.sort_code === "string" ? raw.sort_code : null) ?? "—";
      const accountNumber =
        ext?.account_number ??
        (typeof raw.account_number === "string" ? raw.account_number : null) ??
        "—";
      const lineManagerId = wf?.manager_user_id ?? "";
      const lineManager = wf?.manager_user_id
        ? profileMap.get(wf.manager_user_id) ?? wf.manager_user_id
        : "—";
      const paymentDate = wf?.paid_date ?? "—";
      const group = calcGroup(status, paymentType);

      return {
        id: inv.id,
        submitterId: inv.submitter_user_id,
        guest,
        title,
        producer,
        paymentType,
        department,
        departmentId: inv.department_id ?? "",
        programme,
        programmeId: inv.program_id ?? "",
        topic,
        tx1,
        tx2,
        tx3,
        invoiceDate,
        accountName,
        amount,
        invNumber: normalizeInvoiceNumber(invNumber),
        sortCode,
        accountNumber,
        lineManager,
        lineManagerId,
        paymentDate,
        status,
        rejectionReason: wf?.rejection_reason ?? "",
        createdAt: inv.created_at,
        group,
      } satisfies DisplayRow;
    });
  }, [invoices, departmentMap, programMap, profileMap]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = rows.filter((r) => {
      if (departmentFilter && r.department !== departmentFilter) return false;
      if (programmeFilter && r.programme !== programmeFilter) return false;
      if (groupFilter && r.group !== groupFilter) return false;
      if (producerFilter && r.producer !== producerFilter) return false;
      if (paymentTypeFilter && r.paymentType.toLowerCase().replace(/\s+/g, "_") !== paymentTypeFilter) return false;
      if (managerFilter && r.lineManager !== managerFilter) return false;
      if (dateFrom && r.invoiceDate !== "—" && r.invoiceDate < dateFrom) return false;
      if (dateTo && r.invoiceDate !== "—" && r.invoiceDate > dateTo) return false;
      if (!q) return true;
      return (
        r.guest.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.producer.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q) ||
        r.invNumber.toLowerCase().includes(q) ||
        r.accountName.toLowerCase().includes(q) ||
        r.lineManager.toLowerCase().includes(q)
      );
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let va = a[sortField];
        let vb = b[sortField];
        if (sortField === "amount") {
          const na = parseFloat(va) || 0;
          const nb = parseFloat(vb) || 0;
          return sortDir === "asc" ? na - nb : nb - na;
        }
        va = va.toLowerCase();
        vb = vb.toLowerCase();
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, search, departmentFilter, programmeFilter, groupFilter, producerFilter, paymentTypeFilter, managerFilter, dateFrom, dateTo, sortField, sortDir]);

  const groups: DisplayRow["group"][] = [
    "pending_line_manager",
    "rejected",
    "ready_for_payment",
    "paid_invoices",
    "no_payment_needed",
  ];

  const onManagerApprove = async (invoiceId: string) => {
    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "approved_by_manager",
          manager_confirmed: true,
        }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onRejectInvoice = useCallback(async (invoiceId: string) => {
    setRejectModalId(invoiceId);
    setRejectReason("");
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectModalId || !rejectReason.trim()) return;
    setActionLoadingId(rejectModalId);
    try {
      const res = await fetch(`/api/invoices/${rejectModalId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "rejected",
          rejection_reason: rejectReason.trim(),
        }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setActionLoadingId(null);
      setRejectModalId(null);
      setRejectReason("");
    }
  }, [rejectModalId, rejectReason]);

  const onMarkPaid = async (invoiceId: string) => {
    const paymentRef = window.prompt("Payment reference (required):");
    if (paymentRef === null) return;
    if (!paymentRef.trim()) {
      alert("Payment reference is required when marking as paid.");
      return;
    }
    const ok = window.confirm(`Mark as paid with reference: ${paymentRef.trim()}?`);
    if (!ok) return;

    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "paid",
          payment_reference: paymentRef.trim(),
          paid_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Failed to mark as paid");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const openPdf = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      const data = await res.json();
      if (data.url) {
        const row = rows.find((r) => r.id === invoiceId);
        setPreviewName(row?.invNumber ?? "File");
        setPreviewUrl(data.url);
      }
    } catch {
      // silently fail
    }
  };

  const onDeleteInvoice = async (invoiceId: string) => {
    const ok = window.confirm("Are you sure you want to delete this invoice?");
    if (!ok) return;

    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onResubmit = async (invoiceId: string) => {
    const ok = window.confirm("Resubmit this invoice for manager approval?");
    if (!ok) return;
    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: "pending_manager" }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onReplaceFile = async (invoiceId: string, file: File) => {
    setActionLoadingId(invoiceId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/invoices/${invoiceId}/replace-file`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "File replacement failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      alert(msg.includes("fetch") ? "Bağlantı hatası. Sunucunun çalıştığından emin olun." : msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onToggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const onBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch("/api/invoices/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBulkDownloading(false);
    }
  }, [selectedIds]);

  // Column visibility
  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem("invoice_visible_columns", JSON.stringify(next));
      return next;
    });
  }, []);

  // Row expand - load timeline & notes
  const toggleExpandRow = useCallback(async (id: string) => {
    if (expandedRowId === id) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(id);
    setDetailLoading(true);
    setTimelineData([]);
    setNotesData([]);
    try {
      const [tlRes, ntRes] = await Promise.all([
        fetch(`/api/invoices/${id}/timeline`),
        fetch(`/api/invoices/${id}/notes`),
      ]);
      if (tlRes.ok) setTimelineData(await tlRes.json());
      if (ntRes.ok) setNotesData(await ntRes.json());
    } finally {
      setDetailLoading(false);
    }
  }, [expandedRowId]);

  const addNote = useCallback(async () => {
    if (!expandedRowId || !newNote.trim()) return;
    try {
      const res = await fetch(`/api/invoices/${expandedRowId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotesData((prev) => [...prev, note]);
        setNewNote("");
      }
    } catch {
      alert("Not eklenemedi. Bağlantınızı kontrol edin.");
    }
  }, [expandedRowId, newNote]);

  // Saved filters
  const saveCurrentFilter = useCallback(() => {
    if (!filterName.trim()) return;
    const f: SavedFilter = {
      name: filterName.trim(),
      filters: { search, departmentFilter, programmeFilter, groupFilter: groupFilter || "", producerFilter, paymentTypeFilter, managerFilter, dateFrom, dateTo, sortField: sortField || "", sortDir },
    };
    const next = [...savedFilters, f];
    setSavedFilters(next);
    localStorage.setItem("invoice_saved_filters", JSON.stringify(next));
    setFilterName("");
    setShowSaveFilter(false);
  }, [filterName, search, departmentFilter, programmeFilter, groupFilter, producerFilter, paymentTypeFilter, managerFilter, dateFrom, dateTo, sortField, sortDir, savedFilters]);

  const applySavedFilter = useCallback((f: SavedFilter) => {
    setSearch(f.filters.search);
    setDepartmentFilter(f.filters.departmentFilter);
    setProgrammeFilter(f.filters.programmeFilter);
    setGroupFilter(f.filters.groupFilter as typeof groupFilter);
    setProducerFilter(f.filters.producerFilter);
    setPaymentTypeFilter(f.filters.paymentTypeFilter);
    setManagerFilter(f.filters.managerFilter);
    setDateFrom(f.filters.dateFrom);
    setDateTo(f.filters.dateTo);
    setSortField(f.filters.sortField as typeof sortField);
    setSortDir(f.filters.sortDir as typeof sortDir);
    setCurrentPage(0);
  }, []);

  const applyRecentFilter = useCallback((f: SavedFilter["filters"]) => {
    setSearch(f.search);
    setDepartmentFilter(f.departmentFilter);
    setProgrammeFilter(f.programmeFilter as typeof groupFilter);
    setGroupFilter(f.groupFilter as typeof groupFilter);
    setProducerFilter(f.producerFilter);
    setPaymentTypeFilter(f.paymentTypeFilter);
    setManagerFilter(f.managerFilter);
    setDateFrom(f.dateFrom);
    setDateTo(f.dateTo);
    setSortField(f.sortField as typeof sortField);
    setSortDir(f.sortDir as typeof sortDir);
    setCurrentPage(0);
  }, []);

  const deleteSavedFilter = useCallback((index: number) => {
    const next = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(next);
    localStorage.setItem("invoice_saved_filters", JSON.stringify(next));
  }, [savedFilters]);

  // Bulk actions
  const bulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Approve ${selectedIds.size} invoice(s)?`)) return;
    for (const id of Array.from(selectedIds)) {
      await fetch(`/api/invoices/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: "approved_by_manager", manager_confirmed: true }),
      });
    }
    window.location.reload();
  }, [selectedIds]);

  const bulkReject = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const reason = window.prompt(`Rejection reason for ${selectedIds.size} invoice(s):`);
    if (!reason?.trim()) return;
    for (const id of Array.from(selectedIds)) {
      await fetch(`/api/invoices/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: "rejected", rejection_reason: reason.trim() }),
      });
    }
    window.location.reload();
  }, [selectedIds]);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} invoice(s)? This cannot be undone.`)) return;
    for (const id of Array.from(selectedIds)) {
      await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    }
    window.location.reload();
  }, [selectedIds]);

  // Duplicate detection
  const duplicates = useMemo(() => {
    const seen = new Map<string, string[]>();
    rows.forEach((r) => {
      if (r.amount === "—" || !r.guest || r.guest === "—") return;
      const key = `${r.guest.toLowerCase().trim()}|${r.amount}`;
      const arr = seen.get(key) ?? [];
      arr.push(r.id);
      seen.set(key, arr);
    });
    const dupeIds = new Set<string>();
    seen.forEach((ids) => { if (ids.length > 1) ids.forEach((id) => dupeIds.add(id)); });
    return dupeIds;
  }, [rows]);

  // PDF export
  const exportCustomReport = useCallback(async (data: DisplayRow[]) => {
    const fields = Object.entries(customReportFields).filter(([, v]) => v).map(([k]) => k);
    if (fields.length === 0) return;
    const XLSX = await import("xlsx");
    const fieldLabels: Record<string, string> = { guest: "Guest", producer: "Producer", department: "Department", programme: "Programme", amount: "Amount", invoiceDate: "Date", accountName: "Account", invNumber: "INV#", status: "Status", paymentType: "Payment", topic: "Topic", tx1: "TX1", lineManager: "Manager", title: "Title" };
    const rows = data.map((r) => {
      const obj: Record<string, string> = {};
      fields.forEach((f) => { obj[fieldLabels[f] ?? f] = (r as Record<string, string>)[f] ?? ""; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custom Report");
    XLSX.writeFile(wb, `invoice-report-${new Date().toISOString().split("T")[0]}.xlsx`);
    setShowCustomReport(false);
  }, [customReportFields]);

  const exportPdf = useCallback(async (data: DisplayRow[]) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    doc.setFontSize(14);
    doc.text("Invoice Report", 14, 15);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      head: [["Guest", "Producer", "Payment", "Department", "Programme", "Amount", "INV#", "Status", "Date"]],
      body: data.map((r) => [r.guest, r.producer, r.paymentType, r.department, r.programme, r.amount, r.invNumber, r.status, r.invoiceDate]),
    });
    doc.save(`invoices-${new Date().toISOString().split("T")[0]}.pdf`);
  }, []);

  const downloadFile = useCallback(async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }, []);

  const exportToExcel = useCallback(async (data: DisplayRow[]) => {
    const XLSX = await import("xlsx");
    const rows = data.map((r) => ({
      "Guest Name": r.guest,
      "Title": r.title,
      "Producer": r.producer,
      "Payment Type": r.paymentType,
      "Department": r.department,
      "Programme": r.programme,
      "Topic": r.topic,
      "TX Date 1": r.tx1,
      "TX Date 2": r.tx2,
      "TX Date 3": r.tx3,
      "Invoice Date": r.invoiceDate,
      "Account Name": r.accountName,
      "Amount": r.amount,
      "INV Number": r.invNumber,
      "Sort Code": r.sortCode,
      "Account Number": r.accountNumber,
      "Line Manager": r.lineManager,
      "Payment Date": r.paymentDate,
      "Status": r.status,
      "Rejection Reason": r.rejectionReason || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `invoices-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, []);

  const editingIdRef = useRef<string | null>(null);
  const editDraftRef = useRef<EditDraft | null>(null);
  editingIdRef.current = editingId;
  editDraftRef.current = editDraft;

  const saveDraft = useCallback(async (invoiceId: string, draft: EditDraft) => {
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: draft.guest,
          title: draft.title,
          producer: draft.producer,
          payment_type: draft.paymentType.replace(/\s+/g, "_"),
          department_id: draft.departmentId || null,
          program_id: draft.programmeId || null,
          topic: draft.topic,
          invoice_date: draft.invoiceDate,
          tx_date_1: draft.tx1,
          tx_date_2: draft.tx2,
          tx_date_3: draft.tx3,
          beneficiary_name: draft.accountName,
          gross_amount: draft.amount,
          invoice_number: draft.invNumber,
          sort_code: draft.sortCode,
          account_number: draft.accountNumber,
          extracted_currency: "GBP",
          manager_user_id: draft.lineManagerId || null,
        }),
      });
    } catch { /* silent */ }
  }, []);

  const finishEdit = useCallback(async () => {
    const id = editingIdRef.current;
    const draft = editDraftRef.current;
    if (id && draft) {
      setEditingId(null);
      setEditDraft(null);
      await saveDraft(id, draft);
      window.location.reload();
    } else {
      setEditingId(null);
      setEditDraft(null);
    }
  }, [saveDraft]);

  const onStartEdit = useCallback((row: DisplayRow) => {
    const prevId = editingIdRef.current;
    const prevDraft = editDraftRef.current;
    if (prevId && prevDraft && prevId !== row.id) {
      void saveDraft(prevId, prevDraft);
    }
    setEditingId(row.id);
    setEditDraft({
      guest: row.guest === "—" ? "" : row.guest,
      title: row.title === "—" ? "" : row.title,
      producer: row.producer === "—" ? "" : row.producer,
      paymentType: row.paymentType === "—" ? "paid guest" : row.paymentType,
      departmentId: row.departmentId,
      programmeId: row.programmeId,
      topic: row.topic === "—" ? "" : row.topic,
      tx1: row.tx1 === "—" ? "" : row.tx1,
      tx2: row.tx2 === "—" ? "" : row.tx2,
      tx3: row.tx3 === "—" ? "" : row.tx3,
      invoiceDate: row.invoiceDate === "—" ? "" : row.invoiceDate,
      accountName: row.accountName === "—" ? "" : row.accountName,
      amount: row.amount === "—" ? "" : row.amount,
      invNumber: row.invNumber === "—" ? "" : row.invNumber,
      sortCode: row.sortCode === "—" ? "" : row.sortCode,
      accountNumber: row.accountNumber === "—" ? "" : row.accountNumber,
      lineManagerId: row.lineManagerId,
    });
  }, [saveDraft]);

  const onCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const onChangeDraft = useCallback((key: keyof EditDraft, value: string) => {
    setEditDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const onSaveEdit = useCallback(async (invoiceId: string) => {
    if (!editDraftRef.current) return;
    setActionLoadingId(invoiceId);
    try {
      await saveDraft(invoiceId, editDraftRef.current);
      window.location.reload();
    } finally {
      setActionLoadingId(null);
    }
  }, [saveDraft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingIdRef.current) {
        onCancelEdit();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (!editingIdRef.current) return;
      const target = e.target as HTMLElement;
      const editingRow = document.querySelector(`[data-row-id="${editingIdRef.current}"]`);
      if (editingRow && editingRow.contains(target)) return;
      void finishEdit();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [onCancelEdit, finishEdit]);

  useEffect(() => {
    let disposed = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (disposed) return;
        const supabase = createClient();
        sub = supabase.channel("guest-rt").on("postgres_changes", { event: "*", schema: "public", table: "invoice_workflows" }, () => {
          if (!disposed) window.location.reload();
        }).subscribe();
      } catch { /* realtime not critical */ }
    })();
    return () => { disposed = true; sub?.unsubscribe(); };
  }, []);

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Guest Invoice Submission</h1>
        <div className="flex items-center gap-2">
          {currentRole !== "viewer" && (
            <Link
              href="/submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 transition-all flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
              New Invoice
            </Link>
          )}
          <button onClick={() => setShowDashboard((v) => !v)} className={`rounded-xl px-4 py-2 text-sm font-medium transition-all shadow-sm ${showDashboard ? "bg-[#5034FF] text-white shadow-[#5034FF]/25" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"}`}>
            {showDashboard ? "Hide Dashboard" : "Dashboard"}
          </button>
          <div className="relative" ref={columnsAnchorRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowColumnPicker((v) => !v); }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Columns
            </button>
            {showColumnPicker && columnPickerPos && typeof document !== "undefined" && createPortal(
              <div
                id="columns-dropdown-portal"
                className="fixed z-[9999] w-56 rounded-xl border-2 border-slate-300 bg-white p-3 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
                style={{ top: columnPickerPos.top, left: columnPickerPos.left }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-slate-400">Toggle Columns</p>
                {ALL_COLUMNS.filter((c) => c.key !== "checkbox").map((c) => (
                  <label key={c.key} className="flex items-center gap-2 py-0.5 text-xs text-gray-700 cursor-pointer hover:text-gray-900 dark:text-slate-200 dark:hover:text-white">
                    <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={() => toggleColumn(c.key)} className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" onClick={(e) => e.stopPropagation()} />
                    {c.label || c.key}
                  </label>
                ))}
                <button type="button" onClick={(e) => { e.stopPropagation(); setVisibleColumns([...DEFAULT_VISIBLE_COLUMNS]); localStorage.removeItem("invoice_visible_columns"); }} className="mt-2 w-full rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                  Reset All
                </button>
              </div>,
              document.body
            )}
          </div>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700">
            <option value={10}>10/page</option>
            <option value={25}>25/page</option>
            <option value={50}>50/page</option>
            <option value={100}>100/page</option>
          </select>
        </div>
      </div>

      {/* Dashboard */}
      {showDashboard && (
        <Suspense fallback={<div className="p-4 text-sm text-gray-400">Loading dashboard...</div>}>
          <DashboardSection invoices={rows.map((r) => ({ id: r.id, created_at: r.createdAt, status: r.status, amount: r.amount, department: r.department, programme: r.programme, producer: r.producer, guest: r.guest, paymentType: r.paymentType, group: r.group }))} />
        </Suspense>
      )}

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Saved:</span>
          {savedFilters.map((f, i) => (
            <div key={i} className="inline-flex items-center gap-1 rounded-full bg-[#5034FF]/10 px-2.5 py-1 text-xs font-medium text-[#5034FF] dark:bg-[#5034FF]/20 dark:text-[#a78bfa]">
              <button onClick={() => applySavedFilter(f)} className="hover:text-indigo-900">{f.name}</button>
              <button onClick={() => deleteSavedFilter(i)} className="text-indigo-400 hover:text-red-500">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#5034FF] bg-[#5034FF]/20 px-4 py-3 dark:border-[#7c5cff] dark:bg-[#5034FF]/30 shadow-lg">
          <span className="text-sm font-medium text-[#5034FF] dark:text-[#7c5cff]">{selectedIds.size} selected</span>
          {selectedIds.size === 2 && (
            <button
              onClick={() => setCompareIds(Array.from(selectedIds))}
              className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500"
            >
              Compare
            </button>
          )}
          {(currentRole === "manager" || currentRole === "admin") && (
            <>
              <button onClick={() => void bulkApprove()} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500">Bulk Approve</button>
              <button onClick={() => void bulkReject()} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500">Bulk Reject</button>
              {currentRole === "admin" && <button onClick={() => void bulkDelete()} className="rounded bg-red-800 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">Bulk Delete</button>}
            </>
          )}
          <button onClick={() => setSelectedIds(new Set())} className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">Deselect All</button>
        </div>
      )}

      {/* Recently Used Filters */}
      {recentFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent:</span>
          {recentFilters.slice(0, 5).map((f, i) => {
            const label = [f.search, f.departmentFilter, f.programmeFilter, f.groupFilter].filter(Boolean).slice(0, 2).join(" · ") || "Filters";
            return (
              <button
                key={i}
                onClick={() => applyRecentFilter(f)}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {label || `#${i + 1}`}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border-2 border-slate-300 bg-slate-100 shadow-lg dark:border-slate-600 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#5034FF] focus:ring-2 focus:ring-[#5034FF]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value as "" | DisplayRow["group"])} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Status</option>
            {groups.map((g) => (<option key={g} value={g}>{sectionTitle(g)}</option>))}
          </select>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Department</option>
            {Array.from(new Set(rows.map((r) => r.department))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <select value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Programme</option>
            {Array.from(new Set(rows.map((r) => r.programme))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <select value={producerFilter} onChange={(e) => setProducerFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Producer</option>
            {Array.from(new Set(rows.map((r) => r.producer))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <select value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Payment</option>
            <option value="paid_guest">Paid</option>
            <option value="unpaid_guest">Unpaid</option>
          </select>
          <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Manager</option>
            {Array.from(new Set(rows.map((r) => r.lineManager))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="From" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="To" />
          <select value={sortField} onChange={(e) => setSortField(e.target.value as typeof sortField)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Sort</option>
            <option value="guest">Guest</option>
            <option value="producer">Producer</option>
            <option value="programme">Programme</option>
            <option value="invoiceDate">Date</option>
            <option value="amount">Amount</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
          <button
            onClick={() => void exportToExcel(filtered)}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/25"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            Export Excel
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => void onBulkDownload()}
              disabled={bulkDownloading}
              className="inline-flex items-center gap-1 rounded-xl bg-[#5034FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#4030dd] disabled:opacity-50 transition-colors shadow-sm shadow-[#5034FF]/25"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3"/></svg>
              {bulkDownloading ? "Downloading..." : `Download Files (${selectedIds.size})`}
            </button>
          )}
          <button
            onClick={() => void exportPdf(filtered)}
            className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/25"
          >
            PDF
          </button>
          <button
            onClick={() => setShowCustomReport(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 transition-colors shadow-sm shadow-violet-500/25"
          >
            Custom Report
          </button>
          {showSaveFilter ? (
            <div className="flex items-center gap-1">
              <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Filter name" className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm w-28" onKeyDown={(e) => { if (e.key === "Enter") saveCurrentFilter(); }} />
              <button onClick={saveCurrentFilter} disabled={!filterName.trim()} className="rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">Save</button>
              <button onClick={() => setShowSaveFilter(false)} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowSaveFilter(true)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50" title="Save current filter">
              ★
            </button>
          )}
          {(search || departmentFilter || programmeFilter || groupFilter || producerFilter || paymentTypeFilter || managerFilter || dateFrom || dateTo || sortField) && (
            <button
              onClick={() => {
                setSearch(""); setDepartmentFilter(""); setProgrammeFilter(""); setGroupFilter("");
                setProducerFilter(""); setPaymentTypeFilter(""); setManagerFilter("");
                setDateFrom(""); setDateTo(""); setSortField("");
              }}
              className="rounded-lg bg-gray-100 px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
            >
              ✕
            </button>
          )}
        </div>
        {(search || departmentFilter || programmeFilter || groupFilter || producerFilter || paymentTypeFilter || managerFilter || dateFrom || dateTo || sortField) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-3 py-2">
            <span className="text-xs text-gray-500 mr-1">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                &quot;{search}&quot;
                <button onClick={() => setSearch("")} className="ml-0.5 hover:text-blue-900">✕</button>
              </span>
            )}
            {groupFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                {sectionTitle(groupFilter)}
                <button onClick={() => setGroupFilter("")} className="ml-0.5 hover:text-purple-900">✕</button>
              </span>
            )}
            {departmentFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                {departmentFilter}
                <button onClick={() => setDepartmentFilter("")} className="ml-0.5 hover:text-green-900">✕</button>
              </span>
            )}
            {programmeFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                {programmeFilter}
                <button onClick={() => setProgrammeFilter("")} className="ml-0.5 hover:text-orange-900">✕</button>
              </span>
            )}
            {producerFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs text-pink-700">
                {producerFilter}
                <button onClick={() => setProducerFilter("")} className="ml-0.5 hover:text-pink-900">✕</button>
              </span>
            )}
            {paymentTypeFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
                {paymentTypeFilter === "paid_guest" ? "Paid" : "Unpaid"}
                <button onClick={() => setPaymentTypeFilter("")} className="ml-0.5 hover:text-teal-900">✕</button>
              </span>
            )}
            {managerFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                {managerFilter}
                <button onClick={() => setManagerFilter("")} className="ml-0.5 hover:text-indigo-900">✕</button>
              </span>
            )}
            {dateFrom && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                From: {dateFrom}
                <button onClick={() => setDateFrom("")} className="ml-0.5 hover:text-amber-900">✕</button>
              </span>
            )}
            {dateTo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                To: {dateTo}
                <button onClick={() => setDateTo("")} className="ml-0.5 hover:text-amber-900">✕</button>
              </span>
            )}
            {sortField && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                Sort: {sortField} {sortDir === "asc" ? "↑" : "↓"}
                <button onClick={() => setSortField("")} className="ml-0.5 hover:text-gray-900">✕</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearch(""); setDepartmentFilter(""); setProgrammeFilter(""); setGroupFilter("");
                setProducerFilter(""); setPaymentTypeFilter(""); setManagerFilter("");
                setDateFrom(""); setDateTo(""); setSortField("");
              }}
              className="ml-auto rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {groups.map((g) => {
        const data = filtered.filter((r) => r.group === g);
        return (
          <section key={g} className="space-y-2">
            <h2 className={`text-base font-bold ${sectionColor(g)} flex items-center gap-2`}>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current" />
              {sectionTitle(g)} <span className="font-medium text-slate-600 dark:text-slate-400">({data.length})</span>
            </h2>
            <InvoiceTable
              rows={data}
              currentRole={currentRole}
              currentUserId={currentUserId}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onToggleAll={onToggleAll}
              onManagerApprove={onManagerApprove}
              onRejectInvoice={onRejectInvoice}
              onResubmit={onResubmit}
              onMarkPaid={onMarkPaid}
              onDeleteInvoice={onDeleteInvoice}
              onReplaceFile={onReplaceFile}
              openPdf={openPdf}
              editingId={editingId}
              editDraft={editDraft}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onChangeDraft={onChangeDraft}
              onSaveEdit={onSaveEdit}
              actionLoadingId={actionLoadingId}
              visibleColumns={visibleColumns}
              expandedRowId={expandedRowId}
              onToggleExpand={(id) => void toggleExpandRow(id)}
              timelineData={timelineData}
              notesData={notesData}
              newNote={newNote}
              onNewNoteChange={setNewNote}
              onAddNote={() => void addNote()}
              detailLoading={detailLoading}
              duplicates={duplicates}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              departmentPairs={departmentPairs}
              programPairs={programPairs}
              profilePairs={profilePairs}
              managerProfilePairs={managerProfilePairs}
            />
          </section>
        );
      })}

      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Reject Invoice</h3>
            <p className="mt-2 text-sm text-gray-600">Please enter the reason for rejection:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Rejection reason..."
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setRejectModalId(null); setRejectReason(""); }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmReject()}
                disabled={!rejectReason.trim() || actionLoadingId === rejectModalId}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {actionLoadingId === rejectModalId ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setPreviewUrl(null)}>
          <div className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 truncate dark:text-white">{previewName}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void downloadFile(previewUrl, previewName || "invoice")}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  Download
                </button>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={previewUrl} className="h-full w-full border-0" title="File preview" />
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {compareIds.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCompareIds([])}>
          <div className="relative flex h-[85vh] w-[95vw] max-w-6xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Compare Invoices</h3>
              <button onClick={() => setCompareIds([])} className="rounded-lg px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">✕ Close</button>
            </div>
            <div className="flex flex-1 overflow-auto">
              {compareIds.map((id) => {
                const row = rows.find((r) => r.id === id);
                if (!row) return null;
                const entries = [
                  ["Guest", row.guest], ["Producer", row.producer], ["Department", row.department], ["Programme", row.programme],
                  ["Amount", row.amount], ["INV#", row.invNumber], ["Status", row.status], ["Date", row.invoiceDate],
                  ["Account", row.accountName], ["Payment", row.paymentType], ["Topic", row.topic],
                ];
                return (
                  <div key={id} className="flex-1 min-w-0 border-r last:border-r-0 border-gray-200 dark:border-gray-700 p-4 overflow-auto">
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-3 truncate">{row.invNumber}</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        {entries.map(([k, v]) => (
                          <tr key={k} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-1.5 text-gray-500 dark:text-gray-400 w-24">{k}</td>
                            <td className="py-1.5 text-gray-900 dark:text-white break-words">{v || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Report Modal */}
      {showCustomReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCustomReport(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Custom Report – Select Fields</h3>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {[
                { key: "guest", label: "Guest Name" },
                { key: "producer", label: "Producer" },
                { key: "department", label: "Department" },
                { key: "programme", label: "Programme" },
                { key: "amount", label: "Amount" },
                { key: "invoiceDate", label: "Invoice Date" },
                { key: "accountName", label: "Account Name" },
                { key: "invNumber", label: "INV Number" },
                { key: "status", label: "Status" },
                { key: "paymentType", label: "Payment Type" },
                { key: "topic", label: "Topic" },
                { key: "title", label: "Title" },
                { key: "tx1", label: "TX Date" },
                { key: "lineManager", label: "Line Manager" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customReportFields[key] ?? false}
                    onChange={(e) => setCustomReportFields((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowCustomReport(false)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
              <button onClick={() => void exportCustomReport(filtered)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Export Excel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
