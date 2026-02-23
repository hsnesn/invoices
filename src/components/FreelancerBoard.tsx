"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

const FreelancerDashboard = lazy(() => import("./FreelancerDashboard").then(m => ({ default: m.FreelancerDashboard })));

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type WfShape = { status: string; rejection_reason: string | null; manager_user_id: string | null; paid_date: string | null };
type ExtShape = { invoice_number: string | null; beneficiary_name: string | null; account_number: string | null; sort_code: string | null; gross_amount: number | null; extracted_currency: string | null };
type FlShape = { contractor_name: string | null; company_name: string | null; service_description: string | null; service_days_count: number | null; service_days: string | null; service_rate_per_day: number | null; service_month: string | null; additional_cost: number | null; additional_cost_reason: string | null; booked_by: string | null; department_2: string | null; istanbul_team: string | null };

type FreelancerInvoiceRow = {
  id: string; submitter_user_id: string; service_description: string | null; currency: string; created_at: string;
  service_date_from: string | null; service_date_to: string | null; department_id: string | null; program_id: string | null; invoice_type: string;
  invoice_workflows: WfShape[] | WfShape | null;
  invoice_extracted_fields: ExtShape[] | ExtShape | null;
  freelancer_invoice_fields: FlShape[] | FlShape | null;
};

type GroupKey = "submitted" | "rejected" | "admin_approvals" | "ready_for_payment" | "paid";

type DisplayRow = {
  id: string; submitterId: string; contractor: string; submittedBy: string; companyName: string; submissionDate: string;
  additionalCost: string; additionalCostNum: number; amount: string; amountNum: number; invoiceAmount: string; invoiceAmountNum: number;
  invNumber: string; beneficiary: string; accountNumber: string; sortCode: string;
  deptManager: string; deptManagerId: string; department: string; departmentId: string;
  department2: string; serviceDaysCount: string; days: string; serviceRate: string;
  month: string; bookedBy: string; serviceDescription: string; additionalCostReason: string;
  status: string; rejectionReason: string; createdAt: string; paidDate: string; group: GroupKey;
};

type EditDraft = {
  contractor: string; companyName: string; additionalCost: string; invNumber: string; beneficiary: string;
  accountNumber: string; sortCode: string; deptManagerId: string; departmentId: string; department2: string;
  serviceDaysCount: string; days: string; serviceRate: string; month: string;
  bookedBy: string; serviceDescription: string; additionalCostReason: string;
};

type TimelineEvent = { id: number; event_type: string; from_status: string | null; to_status: string | null; payload: Record<string, unknown> | null; actor_name: string; created_at: string };
type NoteItem = { id: number; content: string; author_name: string; created_at: string };

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

const GROUPS: { key: GroupKey; label: string; color: string; headerBg: string; textColor: string }[] = [
  { key: "submitted", label: "Submitted Invoices", color: "border-amber-500", headerBg: "bg-amber-50 dark:bg-amber-950/30", textColor: "text-amber-700 dark:text-amber-400" },
  { key: "rejected", label: "Rejected Invoices", color: "border-rose-500", headerBg: "bg-rose-50 dark:bg-rose-950/30", textColor: "text-rose-700 dark:text-rose-400" },
  { key: "admin_approvals", label: "The Operations Room Approvals", color: "border-orange-500", headerBg: "bg-orange-50 dark:bg-orange-950/30", textColor: "text-orange-700 dark:text-orange-400" },
  { key: "ready_for_payment", label: "Ready for Payment", color: "border-sky-500", headerBg: "bg-sky-50 dark:bg-sky-950/30", textColor: "text-sky-700 dark:text-sky-400" },
  { key: "paid", label: "Paid Invoices", color: "border-emerald-500", headerBg: "bg-emerald-50 dark:bg-emerald-950/30", textColor: "text-emerald-700 dark:text-emerald-400" },
];

const ALL_COLUMNS = [
  { key: "status", label: "✓" },
  { key: "contractor", label: "Contractor" },
  { key: "submittedBy", label: "Submitted by" },
  { key: "companyName", label: "Company Name" },
  { key: "submissionDate", label: "Submission Date" },
  { key: "files", label: "Files" },
  { key: "serviceDescription", label: "Service Desc." },
  { key: "department", label: "Department" },
  { key: "department2", label: "Department 2" },
  { key: "bookedBy", label: "Booked by" },
  { key: "serviceDaysCount", label: "Service Days" },
  { key: "month", label: "Month" },
  { key: "days", label: "Days" },
  { key: "serviceRate", label: "Rate/Day" },
  { key: "additionalCost", label: "Additional Cost" },
  { key: "additionalCostReason", label: "Add. Cost Reason" },
  { key: "amount", label: "Amount" },
  { key: "invoiceAmount", label: "Invoice Amount" },
  { key: "invNumber", label: "INV Number" },
  { key: "beneficiary", label: "Beneficiary" },
  { key: "accountNumber", label: "Account Nu." },
  { key: "sortCode", label: "Sort Code" },
  { key: "deptManager", label: "Department Manager" },
  { key: "bookingForm", label: "Booking Form" },
  { key: "actions", label: "" },
];

