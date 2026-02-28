"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/error-messages";
import { OtherDashboard } from "./OtherDashboard";
import { useExportLocale } from "@/contexts/ExportLocaleContext";
import { ExportLocaleSelector } from "./ExportLocaleSelector";
import { LogoLoader } from "./LogoLoader";
import { UploadOverlay } from "./UploadOverlay";
import { triggerPaidAnimation } from "./PaidIconOverlay";

function unwrap<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function fmtAmount(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null) return "—";
  const cur = (currency ?? "GBP") as string;
  const sym = cur === "USD" ? "$" : cur === "EUR" ? "€" : "£";
  return `${sym}${Number(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cleanPurpose(desc: string | null | undefined): string {
  if (!desc?.trim()) return "—";
  const s = desc.trim();
  if (s.toLowerCase().startsWith("other invoice:")) return "—";
  return s;
}

type ApiRow = {
  id: string;
  service_description?: string | null;
  created_at: string;
  storage_path?: string | null;
  submitter_user_id?: string | null;
  submitted_by?: string | null;
  invoice_workflows: { status?: string; paid_date?: string | null }[] | { status?: string; paid_date?: string | null } | null;
  invoice_extracted_fields: {
    beneficiary_name?: string | null;
    invoice_number?: string | null;
    invoice_date?: string | null;
    gross_amount?: number | null;
    extracted_currency?: string | null;
    account_number?: string | null;
    sort_code?: string | null;
    raw_json?: { company_name?: string | null; due_date?: string | null };
  }[] | {
    beneficiary_name?: string | null;
    invoice_number?: string | null;
    invoice_date?: string | null;
    gross_amount?: number | null;
    extracted_currency?: string | null;
    account_number?: string | null;
    sort_code?: string | null;
    raw_json?: { company_name?: string | null; due_date?: string | null };
  } | null;
  invoice_files?: { storage_path: string; file_name: string }[] | null;
};

type DisplayRow = {
  id: string;
  submitterId: string | null;
  amount: string;
  amountNum: number;
  currency: string;
  beneficiary: string;
  sortCode: string;
  accountNumber: string;
  invNumber: string;
  submittedBy: string;
  files: { storage_path: string; file_name: string }[];
  companyName: string;
  invDate: string;
  dueDate: string;
  purpose: string;
  status: string;
  group: string;
  createdAt: string;
  paidDate: string;
};

const ALL_COLUMNS = [
  { key: "status", label: "✓" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "beneficiary", label: "Beneficiary" },
  { key: "sortCode", label: "Sort Code" },
  { key: "accountNumber", label: "Account No" },
  { key: "invNumber", label: "INV Number" },
  { key: "submittedBy", label: "Submitted by" },
  { key: "files", label: "Files" },
  { key: "companyName", label: "Company Name" },
  { key: "invDate", label: "INV date" },
  { key: "dueDate", label: "Due date" },
  { key: "purpose", label: "Purpose" },
  { key: "actions", label: "" },
];

const DEFAULT_VISIBLE = ["status", "amount", "currency", "beneficiary", "sortCode", "accountNumber", "invNumber", "submittedBy", "files", "companyName", "invDate", "dueDate", "purpose", "actions"];
const COL_STORAGE_KEY = "other_visible_columns";

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s) as T;
  } catch { /* */ }
  return fallback;
}

function statusToGroup(status: string): string {
  if (status === "ready_for_payment") return "ready_for_payment";
  if (status === "paid" || status === "archived") return "paid";
  return "ready_for_payment";
}

export function OtherInvoicesBoard({
  invoices,
  currentRole,
  currentUserId,
  canUpload,
  initialExpandedId,
}: {
  invoices: ApiRow[];
  currentRole: string;
  currentUserId?: string;
  canUpload: boolean;
  initialExpandedId?: string;
}) {
  const router = useRouter();

  const rows: DisplayRow[] = useMemo(
    () =>
      invoices.map((inv) => {
        const wf = unwrap(inv.invoice_workflows);
        const ext = unwrap(inv.invoice_extracted_fields);
        const raw = ext?.raw_json;
        const cur = (ext?.extracted_currency ?? "GBP") as string;
        const amt = ext?.gross_amount ?? 0;
        const files = inv.invoice_files ?? [];
        return {
          id: inv.id,
          submitterId: (inv as { submitter_user_id?: string }).submitter_user_id ?? null,
          amount: fmtAmount(amt, cur),
          amountNum: Number.isFinite(amt) ? amt : 0,
          currency: cur,
          beneficiary: ext?.beneficiary_name ?? "—",
          sortCode: ext?.sort_code ?? "—",
          accountNumber: ext?.account_number ?? "—",
          invNumber: ext?.invoice_number ?? "—",
          submittedBy: inv.submitted_by ?? "—",
          files: Array.isArray(files) ? files : [],
          companyName: (raw?.company_name as string) ?? "—",
          invDate: ext?.invoice_date ?? "—",
          dueDate: (raw?.due_date as string) ?? "—",
          purpose: cleanPurpose(inv.service_description),
          status: wf?.status ?? "ready_for_payment",
          group: statusToGroup(wf?.status ?? "ready_for_payment"),
          createdAt: inv.created_at,
          paidDate: wf?.paid_date ?? "",
        };
      }),
    [invoices]
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [submittedByFilter, setSubmittedByFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDashboard, setShowDashboard] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([...DEFAULT_VISIBLE]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnsAnchorRef = useRef<HTMLDivElement>(null);
  const [columnPickerPos, setColumnPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | "bulk" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(initialExpandedId ?? null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<{ id: string; event_type: string; created_at: string; actor_name?: string; from_status?: string; to_status?: string; payload?: unknown }[]>([]);

  const hasFilter = !!(search || statusFilter || submittedByFilter || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setSubmittedByFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter && r.group !== statusFilter) return false;
        if (submittedByFilter && r.submittedBy !== submittedByFilter) return false;
        if (dateFrom && r.createdAt < dateFrom) return false;
        if (dateTo && r.createdAt > dateTo + "T23:59:59") return false;
        if (search) {
          const q = search.toLowerCase();
          const hay = [
            r.beneficiary,
            r.companyName,
            r.submittedBy,
            r.invNumber,
            r.purpose,
            r.amount,
            r.currency,
          ].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [rows, search, statusFilter, submittedByFilter, dateFrom, dateTo]
  );

  const uniqueSubmittedBy = useMemo(
    () => Array.from(new Set(rows.map((r) => r.submittedBy).filter((b) => b !== "—"))).sort(),
    [rows]
  );

  useEffect(() => {
    setHydrated(true);
    const stored = loadStorage<string[]>(COL_STORAGE_KEY, [...DEFAULT_VISIBLE]);
    const normalized = DEFAULT_VISIBLE.filter((k) => stored.includes(k));
    setVisibleColumns(normalized.length > 0 ? normalized : [...DEFAULT_VISIBLE]);
  }, []);

  useEffect(() => {
    if (!showColumnPicker) {
      setColumnPickerPos(null);
      return;
    }
    const updatePos = () => {
      if (columnsAnchorRef.current) {
        const r = columnsAnchorRef.current.getBoundingClientRect();
        setColumnPickerPos({ top: r.bottom + 4, left: r.right - 224 });
      }
    };
    updatePos();
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (columnsAnchorRef.current?.contains(t)) return;
      const portal = document.getElementById("other-columns-portal");
      if (portal?.contains(t)) return;
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

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const COLUMNS = ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key));

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setUploading(true);
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append(`file_${i}`, files[i]);
      }
      try {
        const res = await fetch("/api/other-invoices/upload", { method: "POST", body: formData });
        const data = (await res.json().catch(() => ({}))) as { results?: { id: string; fileName: string; error?: string }[]; error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "Upload failed");
          return;
        }
        const results = data.results ?? [];
        const ok = results.filter((r) => r.id).length;
        const err = results.filter((r) => r.error).length;
        if (ok > 0) toast.success(`${ok} invoice(s) uploaded. AI extraction running.`);
        if (err > 0) toast.error(`${err} failed: ${results.filter((r) => r.error).map((r) => r.error).join("; ")}`);
        e.target.value = "";
        refresh();
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [refresh]
  );

  const onMarkPaid = useCallback(
    async (id: string) => {
      setActionLoadingId(id);
      try {
        const res = await fetch(`/api/invoices/${id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_status: "paid", paid_date: new Date().toISOString().slice(0, 10) }),
        });
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.ok) {
          triggerPaidAnimation();
          toast.success("Marked as paid");
          refresh();
        } else {
          toast.error(d.error ?? "Failed");
        }
      } catch {
        toast.error("Failed");
      } finally {
        setActionLoadingId(null);
      }
    },
    [refresh]
  );

  const bulkMarkPaid = useCallback(async () => {
    const ids = Array.from(selectedIds).filter((id) => {
      const r = rows.find((x) => x.id === id);
      return r?.status === "ready_for_payment";
    });
    if (ids.length === 0) return;
    setActionLoadingId("bulk");
    try {
      const res = await fetch("/api/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_ids: ids,
          to_status: "paid",
          paid_date: new Date().toISOString().slice(0, 10),
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { success?: number; failed?: { id: string; error: string }[] };
      if (res.ok) {
        const s = d.success ?? 0;
        const f = d.failed?.length ?? 0;
        if (s > 0) {
          triggerPaidAnimation();
          toast.success(`${s} marked as paid`);
        }
        if (f > 0) toast.error(`${f} failed`);
        setSelectedIds(new Set());
        refresh();
      } else {
        toast.error((d as { error?: string }).error ?? "Failed");
      }
    } catch {
      toast.error("Failed");
    } finally {
      setActionLoadingId(null);
    }
  }, [selectedIds, rows, refresh]);

  const onDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this invoice? This cannot be undone.")) return;
      setDeletingId(id);
      try {
        const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("Deleted");
          refresh();
        } else {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(getApiErrorMessage(d));
        }
      } catch {
        toast.error("Delete failed");
      } finally {
        setDeletingId(null);
      }
    },
    [refresh]
  );

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} invoice(s)? This cannot be undone.`)) return;
    setDeletingId("bulk");
    try {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
        const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
        if (res.ok) ok++;
        else fail++;
      }
      if (ok > 0) toast.success(`${ok} deleted`);
      if (fail > 0) toast.error(`${fail} failed`);
      setSelectedIds(new Set());
      refresh();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }, [selectedIds, refresh]);

  const bulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch("/api/invoices/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        toast.error("Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `other-invoices-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBulkDownloading(false);
    }
  }, [selectedIds]);

  const openFile = useCallback(async (id: string, path?: string, fileName?: string) => {
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewHtml(null);
    try {
      const url = path ? `/api/invoices/${id}/pdf?path=${encodeURIComponent(path)}` : `/api/invoices/${id}/pdf`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.url) return;
      setPreviewName(fileName ?? path?.split("/").pop() ?? "File");
      const fileRes = await fetch(data.url);
      const blob = await fileRes.blob();
      const mime = blob.type.toLowerCase();
      const fileUrl = (data.url as string).toLowerCase();
      if (mime.includes("pdf") || fileUrl.includes(".pdf")) {
        setPreviewHtml(null);
        setPreviewUrl(URL.createObjectURL(blob));
      } else if (mime.includes("word") || mime.includes("docx") || fileUrl.includes(".docx") || fileUrl.includes(".doc")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        setPreviewUrl(null);
        setPreviewHtml(result.value);
      } else if (mime.includes("sheet") || mime.includes("excel") || fileUrl.includes(".xlsx") || fileUrl.includes(".xls")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
        let html = "";
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          html += `<h3 style="margin:16px 0 8px;font-weight:bold;font-size:14px;">${name}</h3>`;
          html += XLSX.utils.sheet_to_html(ws, { editable: false });
        }
        setPreviewUrl(null);
        setPreviewHtml(html);
      } else {
        setPreviewHtml(null);
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch { /* */ }
    finally {
      setPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewHtml(null);
    setPreviewName("");
    setPreviewLoading(false);
  }, [previewUrl]);

  const { locale: exportLocale } = useExportLocale();
  const exportToPdf = useCallback(async (data: DisplayRow[]) => {
    const { getFormatters } = await import("@/lib/export-locale");
    const { formatDate, formatCurrency } = getFormatters(exportLocale);
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const { ensurePdfFont } = await import("@/lib/pdf-font");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    await ensurePdfFont(doc);
    doc.setFontSize(14);
    doc.text("Other Invoices Report", 14, 15);
    doc.setFontSize(8);
    doc.text(`Generated: ${formatDate(new Date())} | ${data.length} invoices`, 14, 20);
    autoTable(doc, {
      startY: 25,
      styles: { font: "Roboto", fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      head: [["Amount", "Currency", "Beneficiary", "Sort Code", "Account No", "INV Number", "Submitted by", "Company", "INV date", "Due date", "Purpose", "Status"]],
      body: data.map((r) => [
        formatCurrency(r.amountNum),
        r.currency,
        r.beneficiary,
        r.sortCode,
        r.accountNumber,
        r.invNumber,
        r.submittedBy,
        r.companyName,
        formatDate(r.invDate),
        formatDate(r.dueDate),
        r.purpose,
        r.status,
      ]),
    });
    doc.save(`other-invoices-${new Date().toISOString().split("T")[0]}.pdf`);
  }, [exportLocale]);

  const exportToExcel = useCallback(async (data: DisplayRow[]) => {
    const { getFormatters } = await import("@/lib/export-locale");
    const { formatDate, formatCurrency } = getFormatters(exportLocale);
    const XLSX = await import("xlsx");
    const xlsRows = data.map((r) => ({
      Amount: formatCurrency(r.amountNum),
      Currency: r.currency,
      Beneficiary: r.beneficiary,
      "Sort Code": r.sortCode,
      "Account No": r.accountNumber,
      "INV Number": r.invNumber,
      "Submitted by": r.submittedBy,
      "Company Name": r.companyName,
      "INV date": formatDate(r.invDate),
      "Due date": formatDate(r.dueDate),
      Purpose: r.purpose,
      Status: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(xlsRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Other Invoices");
    XLSX.writeFile(wb, `other-invoices-${new Date().toISOString().split("T")[0]}.xlsx`, { bookSST: true });
  }, [exportLocale]);

  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!expandedRowId) {
      setTimelineData([]);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/invoices/${expandedRowId}/timeline`)
      .then((r) => r.json())
      .then((data) => setTimelineData(Array.isArray(data) ? data : []))
      .catch(() => setTimelineData([]))
      .finally(() => setDetailLoading(false));
  }, [expandedRowId]);

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

  const readyIds = rows.filter((r) => r.status === "ready_for_payment").map((r) => r.id);
  const selectedReady = Array.from(selectedIds).filter((id) => readyIds.includes(id));

  const canMarkPaid = currentRole === "admin" || currentRole === "finance" || currentRole === "operations";
  const canDelete = currentRole === "admin" || currentRole === "finance" || currentRole === "operations";

  return (
    <div className="space-y-4 text-slate-800 dark:text-slate-100 max-w-full min-w-0 overflow-x-hidden">
      {uploading && <UploadOverlay message="Uploading..." />}
      {actionLoadingId && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div className="h-full w-1/3 bg-blue-500 animate-loading-bar" />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white shrink-0">Other Invoices</h1>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className={`rounded-xl px-3 py-2 text-sm font-medium shadow-sm transition-all flex items-center gap-1.5 ${showDashboard ? "bg-[#5034FF] text-white shadow-[#5034FF]/25" : "bg-blue-500 text-white hover:bg-blue-600 shadow-blue-500/25 dark:bg-blue-600 dark:hover:bg-blue-500"}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Dashboard
          </button>
          <ExportLocaleSelector />
          <button onClick={() => void exportToExcel(filteredRows)} className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors shadow-sm">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export Excel
          </button>
          <button onClick={() => void exportToPdf(filteredRows)} className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 transition-colors shadow-sm">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            Export PDF
          </button>
          <div ref={columnsAnchorRef}>
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="rounded-xl bg-slate-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-400 flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
              </svg>
              Columns
            </button>
          </div>
          {canUpload && (
            <label className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5">
              <input type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg" onChange={handleUpload} disabled={uploading} className="hidden" />
              {uploading ? (
                <>
                  <LogoLoader size="sm" variant="light" />
                  <span>Uploading...</span>
                </>
              ) : (
                "Upload files"
              )}
            </label>
          )}
          <Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Column Picker Portal */}
      {hydrated && showColumnPicker && columnPickerPos &&
        createPortal(
          <div
            id="other-columns-portal"
            className="fixed z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 p-2 max-h-96 overflow-y-auto"
            style={{ top: columnPickerPos.top, left: columnPickerPos.left }}
          >
            <p className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Toggle Columns</p>
            {ALL_COLUMNS.filter((c) => c.key !== "actions").map((c) => (
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
          <OtherDashboard
            invoices={filteredRows.map((r) => ({
              id: r.id,
              created_at: r.createdAt,
              status: r.status,
              amount: r.amountNum,
              group: r.group,
              beneficiary: r.beneficiary,
              submittedBy: r.submittedBy,
            }))}
          />
        </Suspense>
      )}

      {/* Filters */}
      <div className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800 overflow-hidden ${selectedIds.size > 0 ? "relative z-40" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto md:overflow-visible min-w-0">
          <div className="relative flex-1 min-w-[140px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search beneficiary, company, invoice no..."
              className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="ready_for_payment">Pending payment</option>
            <option value="paid">Paid</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={submittedByFilter}
            onChange={(e) => setSubmittedByFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Submitters</option>
            {uniqueSubmittedBy.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" title="From" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" title="To" />
          {hasFilter && (
            <button onClick={clearFilters} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400">
              Clear Filters
            </button>
          )}
          {selectedIds.size > 0 && (
            <button onClick={() => void bulkDownload()} disabled={bulkDownloading} className="inline-flex items-center gap-1 rounded-xl bg-[#5034FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#4030dd] disabled:opacity-50 transition-colors shadow-sm">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              {bulkDownloading ? "Downloading..." : `Download Files (${selectedIds.size})`}
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filteredRows.length} of {rows.length}</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-blue-500 bg-blue-50 px-4 py-3 shadow-2xl dark:border-blue-400 dark:bg-blue-950/50"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">{selectedIds.size}</span>
            selected
          </span>
          {selectedReady.length > 0 && canMarkPaid && (
            <button
              onClick={() => void bulkMarkPaid()}
              disabled={actionLoadingId === "bulk"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Mark as paid
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => void bulkDelete()}
              disabled={deletingId === "bulk"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Delete
            </button>
          )}
          <button onClick={() => void bulkDownload()} disabled={bulkDownloading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#5034FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4030dd] disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            {bulkDownloading ? "Downloading..." : `Download Files (${selectedIds.size})`}
          </button>
          <button onClick={() => void exportToExcel(filteredRows.filter((r) => selectedIds.has(r.id)))} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Excel Export
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
            ✕ Close
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No invoices. Upload files to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id))}
                      onChange={(e) => onToggleAll(filteredRows.map((r) => r.id), e.target.checked)}
                    />
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredRows.map((r) => (
                  <React.Fragment key={r.id}>
                  <tr
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${expandedRowId === r.id ? "bg-sky-50/50 dark:bg-sky-950/20" : ""}`}
                    onClick={() => toggleExpand(r.id)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => onToggleSelect(r.id)} />
                    </td>
                    {COLUMNS.map((col) => {
                      if (col.key === "status") {
                        return (
                          <td key={col.key} className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                r.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : r.status === "ready_for_payment" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {r.status === "paid" ? "Paid" : r.status === "ready_for_payment" ? "Pending" : r.status}
                            </span>
                          </td>
                        );
                      }
                      if (col.key === "amount") return <td key={col.key} className="px-3 py-2 font-semibold">{r.amount}</td>;
                      if (col.key === "currency") return <td key={col.key} className="px-3 py-2"><span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">{r.currency}</span></td>;
                      if (col.key === "beneficiary") return <td key={col.key} className="px-3 py-2 max-w-[120px] truncate" title={r.beneficiary}>{r.beneficiary}</td>;
                      if (col.key === "sortCode") return <td key={col.key} className="px-3 py-2 font-mono text-xs">{r.sortCode}</td>;
                      if (col.key === "accountNumber") return <td key={col.key} className="px-3 py-2 font-mono text-xs max-w-[100px] truncate" title={r.accountNumber}>{r.accountNumber}</td>;
                      if (col.key === "invNumber") return <td key={col.key} className="px-3 py-2 font-mono text-xs max-w-[100px] truncate" title={r.invNumber}>{r.invNumber}</td>;
                      if (col.key === "submittedBy") return <td key={col.key} className="px-3 py-2">{r.submittedBy}</td>;
                      if (col.key === "files") {
                        return (
                          <td key={col.key} className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-0.5">
                              {r.files.length === 0 ? (
                                <span className="text-xs text-gray-400">—</span>
                              ) : (
                                r.files.map((f, i) => (
                                  <button
                                    key={f.storage_path || `${i}-${f.file_name}`}
                                    onClick={() => void openFile(r.id, f.storage_path, f.file_name)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-400 dark:hover:bg-sky-800/60 transition-colors"
                                    title={`${f.file_name} — Click to preview`}
                                  >
                                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z" />
                                    </svg>
                                  </button>
                                ))
                              )}
                            </div>
                          </td>
                        );
                      }
                      if (col.key === "companyName") return <td key={col.key} className="px-3 py-2 max-w-[120px] truncate" title={r.companyName}>{r.companyName}</td>;
                      if (col.key === "invDate") return <td key={col.key} className="px-3 py-2">{r.invDate}</td>;
                      if (col.key === "dueDate") return <td key={col.key} className="px-3 py-2">{r.dueDate}</td>;
                      if (col.key === "purpose") return <td key={col.key} className="px-3 py-2 max-w-[180px] truncate" title={r.purpose}>{r.purpose}</td>;
                      if (col.key === "actions") {
                        return (
                          <td key={col.key} className="px-3 py-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {r.status === "ready_for_payment" && canMarkPaid && (
                              <button
                                onClick={() => void onMarkPaid(r.id)}
                                disabled={actionLoadingId === r.id}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                Mark paid
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => void onDelete(r.id)}
                                disabled={deletingId === r.id}
                                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                                title="Delete"
                              >
                                Delete
                              </button>
                            )}
                            {r.status === "paid" && r.paidDate && <span className="text-xs text-gray-500">Paid {r.paidDate}</span>}
                          </td>
                        );
                      }
                      return <td key={col.key} className="px-3 py-2">—</td>;
                    })}
                  </tr>
                  {expandedRowId === r.id && (
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <td colSpan={COLUMNS.length + 1} className="px-6 py-4">
                        {detailLoading ? (
                          <p className="text-sm text-gray-500">Loading...</p>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <a href={`/invoices/${r.id}`} className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400">
                                View full invoice →
                              </a>
                              <a href={`/messages?invoiceId=${r.id}`} className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400">
                                Message about this invoice
                              </a>
                              {r.submitterId && r.submitterId !== currentUserId && (
                                <a href={`/messages?invoiceId=${r.id}&recipientId=${r.submitterId}`} className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400">
                                  Message submitter
                                </a>
                              )}
                            </div>
                            <div>
                              <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Timeline</h4>
                              {timelineData.length === 0 ? (
                                <p className="text-xs text-gray-400">No events yet.</p>
                              ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {timelineData.map((ev) => {
                                    const ch = (ev.payload as Record<string, unknown>)?.changes as Record<string, { from: string; to: string }> | undefined;
                                    const hc = ch && Object.keys(ch).length > 0;
                                    const ic = ev.event_type === "invoice_updated" ? "bg-amber-400" : ev.event_type.includes("reject") ? "bg-red-400" : ev.event_type.includes("approv") || ev.event_type.includes("paid") ? "bg-green-400" : "bg-blue-400";
                                    return (
                                      <div key={ev.id} className="flex items-start gap-2 text-xs">
                                        <div className={`mt-0.5 h-2 w-2 rounded-full ${ic} flex-shrink-0`} />
                                        <div className="flex-1 min-w-0">
                                          <span className="font-medium text-gray-700 dark:text-gray-300">{ev.actor_name ?? "—"}</span>
                                          <span className="text-gray-500"> — {ev.event_type.replace(/_/g, " ")}</span>
                                          {ev.from_status && ev.to_status && <span className="text-gray-400"> ({ev.from_status} → {ev.to_status})</span>}
                                          {hc && (
                                            <div className="mt-1 space-y-0.5 rounded bg-gray-100 border border-gray-200 px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600">
                                              {Object.entries(ch).map(([f, { from, to }]) => (
                                                <div key={f} className="flex items-center gap-1 text-[11px]">
                                                  <span className="font-medium text-gray-600 dark:text-gray-400 capitalize">{f.replace(/_/g, " ")}:</span>
                                                  <span className="text-red-500 line-through">{from || "—"}</span>
                                                  <span className="text-gray-400">→</span>
                                                  <span className="text-green-600 font-medium">{to || "—"}</span>
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
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File preview modal */}
      {(previewUrl || previewHtml || previewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closePreview}>
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-600 px-4 py-2">
              <h3 className="font-medium text-slate-200 truncate">{previewName}</h3>
              <button onClick={closePreview} className="rounded-lg px-3 py-1 text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200">
                Close
              </button>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-52px)] p-4">
              {previewLoading && <p className="text-slate-400">Loading...</p>}
              {previewUrl && !previewLoading && <iframe src={previewUrl} className="w-full h-[80vh] rounded" title="Preview" />}
              {previewHtml && !previewLoading && <div className="rounded-lg border border-slate-600 bg-white p-4 text-slate-900" dangerouslySetInnerHTML={{ __html: previewHtml }} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
