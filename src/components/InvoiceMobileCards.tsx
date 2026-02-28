"use client";

import React, { useRef, useState, useEffect } from "react";

type DisplayRow = {
  id: string;
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
  amountNum: number | null;
  anomalyFlags: string[];
  invNumber: string;
  sortCode: string;
  accountNumber: string;
  lineManager: string;
  lineManagerId: string;
  paymentDate: string;
  status: string;
  rejectionReason: string;
  submitterId: string;
  createdAt: string;
  group: "pending_line_manager" | "ready_for_payment" | "paid_invoices" | "no_payment_needed" | "rejected";
  hasMissingInfo: boolean;
  missingFields: string[];
  files: { storage_path: string; file_name: string }[];
  tags: string[];
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

function statusLabel(s: string): string {
  if (s === "pending_manager" || s === "submitted") return "Pending";
  if (s === "ready_for_payment") return "Ready for Payment";
  if (s === "paid" || s === "archived") return "Paid";
  if (s === "rejected") return "Rejected";
  if (s === "approved_by_manager" || s === "pending_admin") return "Admin Review";
  return s;
}

import { statusBadgeStyle } from "@/lib/colors";

export function InvoiceMobileCards({
  rows,
  currentRole,
  currentUserId,
  isOperationsRoomMember = false,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  canBulkSelect,
  onManagerApprove,
  onRejectInvoice,
  onResubmit,
  onMarkPaid,
  onDeleteInvoice,
  onStartEdit,
  rejectInlineShakeId = null,
  openPdf,
  actionLoadingId,
  expandedRowId = null,
  onToggleExpand,
  timelineData = [],
  filesData = [],
  notesData = [],
  newNote = "",
  onNewNoteChange,
  onAddNote,
  detailLoading = false,
  showPreview,
  onDownloadFile,
  onAddFile,
  departmentPairs = [],
  programPairs = [],
  profilePairs = [],
  rolesCanDelete = ["admin", "finance", "operations", "submitter"],
}: {
  rows: DisplayRow[];
  currentRole: string;
  currentUserId: string;
  isOperationsRoomMember?: boolean;
  onManagerApprove: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: (ids: string[], checked: boolean) => void;
  canBulkSelect?: boolean;
  onRejectInvoice: (id: string) => void;
  onResubmit: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onDeleteInvoice?: (id: string) => void;
  onStartEdit?: (row: DisplayRow) => void;
  rejectInlineShakeId?: string | null;
  openPdf: (id: string, storagePath?: string) => void;
  actionLoadingId: string | null;
  expandedRowId?: string | null;
  onToggleExpand?: (id: string) => void;
  timelineData?: TimelineEvent[];
  filesData?: { storage_path: string; file_name: string }[];
  notesData?: NoteItem[];
  newNote?: string;
  onNewNoteChange?: (v: string) => void;
  onAddNote?: () => void;
  detailLoading?: boolean;
  showPreview?: (id: string, storagePath?: string) => void;
  onDownloadFile?: (id: string, storagePath: string, fileName: string) => void;
  onAddFile?: (id: string, file: File) => void;
  departmentPairs?: [string, string][];
  programPairs?: [string, string][];
  profilePairs?: [string, string][];
  rolesCanDelete?: string[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || rows.length <= 1) return;
    const onScroll = () => {
      const cardWidth = el.scrollWidth / rows.length;
      const idx = Math.round(el.scrollLeft / cardWidth);
      setActiveIndex(Math.min(Math.max(0, idx), rows.length - 1));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [rows.length]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
        No invoices in this group.
      </div>
    );
  }

  return (
    <div className="md:hidden w-full min-w-0 overflow-hidden">
      <div ref={scrollRef} className="mobile-card-carousel flex overflow-x-auto overflow-y-visible snap-x snap-mandatory gap-4 pb-4 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
          const isSubmitter = r.submitterId === currentUserId;
          const canApprove =
            currentRole === "admin" ||
            (!isSubmitter && currentRole === "manager") ||
            (isOperationsRoomMember && (r.status === "approved_by_manager" || r.status === "pending_admin"));
          const canMarkPaid = (currentRole === "admin" || currentRole === "finance") && r.status === "ready_for_payment";
          const canResubmit = r.status === "rejected" && (isSubmitter || currentRole === "admin") && currentRole !== "viewer";
          const canEdit = (currentRole === "admin" || currentRole === "manager" || (isSubmitter && ["submitted", "pending_manager", "rejected"].includes(r.status))) && onStartEdit;
          const canDeletePending = isSubmitter && (r.status === "submitted" || r.status === "pending_manager" || r.status === "rejected") && rolesCanDelete.includes("submitter") && onDeleteInvoice;
          const canDeleteFinanceOps = (currentRole === "finance" || currentRole === "operations") && rolesCanDelete.includes(currentRole) && onDeleteInvoice;
          const canDeleteManagerViewer = (currentRole === "manager" || currentRole === "viewer") && rolesCanDelete.includes(currentRole) && onDeleteInvoice;
          const canDeleteAdmin = currentRole === "admin" && rolesCanDelete.includes("admin") && onDeleteInvoice;
          const canAddFile = isSubmitter && ["submitted", "pending_manager", "rejected"].includes(r.status) && onAddFile;
          const canReject = ((r.status === "pending_manager" || r.status === "submitted") && canApprove) || (r.status === "ready_for_payment" && currentRole === "admin") || ((r.status === "approved_by_manager" || r.status === "pending_admin") && currentRole === "admin");
          const canSelectRow = canBulkSelect && onToggleSelect && (currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter" || currentRole === "viewer") && (currentRole !== "submitter" || (r.submitterId === currentUserId && ["submitted", "pending_manager", "rejected"].includes(r.status)));
          const handleCardClick = canSelectRow ? (e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest("button, a, input, label, [role='button']")) return;
            onToggleSelect!(r.id);
          } : undefined;
          return (
          <div
            key={r.id}
            onClick={handleCardClick}
            className={`flex-shrink-0 w-[85vw] max-w-[min(400px,calc(100vw-2rem))] min-w-[280px] rounded-xl border-2 bg-white p-4 shadow-md dark:bg-slate-800 snap-center transition-transform duration-300 ${canSelectRow ? "cursor-pointer" : ""} ${
              r.status === "rejected"
                ? "border-rose-300 dark:border-rose-700"
                : "border-slate-200 dark:border-slate-600"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {canBulkSelect && onToggleSelect && (currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter" || currentRole === "viewer") && (currentRole !== "submitter" || (r.submitterId === currentUserId && ["submitted", "pending_manager", "rejected"].includes(r.status))) && (
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(r.id) ?? false}
                      onChange={() => onToggleSelect(r.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-gray-300 text-blue-600 accent-blue-600"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{r.guest}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.invNumber}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={statusBadgeStyle(r.status)}>
                  {statusLabel(r.status)}
                </span>
              </div>

              {/* Action buttons - prominent at top for mobile */}
              {((r.status === "pending_manager" || r.status === "submitted") && canApprove) || canResubmit || canMarkPaid || (canReject && r.status !== "pending_manager" && r.status !== "submitted") ? (
                <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                  {(r.status === "pending_manager" || r.status === "submitted") && canApprove && (
                    <>
                      <button
                        onClick={() => void onManagerApprove(r.id)}
                        disabled={actionLoadingId === r.id}
                        className="flex-1 min-w-[100px] min-h-[44px] rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 touch-manipulation"
                        aria-label="Approve invoice"
                      >
                        {actionLoadingId === r.id ? "…" : "✓ Approve"}
                      </button>
                      <button
                        onClick={() => void onRejectInvoice(r.id)}
                        disabled={actionLoadingId === r.id}
                        className={`flex-1 min-w-[100px] min-h-[44px] rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 touch-manipulation ${rejectInlineShakeId === r.id ? "animate-shake-reject" : ""}`}
                        aria-label="Reject invoice"
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                  {canResubmit && (
                    <button
                      onClick={() => void onResubmit(r.id)}
                      disabled={actionLoadingId === r.id}
                      className="flex-1 min-w-[100px] min-h-[44px] rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 touch-manipulation"
                      aria-label="Resubmit invoice"
                    >
                      {actionLoadingId === r.id ? "…" : "↻ Resubmit"}
                    </button>
                  )}
                  {canMarkPaid && (
                    <button
                      onClick={() => void onMarkPaid(r.id)}
                      disabled={actionLoadingId === r.id}
                      className="flex-1 min-w-[100px] min-h-[44px] rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 touch-manipulation"
                      aria-label="Mark as paid"
                    >
                      {actionLoadingId === r.id ? "…" : "£ Mark Paid"}
                    </button>
                  )}
                  {canReject && r.status !== "pending_manager" && r.status !== "submitted" && (
                    <button
                      onClick={() => void onRejectInvoice(r.id)}
                      disabled={actionLoadingId === r.id}
                      className={`flex-1 min-w-[100px] min-h-[44px] rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 touch-manipulation ${rejectInlineShakeId === r.id ? "animate-shake-reject" : ""}`}
                      aria-label="Reject invoice"
                    >
                      ✗ Reject
                    </button>
                  )}
                </div>
              ) : null}

              <div className="space-y-2 text-sm">
                {[
                  { label: "Title", value: r.title },
                  { label: "Producer", value: r.producer },
                  { label: "Payment Type", value: r.paymentType },
                  { label: "Department", value: r.department },
                  { label: "Programme", value: r.programme },
                  { label: "Topic", value: r.topic },
                  { label: "TX Date", value: r.tx1 },
                  { label: "2. TX Date", value: r.tx2 },
                  { label: "3. TX Date", value: r.tx3 },
                  { label: "Invoice Date", value: r.invoiceDate },
                  { label: "Account Name", value: r.accountName },
                  { label: "Amount", value: r.amount },
                  { label: "INV Number", value: r.invNumber },
                  { label: "Sort Code", value: r.sortCode },
                  { label: "Account Number", value: r.accountNumber },
                  { label: "Dept EP", value: r.lineManager },
                  { label: "Payment Date", value: r.paymentDate },
                  { label: "Created", value: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                    <span className="text-right text-gray-900 dark:text-white break-words min-w-0">{value || "—"}</span>
                  </div>
                ))}
              </div>

              {r.hasMissingInfo && r.missingFields?.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200">
                  <span className="font-semibold">Missing:</span> {r.missingFields.join(", ")}
                </div>
              )}

              {r.status === "rejected" && r.rejectionReason && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
                  <span className="font-semibold">Rejection:</span> {r.rejectionReason}
                </div>
              )}

              {/* Files - tap to preview */}
              {((r.files?.length ?? 0) > 0 || (expandedRowId === r.id && filesData.length > 0) || canAddFile) && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400">Files</h4>
                  <div className="flex flex-wrap gap-2">
                    {(expandedRowId === r.id ? filesData : r.files ?? []).map((f, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (showPreview) showPreview(r.id, f.storage_path);
                          else void openPdf(r.id, f.storage_path);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                      >
                        <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z"/></svg>
                        <span className="truncate max-w-[120px]">{f.file_name}</span>
                      </button>
                    ))}
                    {canAddFile && (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-800/50">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                        Add file
                        <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAddFile?.(r.id, f); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                {onToggleExpand && (
                  <button
                    onClick={() => onToggleExpand(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    {expandedRowId === r.id ? "Hide details" : "View details"}
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => onStartEdit?.(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                  >
                    Edit
                  </button>
                )}
                {(canDeletePending || canDeleteFinanceOps || canDeleteManagerViewer || canDeleteAdmin) && (
                  <button
                    onClick={() => void onDeleteInvoice?.(r.id)}
                    disabled={actionLoadingId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                  >
                    {actionLoadingId === r.id ? "Deleting..." : "Delete"}
                  </button>
                )}
                <button
                  onClick={() => void openPdf(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-100 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z" />
                  </svg>
                  View File
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      {rows.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {rows.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? "w-4 bg-blue-500 dark:bg-blue-400" : "bg-gray-300 dark:bg-gray-600"}`}
              aria-hidden
            />
          ))}
        </div>
      )}
    </div>
  );
}