const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key);
const COL_STORAGE_KEY = "fl_visible_columns";

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s); } catch { /* */ }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function statusToGroup(status: string): GroupKey {
  switch (status) {
    case "rejected": return "rejected";
    case "submitted": case "pending_manager": return "submitted";
    case "approved_by_manager": case "pending_admin": return "admin_approvals";
    case "ready_for_payment": return "ready_for_payment";
    case "paid": case "archived": return "paid";
    default: return "submitted";
  }
}

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function daysSince(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export function FreelancerBoard({
  invoices, departmentPairs, profilePairs, managerProfilePairs, currentRole, currentUserId, isOperationsRoomMember = false,
}: {
  invoices: FreelancerInvoiceRow[];
  departmentPairs: [string, string][];
  profilePairs: [string, string][];
  managerProfilePairs?: [string, string][];
  currentRole: string;
  currentUserId: string;
  isOperationsRoomMember?: boolean;
}) {
  const deptMap = useMemo(() => Object.fromEntries(departmentPairs), [departmentPairs]);
  const profMap = useMemo(() => Object.fromEntries(profilePairs), [profilePairs]);

  /* ---------- Transform rows ---------- */
  const rows: DisplayRow[] = useMemo(() => invoices.map(inv => {
    const wf = unwrap(inv.invoice_workflows);
    const ext = unwrap(inv.invoice_extracted_fields);
    const fl = unwrap(inv.freelancer_invoice_fields);
    const status = wf?.status ?? "submitted";
    const daysCount = fl?.service_days_count ?? 0;
    const rate = fl?.service_rate_per_day ?? 0;
    const addCost = fl?.additional_cost ?? 0;
    const computedAmount = daysCount * rate + addCost;
    const invoiceAmtNum = ext?.gross_amount ?? 0;
    return {
      id: inv.id, submitterId: inv.submitter_user_id,
      contractor: fl?.contractor_name ?? "—", submittedBy: profMap[inv.submitter_user_id] ?? "—",
      companyName: fl?.company_name ?? "—",
      submissionDate: inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—",
      additionalCost: addCost > 0 ? fmtCurrency(addCost) : "—", additionalCostNum: addCost,
      amount: computedAmount > 0 ? fmtCurrency(computedAmount) : "—", amountNum: computedAmount,
      invoiceAmount: invoiceAmtNum > 0 ? fmtCurrency(invoiceAmtNum) : "—", invoiceAmountNum: invoiceAmtNum,
      invNumber: ext?.invoice_number ?? "—", beneficiary: ext?.beneficiary_name ?? "—",
      accountNumber: ext?.account_number ?? "—", sortCode: ext?.sort_code ?? "—",
      deptManager: wf?.manager_user_id ? profMap[wf.manager_user_id] ?? "—" : "—",
      deptManagerId: wf?.manager_user_id ?? "",
      department: inv.department_id ? deptMap[inv.department_id] ?? "—" : "—", departmentId: inv.department_id ?? "",
      department2: fl?.department_2 ?? "—",
      serviceDaysCount: fl?.service_days_count?.toString() ?? "—", days: fl?.service_days ?? "—",
      serviceRate: fl?.service_rate_per_day ? `£${fl.service_rate_per_day}` : "—",
      month: fl?.service_month ?? "—", bookedBy: fl?.booked_by ?? "—",
      serviceDescription: fl?.service_description ?? "—", additionalCostReason: fl?.additional_cost_reason ?? "—",
      status, rejectionReason: wf?.rejection_reason ?? "", createdAt: inv.created_at,
      paidDate: wf?.paid_date ?? "", group: statusToGroup(status),
    };
  }), [invoices, deptMap, profMap]);

  /* ---------- Filters ---------- */
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [bookedByFilter, setBookedByFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasFilter = !!(search || departmentFilter || monthFilter || groupFilter || managerFilter || bookedByFilter || dateFrom || dateTo);
  const clearFilters = () => { setSearch(""); setDepartmentFilter(""); setMonthFilter(""); setGroupFilter(""); setManagerFilter(""); setBookedByFilter(""); setDateFrom(""); setDateTo(""); };

  const uniqueMonths = useMemo(() => Array.from(new Set(rows.map(r => r.month).filter(m => m !== "—"))).sort(), [rows]);
  const uniqueBookedBy = useMemo(() => Array.from(new Set(rows.map(r => r.bookedBy).filter(b => b !== "—"))).sort(), [rows]);

  const filteredRows = useMemo(() => rows.filter(r => {
    if (search) { const q = search.toLowerCase(); if (![r.contractor, r.companyName, r.submittedBy, r.beneficiary, r.invNumber, r.serviceDescription, r.bookedBy, r.department, r.department2].some(v => v.toLowerCase().includes(q))) return false; }
    if (departmentFilter && r.departmentId !== departmentFilter) return false;
    if (monthFilter && r.month !== monthFilter) return false;
    if (groupFilter && r.group !== groupFilter) return false;
    if (managerFilter && r.deptManagerId !== managerFilter) return false;
    if (bookedByFilter && r.bookedBy !== bookedByFilter) return false;
    if (dateFrom && r.createdAt < dateFrom) return false;
    if (dateTo && r.createdAt > dateTo + "T23:59:59") return false;
    return true;
  }), [rows, search, departmentFilter, monthFilter, groupFilter, managerFilter, bookedByFilter, dateFrom, dateTo]);

  /* ---------- Column visibility ---------- */
  const [visibleColumns, setVisibleColumns] = useState<string[]>([...DEFAULT_VISIBLE]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnsAnchorRef = useRef<HTMLDivElement>(null);
  const [columnPickerPos, setColumnPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); setVisibleColumns(loadStorage(COL_STORAGE_KEY, [...DEFAULT_VISIBLE])); }, []);

  useEffect(() => {
    if (!showColumnPicker) { setColumnPickerPos(null); return; }
    const updatePos = () => { if (columnsAnchorRef.current) { const r = columnsAnchorRef.current.getBoundingClientRect(); setColumnPickerPos({ top: r.bottom + 4, left: r.right - 224 }); } };
    updatePos();
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (columnsAnchorRef.current?.contains(t)) return;
      const portal = document.getElementById("fl-columns-portal");
      if (portal?.contains(t)) return;
      setShowColumnPicker(false);
    };
    document.addEventListener("click", close);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => { document.removeEventListener("click", close); window.removeEventListener("scroll", updatePos, true); window.removeEventListener("resize", updatePos); };
  }, [showColumnPicker]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns(prev => { const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]; localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next)); return next; });
  }, []);
  const isCol = (key: string) => visibleColumns.includes(key);
  const COLUMNS = ALL_COLUMNS.filter(c => isCol(c.key));

  /* ---------- State ---------- */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineEvent[]>([]);
  const [notesData, setNotesData] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const editingIdRef = useRef<string | null>(null);
  const editDraftRef = useRef<EditDraft | null>(null);
  editingIdRef.current = editingId;
  editDraftRef.current = editDraft;
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- Callbacks ---------- */
  const toggleGroup = useCallback((key: string) => { setCollapsedGroups(p => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; }); }, []);

  const toggleExpandRow = useCallback(async (id: string) => {
    if (expandedRowId === id) { setExpandedRowId(null); return; }
    setExpandedRowId(id); setDetailLoading(true); setTimelineData([]); setNotesData([]);
    try {
      const [tlR, ntR] = await Promise.all([fetch(`/api/invoices/${id}/timeline`), fetch(`/api/invoices/${id}/notes`)]);
      if (tlR.ok) setTimelineData(await tlR.json());
      if (ntR.ok) setNotesData(await ntR.json());
    } finally { setDetailLoading(false); }
  }, [expandedRowId]);

  const handleRowClick = useCallback((id: string) => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { void toggleExpandRow(id); clickTimerRef.current = null; }, 250);
  }, [toggleExpandRow]);
  const handleRowDblClick = useCallback(() => { if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; } }, []);

  const saveDraft = useCallback(async (invoiceId: string, draft: EditDraft) => {
    try { await fetch(`/api/freelancer-invoices/${invoiceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) }); } catch { /* */ }
  }, []);

  const finishEdit = useCallback(async () => {
    const id = editingIdRef.current; const draft = editDraftRef.current;
    if (!id || !draft) { setEditingId(null); setEditDraft(null); return; }
    const row = rows.find(r => r.id === id);
    const wasRejected = row?.status === "rejected";
    setEditingId(null); setEditDraft(null);
    await saveDraft(id, draft);
    if (wasRejected) {
      await fetch(`/api/invoices/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_status: "pending_manager" }) });
    }
    window.location.reload();
  }, [saveDraft, rows]);

  const onStartEdit = useCallback((row: DisplayRow) => {
    const prevId = editingIdRef.current; const prevDraft = editDraftRef.current;
    if (prevId && prevDraft && prevId !== row.id) void saveDraft(prevId, prevDraft);
    handleRowDblClick(); setEditingId(row.id);
    setEditDraft({
      contractor: row.contractor === "—" ? "" : row.contractor, companyName: row.companyName === "—" ? "" : row.companyName,
      additionalCost: row.additionalCost === "—" ? "" : row.additionalCost.replace(/[£,]/g, ""),
      invNumber: row.invNumber === "—" ? "" : row.invNumber, beneficiary: row.beneficiary === "—" ? "" : row.beneficiary,
      accountNumber: row.accountNumber === "—" ? "" : row.accountNumber, sortCode: row.sortCode === "—" ? "" : row.sortCode,
      deptManagerId: row.deptManagerId, departmentId: row.departmentId,
      department2: row.department2 === "—" ? "" : row.department2,
      serviceDaysCount: row.serviceDaysCount === "—" ? "" : row.serviceDaysCount, days: row.days === "—" ? "" : row.days,
      serviceRate: row.serviceRate === "—" ? "" : row.serviceRate.replace(/[£,]/g, ""),
      month: row.month === "—" ? "" : row.month, bookedBy: row.bookedBy === "—" ? "" : row.bookedBy,
      serviceDescription: row.serviceDescription === "—" ? "" : row.serviceDescription,
      additionalCostReason: row.additionalCostReason === "—" ? "" : row.additionalCostReason,
    });
  }, [saveDraft, handleRowDblClick]);

  const onCancelEdit = useCallback(() => { setEditingId(null); setEditDraft(null); }, []);
  const onChangeDraft = useCallback((key: keyof EditDraft, value: string) => { setEditDraft(p => p ? { ...p, [key]: value } : p); }, []);

  /* ---------- Status actions ---------- */
  const statusAction = useCallback(async (id: string, body: Record<string, unknown>) => {
    setActionLoadingId(id);
    try { await fetch(`/api/invoices/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); window.location.reload(); }
    finally { setActionLoadingId(null); }
  }, []);

  const onManagerApprove = useCallback((id: string) => statusAction(id, { to_status: "approved_by_manager", manager_confirmed: true }), [statusAction]);
  const onAdminApprove = useCallback((id: string) => statusAction(id, { to_status: "ready_for_payment" }), [statusAction]);
  const onResubmit = useCallback((id: string) => statusAction(id, { to_status: "pending_manager" }), [statusAction]);
  const onMarkPaid = useCallback((id: string) => {
    const paymentRef = window.prompt("Payment reference (required):");
    if (paymentRef === null) return;
    if (!paymentRef.trim()) {
      alert("Payment reference is required when marking as paid.");
      return;
    }
    statusAction(id, { to_status: "paid", payment_reference: paymentRef.trim(), paid_date: new Date().toISOString().split("T")[0] });
  }, [statusAction]);

  const submitReject = useCallback(async () => {
    if (!rejectModalId || !rejectReason.trim()) return;
    setActionLoadingId(rejectModalId);
    try { await fetch(`/api/invoices/${rejectModalId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_status: "rejected", rejection_reason: rejectReason }) }); setRejectModalId(null); setRejectReason(""); window.location.reload(); }
    finally { setActionLoadingId(null); }
  }, [rejectModalId, rejectReason]);

  const addNote = useCallback(async () => {
    if (!expandedRowId || !newNote.trim()) return;
    await fetch(`/api/invoices/${expandedRowId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newNote }) });
    setNewNote(""); const res = await fetch(`/api/invoices/${expandedRowId}/notes`); if (res.ok) setNotesData(await res.json());
  }, [expandedRowId, newNote]);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setPreviewHtml(null); setPreviewDownloadUrl(null); setPreviewName("");
  }, [previewUrl]);

  const openFile = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}/pdf`);
      const data = await res.json();
      if (!data.url) return;
      const row = rows.find(r => r.id === id);
      setPreviewName(row?.contractor ?? "File");
      setPreviewDownloadUrl(data.url);

      const fileRes = await fetch(data.url);
      const blob = await fileRes.blob();
      const mime = blob.type.toLowerCase();
      const url = data.url.toLowerCase();

      if (mime.includes("pdf") || url.includes(".pdf")) {
        const blobUrl = URL.createObjectURL(blob);
        setPreviewHtml(null);
        setPreviewUrl(blobUrl);
      } else if (mime.includes("word") || mime.includes("docx") || url.includes(".docx") || url.includes(".doc")) {
        const mammoth = await import("mammoth");
        const arrayBuf = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
        setPreviewUrl(null);
        setPreviewHtml(result.value);
      } else if (mime.includes("sheet") || mime.includes("excel") || url.includes(".xlsx") || url.includes(".xls")) {
        const XLSX = await import("xlsx");
        const arrayBuf = await blob.arrayBuffer();
        const wb = XLSX.read(arrayBuf, { type: "array" });
        let html = "";
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          html += `<h3 style="margin:16px 0 8px;font-weight:bold;font-size:14px;">${name}</h3>`;
          html += XLSX.utils.sheet_to_html(ws, { editable: false });
        }
        setPreviewUrl(null);
        setPreviewHtml(html);
      } else {
        const blobUrl = URL.createObjectURL(blob);
        setPreviewHtml(null);
        setPreviewUrl(blobUrl);
      }
    } catch { /* */ }
  }, [rows]);

  const downloadFile = useCallback(async (url: string, name: string) => {
    try { const res = await fetch(url); const blob = await res.blob(); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); }
    catch { window.open(url, "_blank"); }
  }, []);

  const onReplaceFile = useCallback(async (invoiceId: string, file: File) => {
    setActionLoadingId(invoiceId);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(`/api/invoices/${invoiceId}/replace-file`, { method: "POST", body: fd });
      if (res.ok) { window.location.reload(); } else { const d = await res.json().catch(() => null); alert(d?.error ?? "File replacement failed"); }
    } catch (err) { alert(err instanceof Error ? err.message : "Upload failed"); }
    finally { setActionLoadingId(null); }
  }, []);

  const viewBookingForm = useCallback(async (id: string, contractor: string, month: string) => {
    try {
      const r = await fetch(`/api/freelancer-invoices/${id}/booking-form`);
      if (!r.ok) { alert("Booking form could not be generated"); return; }
      const blob = await r.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewUrl(blobUrl);
      setPreviewHtml(null);
      setPreviewName(`Booking_Form_${contractor.replace(/\s+/g, "_")}_${month}.pdf`);
      setPreviewDownloadUrl(blobUrl);
    } catch { alert("Error loading booking form"); }
  }, []);

  const downloadBookingForm = useCallback(async (id: string, contractor: string, month: string) => {
    try {
      const r = await fetch(`/api/freelancer-invoices/${id}/booking-form`);
      if (!r.ok) { alert("Booking form could not be generated"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Booking_Form_${contractor.replace(/\s+/g, "_")}_${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { alert("Error downloading booking form"); }
  }, []);

  const sendBookingFormEmails = useCallback(async (id: string) => {
    setActionLoadingId(id);
    try {
      const r = await fetch(`/api/freelancer-invoices/${id}/booking-form/trigger`, { method: "POST" });
      const d = await r.json().catch(() => null);
      if (r.ok) alert(d?.skipped ? "Already sent (idempotent)" : "Booking form emails sent to Line Manager and London Operations.");
      else alert(d?.error ?? "Failed to send booking form emails");
    } catch { alert("Error sending booking form emails"); }
    finally { setActionLoadingId(null); }
  }, []);

  /* ---------- Bulk operations ---------- */
  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const onToggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds(prev => { const n = new Set(prev); for (const id of ids) { if (checked) n.add(id); else n.delete(id); } return n; });
  }, []);
  const bulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Approve ${selectedIds.size} invoice(s)?`)) return;
    for (const id of Array.from(selectedIds)) { await fetch(`/api/invoices/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_status: "approved_by_manager", manager_confirmed: true }) }); }
    window.location.reload();
  }, [selectedIds]);
  const bulkReject = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const reason = window.prompt(`Rejection reason for ${selectedIds.size} invoice(s):`);
    if (!reason?.trim()) return;
    for (const id of Array.from(selectedIds)) { await fetch(`/api/invoices/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_status: "rejected", rejection_reason: reason.trim() }) }); }
    window.location.reload();
  }, [selectedIds]);
  const bulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch("/api/invoices/bulk-download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice_ids: Array.from(selectedIds) }) });
      if (!res.ok) { alert("Download failed"); return; }
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `freelancer-invoices-${new Date().toISOString().split("T")[0]}.zip`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setBulkDownloading(false); }
  }, [selectedIds]);

  /* ---------- Duplicate detection ---------- */
  const duplicates = useMemo(() => {
    const seen = new Map<string, string[]>();
    rows.forEach(r => {
      if (r.amountNum === 0 || r.contractor === "—") return;
      const key = `${r.contractor.toLowerCase().trim()}|${r.amountNum}`;
      const arr = seen.get(key) ?? [];
      arr.push(r.id);
      seen.set(key, arr);
    });
    const dupeIds = new Set<string>();
    seen.forEach(ids => { if (ids.length > 1) ids.forEach(id => dupeIds.add(id)); });
    return dupeIds;
  }, [rows]);

  /* ---------- PDF export ---------- */
  const exportToPdf = useCallback(async (data: DisplayRow[]) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    doc.setFontSize(14); doc.text("Freelancer Invoice Report", 14, 15);
    doc.setFontSize(8); doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")} | ${data.length} invoices`, 14, 20);
    autoTable(doc, {
      startY: 25, styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [59, 130, 246] },
      head: [["Contractor", "Company", "Service", "Department", "Days", "Rate", "Amount", "Status", "Month", "Booked By"]],
      body: data.map(r => [r.contractor, r.companyName, r.serviceDescription, r.department, r.serviceDaysCount, r.serviceRate, r.amount, r.status, r.month, r.bookedBy]),
    });
    doc.save(`freelancer-invoices-${new Date().toISOString().split("T")[0]}.pdf`);
  }, []);

  /* ---------- Realtime ---------- */
  useEffect(() => {
    let disposed = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (disposed) return;
        const supabase = createClient();
        sub = supabase.channel("fl-rt").on("postgres_changes", { event: "*", schema: "public", table: "invoice_workflows" }, () => {
          if (!disposed) window.location.reload();
        }).subscribe();
      } catch { /* realtime not critical */ }
    })();
    return () => { disposed = true; sub?.unsubscribe(); };
  }, []);

  /* ---------- Auto-save on click outside ---------- */
  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === "Escape" && editingIdRef.current) onCancelEdit(); };
    const md = (e: MouseEvent) => {
      if (!editingIdRef.current) return;
      const row = document.querySelector(`[data-row-id="${editingIdRef.current}"]`);
      if (row && row.contains(e.target as Node)) return;
      void finishEdit();
    };
    document.addEventListener("keydown", kd);
    document.addEventListener("mousedown", md, true);
    return () => { document.removeEventListener("keydown", kd); document.removeEventListener("mousedown", md, true); };
  }, [onCancelEdit, finishEdit]);

  /* ---------- Export ---------- */
  const exportToExcel = useCallback(async (data: DisplayRow[]) => {
    const XLSX = await import("xlsx");
    const xlsRows = data.map(r => ({
      Contractor: r.contractor, "Submitted by": r.submittedBy, "Company Name": r.companyName,
      "Submission Date": r.submissionDate, "Service Description": r.serviceDescription,
      Department: r.department, "Department 2": r.department2, "Booked by": r.bookedBy,
      "Service Days": r.serviceDaysCount, Month: r.month, Days: r.days, "Rate/Day": r.serviceRate,
      "Additional Cost": r.additionalCost, "Add. Cost Reason": r.additionalCostReason,
      Amount: r.amount, "Invoice Amount": r.invoiceAmount, "INV Number": r.invNumber,
      Beneficiary: r.beneficiary, "Account Nu.": r.accountNumber, "Sort Code": r.sortCode,
      "Department Manager": r.deptManager, Status: r.status,
      "Rejection Reason": r.rejectionReason, "Paid Date": r.paidDate,
    }));
    const ws = XLSX.utils.json_to_sheet(xlsRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Freelancer Invoices");
    XLSX.writeFile(wb, `freelancer-invoices-${new Date().toISOString().split("T")[0]}.xlsx`);
  }, []);

  /* ---------- Grouped rows ---------- */
  const groupedRows = useMemo(() => {
    const map: Record<string, DisplayRow[]> = { submitted: [], rejected: [], admin_approvals: [], ready_for_payment: [], paid: [] };
    for (const r of filteredRows) (map[r.group] ??= []).push(r);
    return map;
  }, [filteredRows]);

  /* ---------- Permissions ---------- */
  const canEditRow = (r: DisplayRow) => {
    if (currentRole === "admin") return true;
    if (currentRole === "manager") return true;
    if (r.submitterId === currentUserId && ["submitted", "pending_manager", "rejected"].includes(r.status)) return true;
    return false;
  };
  const canApprove = (r: DisplayRow) => {
    if (r.submitterId === currentUserId && currentRole !== "admin" && !isOperationsRoomMember) return false;
    if (currentRole === "admin") return true;
    if (isOperationsRoomMember && (r.status === "approved_by_manager" || r.status === "pending_admin")) return true;
    if (currentRole === "manager" && r.deptManagerId === currentUserId) return true;
    return false;
  };

  /* ---------- Group sums ---------- */
  const groupSums = useMemo(() => {
    const result: Record<string, { additional: number; amount: number; invoiceAmount: number }> = {};
    for (const g of GROUPS) { const gr = groupedRows[g.key] ?? []; result[g.key] = { additional: gr.reduce((s, r) => s + r.additionalCostNum, 0), amount: gr.reduce((s, r) => s + r.amountNum, 0), invoiceAmount: gr.reduce((s, r) => s + r.invoiceAmountNum, 0) }; }
    return result;
  }, [groupedRows]);

  /* ---------- Render cell ---------- */
  const renderCell = (r: DisplayRow, col: string, isEditing: boolean) => {
    const inp = (key: keyof EditDraft, type = "text") => <input type={type} value={editDraft?.[key] ?? ""} onChange={e => onChangeDraft(key, e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />;
    const isSubmitter = r.submitterId === currentUserId;
    switch (col) {
      case "status": return <StatusCell r={r} canApprove={canApprove(r)} isSubmitter={isSubmitter} currentRole={currentRole} isOperationsRoomMember={isOperationsRoomMember} actionLoadingId={actionLoadingId} onManagerApprove={onManagerApprove} onAdminApprove={onAdminApprove} onResubmit={onResubmit} onMarkPaid={onMarkPaid} openRejectModal={(id) => { setRejectModalId(id); setRejectReason(""); }} />;
      case "contractor": return isEditing ? inp("contractor") : <span className="font-medium">{r.contractor}{r.status === "rejected" && r.rejectionReason && <div className="mt-1 rounded bg-rose-50 border border-rose-200 px-2 py-1 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300"><span className="font-semibold">Rejection:</span> {r.rejectionReason}</div>}</span>;
      case "submittedBy": return <SubmitterBadge name={r.submittedBy} />;
      case "companyName": return isEditing ? inp("companyName") : r.companyName;
      case "submissionDate": return r.submissionDate;
      case "files": return (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => void openFile(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors dark:bg-sky-900/40 dark:text-sky-300"><svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4zM6 10h8v2H6v-2zm0 4h5v2H6v-2z"/></svg>Open</button>
          {(isSubmitter || currentRole === "admin" || currentRole === "manager") && (
            <label className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer dark:bg-amber-900/30 dark:text-amber-300">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>Replace
              <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) void onReplaceFile(r.id, f); e.target.value = ""; }} />
            </label>
          )}
        </div>
      );
      case "additionalCost": return isEditing ? inp("additionalCost") : r.additionalCost;
      case "amount": {
        if (isEditing) { const d = parseFloat(editDraft?.serviceDaysCount ?? "0") || 0; const rt = parseFloat(editDraft?.serviceRate ?? "0") || 0; const ac = parseFloat(editDraft?.additionalCost ?? "0") || 0; const t = d * rt + ac; return <span className="font-semibold text-blue-700 dark:text-blue-300">{t > 0 ? fmtCurrency(t) : "—"}</span>; }
        return <span className="font-semibold text-gray-900 dark:text-white group/amt relative cursor-default">{r.amount}<span className="pointer-events-none absolute left-0 top-full mt-1 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] font-normal text-white opacity-0 shadow-lg transition-opacity group-hover/amt:opacity-100 z-50">{r.serviceDaysCount} days × {r.serviceRate} + {r.additionalCost} add.</span></span>;
      }
      case "invoiceAmount": return <span className="font-semibold text-gray-900 dark:text-white">{r.invoiceAmount}</span>;
      case "invNumber": return isEditing ? inp("invNumber") : r.invNumber;
      case "beneficiary": return isEditing ? inp("beneficiary") : r.beneficiary;
      case "accountNumber": return isEditing ? inp("accountNumber") : r.accountNumber;
      case "sortCode": return isEditing ? inp("sortCode") : r.sortCode;
      case "department": return isEditing ? <select value={editDraft?.departmentId ?? ""} onChange={e => onChangeDraft("departmentId", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">Select...</option>{departmentPairs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select> : <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">{r.department}</span>;
      case "department2": return isEditing ? inp("department2") : r.department2;
      case "serviceDaysCount": return isEditing ? inp("serviceDaysCount", "number") : r.serviceDaysCount;
      case "days": return isEditing ? inp("days") : <span className="max-w-[120px] truncate block" title={r.days}>{r.days}</span>;
      case "serviceRate": return isEditing ? inp("serviceRate") : r.serviceRate;
      case "month": return isEditing ? inp("month") : <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{r.month}</span>;
      case "bookedBy": return isEditing ? inp("bookedBy") : r.bookedBy;
      case "serviceDescription": return isEditing ? inp("serviceDescription") : <span className="max-w-[180px] truncate block" title={r.serviceDescription}>{r.serviceDescription}</span>;
      case "additionalCostReason": return isEditing ? inp("additionalCostReason") : r.additionalCostReason;
      case "deptManager": return isEditing && currentRole === "admin" ? <select value={editDraft?.deptManagerId ?? ""} onChange={e => onChangeDraft("deptManagerId", e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">Unassigned</option>{(managerProfilePairs ?? profilePairs).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select> : r.deptManager;
      case "bookingForm": {
        const hasBookingForm = ["approved_by_manager", "pending_admin", "ready_for_payment", "paid", "archived"].includes(r.status);
        if (!hasBookingForm) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => void viewBookingForm(r.id, r.contractor, r.month)} className="rounded bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-500 flex items-center gap-1" title="View Booking Form">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              View
            </button>
            <button onClick={() => void downloadBookingForm(r.id, r.contractor, r.month)} className="rounded bg-slate-600 px-2 py-0.5 text-xs text-white hover:bg-slate-500" title="Download Booking Form">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            </button>
          </div>
        );
      }
      case "actions": {
        if (editingId === r.id) return <div className="flex items-center gap-1"><span className="text-xs text-blue-600">Editing{r.status === "rejected" ? " (will resubmit)" : ""}</span><button onClick={e => { e.stopPropagation(); onCancelEdit(); }} className="text-xs text-gray-400 hover:text-gray-600">✕</button></div>;
        const canRS = r.status === "rejected" && (isSubmitter || currentRole === "admin");
        const canSendEmails = currentRole === "admin" && ["ready_for_payment", "paid", "archived"].includes(r.status);
        return <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>{canRS && <button onClick={() => void onResubmit(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50">{actionLoadingId === r.id ? "…" : "↻ Resubmit"}</button>}{canSendEmails && <button onClick={() => void sendBookingFormEmails(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-violet-600 px-2 py-0.5 text-xs text-white hover:bg-violet-500 disabled:opacity-50" title="Send Booking Form emails to Line Manager and London Operations">{actionLoadingId === r.id ? "…" : "📧 Send"}</button>}</div>;
      }
      default: return "—";
    }
  };

  /* ---------- RENDER ---------- */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Freelancer Invoices</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDashboard(!showDashboard)} className={`rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition-all flex items-center gap-1.5 ${showDashboard ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"}`}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
            Dashboard
          </button>
          <button onClick={() => void exportToExcel(filteredRows)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors shadow-sm">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export Excel
          </button>
          <button onClick={() => void exportToPdf(filteredRows)} className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 transition-colors shadow-sm">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
            Export PDF
          </button>
          <div ref={columnsAnchorRef}>
            <button onClick={() => setShowColumnPicker(!showColumnPicker)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>
              Columns
            </button>
          </div>
          {currentRole !== "viewer" && (
            <Link href="/freelancer-invoices/submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 transition-all flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Invoice
            </Link>
          )}
        </div>
      </div>

      {/* Column Picker Portal */}
      {hydrated && showColumnPicker && columnPickerPos && createPortal(
        <div id="fl-columns-portal" className="fixed z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 p-2 max-h-96 overflow-y-auto" style={{ top: columnPickerPos.top, left: columnPickerPos.left }}>
          <p className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Toggle Columns</p>
          {ALL_COLUMNS.filter(c => c.key !== "actions").map(c => (
            <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={() => toggleColumn(c.key)} className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" />
              {c.label || c.key}
            </label>
          ))}
        </div>,
        document.body
      )}

      {/* Dashboard */}
      {showDashboard && (
        <Suspense fallback={<div className="text-center py-8 text-gray-400">Loading dashboard...</div>}>
          <FreelancerDashboard invoices={filteredRows.map(r => ({ id: r.id, created_at: r.createdAt, status: r.status, amount: String(r.amountNum), department: r.department, contractor: r.contractor, bookedBy: r.bookedBy, month: r.month, group: r.group, serviceDescription: r.serviceDescription }))} />
        </Suspense>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contractor, company, beneficiary..." className="w-56 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">All Departments</option>{departmentPairs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">All Months</option>{uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">All Status</option>{GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}</select>
          <select value={managerFilter} onChange={e => setManagerFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">All Managers</option>{profilePairs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <select value={bookedByFilter} onChange={e => setBookedByFilter(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value="">All Booked By</option>{uniqueBookedBy.map(b => <option key={b} value={b}>{b}</option>)}</select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" title="From" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" title="To" />
          {hasFilter && <button onClick={clearFilters} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">Clear Filters</button>}
          <span className="ml-auto text-xs text-gray-400">{filteredRows.length} of {rows.length}</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 shadow-sm dark:border-blue-800 dark:bg-blue-950/30">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{selectedIds.size} selected</span>
          {selectedIds.size === 2 && (
            <button onClick={() => setCompareIds(Array.from(selectedIds))} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 transition-colors shadow-sm flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
              Compare
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {(currentRole === "admin" || currentRole === "manager") && <>
              <button onClick={() => void bulkApprove()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 shadow-sm">Bulk Approve</button>
              <button onClick={() => void bulkReject()} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 shadow-sm">Bulk Reject</button>
            </>}
            <button onClick={() => void bulkDownload()} disabled={bulkDownloading} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50 shadow-sm flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
              {bulkDownloading ? "Downloading..." : `Download Files (${selectedIds.size})`}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 shadow-sm">Clear</button>
          </div>
        </div>
      )}

      {/* Groups */}
      {GROUPS.map(g => {
        const gRows = groupedRows[g.key] ?? [];
        if (gRows.length === 0 && g.key === "rejected" && !groupFilter) return null;
        const collapsed = collapsedGroups.has(g.key);
        const sums = groupSums[g.key];
        return (
          <div key={g.key} className={`rounded-xl border-l-4 ${g.color} bg-white shadow-md dark:bg-slate-800 overflow-hidden`}>
            <button onClick={() => toggleGroup(g.key)} className={`w-full flex items-center justify-between px-4 py-3 ${g.headerBg} transition-colors hover:opacity-90`}>
              <div className="flex items-center gap-2">
                <svg className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-90"}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                <h2 className={`text-sm font-bold ${g.textColor}`}>{g.label}</h2>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-slate-700 dark:text-slate-300">{gRows.length}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                {sums.amount > 0 && <span>Amount: <strong>{fmtCurrency(sums.amount)}</strong></span>}
                {sums.invoiceAmount > 0 && <span>Invoice: <strong>{fmtCurrency(sums.invoiceAmount)}</strong></span>}
              </div>
            </button>
            {!collapsed && (
              <div className="overflow-x-auto">
                <table className="min-w-[2600px] w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead className="bg-slate-50 dark:bg-slate-700/50"><tr>
                    <th className="px-2 py-2 w-8"><input type="checkbox" checked={gRows.length > 0 && gRows.every(r => selectedIds.has(r.id))} onChange={e => onToggleAll(gRows.map(r => r.id), e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" /></th>
                    {COLUMNS.map(c => <th key={c.key} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{c.label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {gRows.length === 0 && <tr><td colSpan={COLUMNS.length + 1} className="px-4 py-6 text-center text-sm text-gray-400">No invoices</td></tr>}
                    {gRows.map(r => {
                      const isEditing = editingId === r.id;
                      const editable = canEditRow(r);
                      const editTdCls = editable && !isEditing ? " cursor-text hover:bg-blue-50/60 dark:hover:bg-blue-950/20" : "";
                      const isDuplicate = duplicates.has(r.id);
                      return (
                        <React.Fragment key={r.id}>
                          <tr data-row-id={r.id} className={`${isDuplicate ? "bg-yellow-50 dark:bg-yellow-900/10 " : ""}${r.status === "rejected" ? "bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/30" : isEditing ? "bg-blue-50 ring-2 ring-blue-400 ring-inset dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"} transition-colors cursor-pointer`} onClick={() => { if (!isEditing) handleRowClick(r.id); }} onDoubleClick={handleRowDblClick}>
                            <td className="px-2 py-2 w-8" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => onToggleSelect(r.id)} className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" />
                                {isDuplicate && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-bold text-yellow-900" title="Possible duplicate (same contractor + amount)">!</span>}
                              </div>
                            </td>
                            {COLUMNS.map(c => {
                              const noEdit = ["status", "files", "submittedBy", "submissionDate", "invoiceAmount", "amount", "actions", "bookingForm"].includes(c.key);
                              return (
                                <td key={c.key} className={`px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap${!noEdit ? editTdCls : ""}`} onDoubleClick={!noEdit && editable && !isEditing ? e => { e.stopPropagation(); e.preventDefault(); handleRowDblClick(); onStartEdit(r); } : undefined}>
                                  {renderCell(r, c.key, isEditing)}
                                </td>
                              );
                            })}
                          </tr>
                          {expandedRowId === r.id && (
                            <tr><td colSpan={COLUMNS.length + 1} className="bg-slate-50 px-6 py-4 dark:bg-slate-800/50">
                              {detailLoading ? <div className="flex items-center gap-2 text-sm text-gray-500"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" /></svg>Loading...</div> : (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                  <div>
                                    <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Timeline</h4>
                                    {timelineData.length === 0 ? <p className="text-xs text-gray-400">No events yet.</p> : <div className="space-y-2 max-h-60 overflow-y-auto">{timelineData.map(ev => { const ch = (ev.payload as Record<string, unknown>)?.changes as Record<string, { from: string; to: string }> | undefined; const hc = ch && Object.keys(ch).length > 0; const ic = ev.event_type === "invoice_updated" ? "bg-amber-400" : ev.event_type.includes("reject") ? "bg-red-400" : ev.event_type.includes("approv") ? "bg-green-400" : ev.event_type.includes("paid") ? "bg-purple-400" : "bg-blue-400"; return (<div key={ev.id} className="flex items-start gap-2 text-xs"><div className={`mt-0.5 h-2 w-2 rounded-full ${ic} flex-shrink-0`} /><div className="flex-1 min-w-0"><span className="font-medium text-gray-700 dark:text-gray-300">{ev.actor_name}</span><span className="text-gray-500"> — {ev.event_type.replace(/_/g, " ")}</span>{ev.from_status && ev.to_status && <span className="text-gray-400"> ({ev.from_status} → {ev.to_status})</span>}{ev.payload && typeof (ev.payload as Record<string, string>).rejection_reason === "string" && <span className="text-red-600"> — {(ev.payload as Record<string, string>).rejection_reason}</span>}{hc && <div className="mt-1 space-y-0.5 rounded bg-gray-50 border border-gray-200 px-2 py-1.5 dark:bg-gray-800 dark:border-gray-700">{Object.entries(ch!).map(([f, { from, to }]) => <div key={f} className="flex items-center gap-1 text-[11px]"><span className="font-medium text-gray-600 capitalize dark:text-gray-400">{f.replace(/_/g, " ")}:</span><span className="text-red-500 line-through">{from || "—"}</span><span className="text-gray-400">→</span><span className="text-green-600 font-medium">{to || "—"}</span></div>)}</div>}<div className="text-gray-400 mt-0.5">{new Date(ev.created_at).toLocaleString("en-GB")}</div></div></div>); })}</div>}
                                  </div>
                                  <div>
                                    <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Notes</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto mb-2">{notesData.length === 0 ? <p className="text-xs text-gray-400">No notes yet.</p> : notesData.map(n => <div key={n.id} className="rounded border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"><div className="flex justify-between"><span className="font-medium text-gray-700 dark:text-gray-300">{n.author_name}</span><span className="text-gray-400">{new Date(n.created_at).toLocaleString("en-GB")}</span></div><p className="mt-1 text-gray-600 dark:text-gray-400">{n.content}</p></div>)}</div>
                                    <div className="flex gap-2"><input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white" onKeyDown={e => { if (e.key === "Enter") void addNote(); }} /><button onClick={() => void addNote()} className="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600">Add</button></div>
                                  </div>
                                </div>
                              )}
                            </td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot><tr className="bg-slate-50 dark:bg-slate-700/50"><td className="px-2 py-2"></td>{COLUMNS.map(c => <td key={c.key} className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300">{c.key === "additionalCost" ? fmtCurrency(sums.additional) : c.key === "amount" ? fmtCurrency(sums.amount) : c.key === "invoiceAmount" ? fmtCurrency(sums.invoiceAmount) : ""}</td>)}</tr></tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Rejection Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setRejectModalId(null); setRejectReason(""); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Reject Invoice</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">The submitter will be notified and can make corrections then resubmit.</p>
            <textarea autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => { setRejectModalId(null); setRejectReason(""); }} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => void submitReject()} disabled={!rejectReason.trim() || actionLoadingId === rejectModalId} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 shadow-sm">{actionLoadingId === rejectModalId ? "Rejecting..." : "Reject Invoice"}</button>
            </div>
          </div>
        </div>
      )}

      {(previewUrl || previewHtml) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closePreview}>
          <div className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 truncate dark:text-white">{previewName}</h3>
              <div className="flex items-center gap-2">
                {previewDownloadUrl && (
                  <button onClick={() => void downloadFile(previewDownloadUrl, previewName || "invoice")} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    Download
                  </button>
                )}
                <button onClick={closePreview} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors">✕</button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewUrl && <iframe src={previewUrl} className="h-full w-full border-0" title="File preview" />}
              {previewHtml && <div className="h-full w-full overflow-auto p-6 prose prose-sm max-w-none dark:prose-invert [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold dark:[&_td]:border-gray-600 dark:[&_th]:border-gray-600 dark:[&_th]:bg-gray-800" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {compareIds.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCompareIds([])}>
          <div className="relative w-[95vw] max-w-6xl max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="h-5 w-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                Invoice Comparison
              </h3>
              <button onClick={() => setCompareIds([])} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">✕</button>
            </div>
            <CompareTable rows={rows} ids={compareIds} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SUB COMPONENTS                                                      */
/* ------------------------------------------------------------------ */

function unwrap<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function StatusCell({ r, canApprove, isSubmitter, currentRole, isOperationsRoomMember, actionLoadingId, onManagerApprove, onAdminApprove, onResubmit, onMarkPaid, openRejectModal }: {
  r: DisplayRow; canApprove: boolean; isSubmitter: boolean; currentRole: string; isOperationsRoomMember: boolean; actionLoadingId: string | null;
  onManagerApprove: (id: string) => void; onAdminApprove: (id: string) => void; onResubmit: (id: string) => void; onMarkPaid: (id: string) => void; openRejectModal: (id: string) => void;
}) {
  const loading = actionLoadingId === r.id;
  const btn = (fn: () => void, title: string, label: string, cls: string) => <button onClick={fn} disabled={loading} title={title} className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-white disabled:opacity-50 transition-colors shadow-sm ${cls}`}>{loading ? "…" : label}</button>;
  const canOpsRoomApprove = isOperationsRoomMember && (r.status === "approved_by_manager" || r.status === "pending_admin");
  const canAdminApprove = currentRole === "admin" && (r.status === "approved_by_manager" || r.status === "pending_admin");

  if (r.status === "pending_manager" && canApprove) return <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>{btn(() => onManagerApprove(r.id), "Approve", "✓", "bg-amber-400 hover:bg-emerald-500")}{btn(() => openRejectModal(r.id), "Reject", "✗", "bg-amber-400 hover:bg-red-500")}</div>;
  if ((canAdminApprove || canOpsRoomApprove) && canApprove) return <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>{btn(() => onAdminApprove(r.id), canOpsRoomApprove ? "Approve" : "Admin Approve", "✓", "bg-orange-400 hover:bg-emerald-500")}{currentRole === "admin" && btn(() => openRejectModal(r.id), "Reject", "✗", "bg-orange-400 hover:bg-red-500")}</div>;
  if ((r.status === "approved_by_manager" || r.status === "pending_admin")) return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600 shadow-sm" title="The Operations Room">○</span>;
  if (r.status === "rejected") return <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm" title={r.rejectionReason || "Rejected"}>✗</span>{(isSubmitter || currentRole === "admin") && btn(() => onResubmit(r.id), "Resubmit", "↻", "bg-emerald-500 hover:bg-emerald-600 text-sm")}</div>;
  if (r.status === "ready_for_payment" && (currentRole === "admin" || currentRole === "finance")) return <div onClick={e => e.stopPropagation()}>{btn(() => onMarkPaid(r.id), "Mark Paid", "£", "bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white")}</div>;
  if (r.status === "paid" || r.status === "archived") return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm" title="Paid">✓</span>;
  if (r.status === "ready_for_payment") return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-600 shadow-sm" title="Ready">✓</span>;
  const pd = daysSince(r.createdAt);
  return <div className="flex items-center justify-center gap-1"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm" title="Pending">○</span>{pd >= 3 && <span className={`text-[9px] font-bold ${pd >= 7 ? "text-red-600" : "text-orange-500"}`}>{pd}d</span>}</div>;
}

function SubmitterBadge({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500", "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-indigo-500"];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return <div className="group relative inline-flex items-center"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${colors[idx]}`}>{initials || "?"}</span><span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">{name}</span></div>;
}

function CompareTable({ rows, ids }: { rows: DisplayRow[]; ids: string[] }) {
  const a = rows.find(r => r.id === ids[0]);
  const b = rows.find(r => r.id === ids[1]);
  if (!a || !b) return <p className="text-sm text-gray-500">Could not find the selected invoices.</p>;

  const fields: { label: string; key: keyof DisplayRow }[] = [
    { label: "Contractor", key: "contractor" }, { label: "Company Name", key: "companyName" },
    { label: "Submitted by", key: "submittedBy" }, { label: "Submission Date", key: "submissionDate" },
    { label: "Service Description", key: "serviceDescription" }, { label: "Department", key: "department" },
    { label: "Department 2", key: "department2" }, { label: "Booked by", key: "bookedBy" },
    { label: "Service Days", key: "serviceDaysCount" }, { label: "Month", key: "month" },
    { label: "Days", key: "days" }, { label: "Rate/Day", key: "serviceRate" },
    { label: "Additional Cost", key: "additionalCost" }, { label: "Add. Cost Reason", key: "additionalCostReason" },
    { label: "Amount", key: "amount" }, { label: "Invoice Amount", key: "invoiceAmount" },
    { label: "INV Number", key: "invNumber" }, { label: "Beneficiary", key: "beneficiary" },
    { label: "Account Number", key: "accountNumber" }, { label: "Sort Code", key: "sortCode" },
    { label: "Department Manager", key: "deptManager" },
    { label: "Status", key: "status" }, { label: "Rejection Reason", key: "rejectionReason" },
  ];

  return (
    <table className="w-full text-sm">
      <thead><tr><th className="border-b border-gray-200 px-4 py-2 text-left font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400 w-1/5">Field</th><th className="border-b border-gray-200 px-4 py-2 text-left font-semibold text-blue-700 dark:border-gray-700 dark:text-blue-400 w-2/5">Invoice 1</th><th className="border-b border-gray-200 px-4 py-2 text-left font-semibold text-purple-700 dark:border-gray-700 dark:text-purple-400 w-2/5">Invoice 2</th></tr></thead>
      <tbody>
        {fields.map(f => {
          const va = String(a[f.key] ?? "—");
          const vb = String(b[f.key] ?? "—");
          const diff = va !== vb;
          return (
            <tr key={f.key} className={diff ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}>
              <td className="border-b border-gray-100 px-4 py-2 font-medium text-gray-600 dark:border-gray-700 dark:text-gray-400">{f.label}</td>
              <td className={`border-b border-gray-100 px-4 py-2 dark:border-gray-700 ${diff ? "font-semibold text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-300"}`}>{va}</td>
              <td className={`border-b border-gray-100 px-4 py-2 dark:border-gray-700 ${diff ? "font-semibold text-purple-700 dark:text-purple-300" : "text-gray-700 dark:text-gray-300"}`}>{vb}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
