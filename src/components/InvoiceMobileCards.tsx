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
  onManagerApprove,
  onRejectInvoice,
  onResubmit,
  onMarkPaid,
  onStartEdit,
  openPdf,
  actionLoadingId,
}: {
  rows: DisplayRow[];
  currentRole: string;
  currentUserId: string;
  onManagerApprove: (id: string) => void;
  onRejectInvoice: (id: string) => void;
  onResubmit: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onStartEdit?: (row: DisplayRow) => void;
  openPdf: (id: string) => void;
  actionLoadingId: string | null;
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
    <div className="md:hidden">
      <div ref={scrollRef} className="mobile-card-carousel flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory gap-4 pb-4 -mx-1 px-1 max-h-[calc(100vh-260px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
          const isSubmitter = r.submitterId === currentUserId;
          const canApprove = currentRole === "admin" || (!isSubmitter && currentRole === "manager");
          const canMarkPaid = (currentRole === "admin" || currentRole === "finance") && r.status === "ready_for_payment";
          const canResubmit = r.status === "rejected" && (isSubmitter || currentRole === "admin") && currentRole !== "viewer";
          const canEdit = (currentRole === "admin" || currentRole === "manager" || (isSubmitter && ["submitted", "pending_manager", "rejected"].includes(r.status))) && onStartEdit;
          const canReject = ((r.status === "pending_manager" || r.status === "submitted") && canApprove) || (r.status === "ready_for_payment" && currentRole === "admin") || ((r.status === "approved_by_manager" || r.status === "pending_admin") && currentRole === "admin");
          return (
          <div
            key={r.id}
            className={`flex-shrink-0 w-[calc(100%-2rem)] min-w-[calc(100%-2rem)] rounded-xl border-2 bg-white p-4 shadow-md dark:bg-slate-800 snap-center transition-transform duration-300 ${
              r.status === "rejected"
                ? "border-rose-300 dark:border-rose-700"
                : "border-slate-200 dark:border-slate-600"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{r.guest}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.invNumber}</p>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={statusBadgeStyle(r.status)}>
                  {statusLabel(r.status)}
                </span>
              </div>

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

              {r.status === "rejected" && r.rejectionReason && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
                  <span className="font-semibold">Rejection:</span> {r.rejectionReason}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                {canEdit && (
                  <button
                    onClick={() => onStartEdit?.(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                  >
                    Edit
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
                {(r.status === "pending_manager" || r.status === "submitted") && canApprove && (
                  <>
                    <button
                      onClick={() => void onManagerApprove(r.id)}
                      disabled={actionLoadingId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {actionLoadingId === r.id ? "…" : "✓"} Approve
                    </button>
                    <button
                      onClick={() => void onRejectInvoice(r.id)}
                      disabled={actionLoadingId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      ✗ Reject
                    </button>
                  </>
                )}
                {canResubmit && (
                  <button
                    onClick={() => void onResubmit(r.id)}
                    disabled={actionLoadingId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {actionLoadingId === r.id ? "…" : "↻"} Resubmit
                  </button>
                )}
                {canMarkPaid && (
                  <button
                    onClick={() => void onMarkPaid(r.id)}
                    disabled={actionLoadingId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {actionLoadingId === r.id ? "…" : "£"} Mark Paid
                  </button>
                )}
                {canReject && r.status !== "pending_manager" && r.status !== "submitted" && (
                  <button
                    onClick={() => void onRejectInvoice(r.id)}
                    disabled={actionLoadingId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    ✗ Reject
                  </button>
                )}
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
