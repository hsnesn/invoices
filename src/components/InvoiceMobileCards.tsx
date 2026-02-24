"use client";

import React from "react";

type DisplayRow = {
  id: string;
  guest: string;
  title: string;
  producer: string;
  paymentType: string;
  department: string;
  programme: string;
  amount: string;
  invNumber: string;
  invoiceDate: string;
  accountName: string;
  status: string;
  rejectionReason: string;
  submitterId: string;
};

function statusLabel(s: string): string {
  if (s === "pending_manager" || s === "submitted") return "Pending";
  if (s === "ready_for_payment") return "Ready for Payment";
  if (s === "paid" || s === "archived") return "Paid";
  if (s === "rejected") return "Rejected";
  if (s === "approved_by_manager" || s === "pending_admin") return "Admin Review";
  return s;
}

function statusColor(s: string): string {
  if (s === "rejected") return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
  if (s === "paid" || s === "archived") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (s === "ready_for_payment") return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
}

export function InvoiceMobileCards({
  rows,
  currentRole,
  currentUserId,
  onManagerApprove,
  onRejectInvoice,
  onResubmit,
  onMarkPaid,
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
  openPdf: (id: string) => void;
  actionLoadingId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
        No invoices in this group.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4 overflow-y-auto max-h-[calc(100vh-280px)] snap-y snap-mandatory md:hidden">
      {rows.map((r) => {
        const isSubmitter = r.submitterId === currentUserId;
        const canApprove = currentRole === "admin" || (!isSubmitter && currentRole === "manager");
        const canMarkPaid = (currentRole === "admin" || currentRole === "finance") && r.status === "ready_for_payment";
        const canResubmit = r.status === "rejected" && (isSubmitter || currentRole === "admin");
        const canReject = (r.status === "pending_manager" && canApprove) || (r.status === "ready_for_payment" && currentRole === "admin") || ((r.status === "approved_by_manager" || r.status === "pending_admin") && currentRole === "admin");

        return (
          <div
            key={r.id}
            className={`rounded-xl border-2 bg-white p-4 shadow-md dark:bg-slate-800 snap-start ${
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
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(r.status)}`}>
                  {statusLabel(r.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{r.amount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Producer</p>
                  <p className="truncate text-gray-700 dark:text-gray-200">{r.producer}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Department</p>
                  <p className="truncate text-gray-700 dark:text-gray-200">{r.department}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Programme</p>
                  <p className="truncate text-gray-700 dark:text-gray-200">{r.programme}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Account</p>
                  <p className="truncate text-gray-700 dark:text-gray-200">{r.accountName}</p>
                </div>
              </div>

              {r.status === "rejected" && r.rejectionReason && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
                  <span className="font-semibold">Rejection:</span> {r.rejectionReason}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => void openPdf(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-100 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z" />
                  </svg>
                  View File
                </button>
                {r.status === "pending_manager" && canApprove && (
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
                    {actionLoadingId === r.id ? "…" : "₺"} Mark Paid
                  </button>
                )}
                {canReject && r.status !== "pending_manager" && (
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
  );
}
