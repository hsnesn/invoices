"use client";

import React, { useRef, useState, useEffect } from "react";

type DisplayRow = {
  id: string;
  contractor: string;
  submittedBy: string;
  companyName: string;
  submissionDate: string;
  additionalCost: string;
  amount: string;
  currency?: string;
  invNumber: string;
  beneficiary: string;
  accountNumber: string;
  sortCode: string;
  deptManager: string;
  deptManagerId: string;
  department: string;
  department2: string;
  serviceDaysCount: string;
  days: string;
  serviceRate: string;
  month: string;
  bookedBy: string;
  serviceDescription: string;
  additionalCostReason: string;
  status: string;
  rejectionReason: string;
  submitterId: string;
  paidDate: string;
  createdAt: string;
};

function statusLabel(s: string): string {
  if (s === "submitted" || s === "pending_manager") return "Pending";
  if (s === "rejected") return "Rejected";
  if (s === "approved_by_manager" || s === "pending_admin") return "Admin Review";
  if (s === "ready_for_payment") return "Ready for Payment";
  if (s === "paid" || s === "archived") return "Paid";
  return s;
}

import { statusBadgeStyle } from "@/lib/colors";

export function FreelancerMobileCards({
  rows,
  currentRole,
  currentUserId,
  isOperationsRoomMember,
  onManagerApprove,
  onAdminApprove,
  onResubmit,
  onMarkPaid,
  openFile,
  openRejectModal,
  viewBookingForm,
  downloadBookingForm,
  sendBookingFormEmails,
  actionLoadingId,
}: {
  rows: DisplayRow[];
  currentRole: string;
  currentUserId: string;
  isOperationsRoomMember: boolean;
  onManagerApprove: (id: string) => void;
  onAdminApprove: (id: string) => void;
  onResubmit: (id: string) => void;
  onMarkPaid: (id: string) => void;
  openFile: (id: string) => void;
  openRejectModal: (id: string) => void;
  viewBookingForm: (id: string, contractor: string, month: string) => void;
  downloadBookingForm: (id: string, contractor: string, month: string) => void;
  sendBookingFormEmails: (id: string) => void;
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

  const canApprove = (r: DisplayRow) => {
    if (r.submitterId === currentUserId && currentRole !== "admin" && !isOperationsRoomMember) return false;
    if (currentRole === "admin") return true;
    if (isOperationsRoomMember && (r.status === "approved_by_manager" || r.status === "pending_admin")) return true;
    if (currentRole === "manager" && r.deptManagerId === currentUserId) return true;
    return false;
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 md:hidden">
        No invoices in this group.
      </div>
    );
  }

  return (
    <div className="md:hidden">
      <div ref={scrollRef} className="mobile-card-carousel flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory gap-4 pb-4 -mx-1 px-1 max-h-[calc(100vh-260px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => {
        const isSubmitter = r.submitterId === currentUserId;
        const canApp = canApprove(r);
        const canResubmit = r.status === "rejected" && (isSubmitter || currentRole === "admin") && currentRole !== "viewer";
        const canMarkPaid = (currentRole === "admin" || currentRole === "finance") && r.status === "ready_for_payment";
        const canOpsRoomApprove = isOperationsRoomMember && (r.status === "approved_by_manager" || r.status === "pending_admin");
        const canAdminApprove = currentRole === "admin" && (r.status === "approved_by_manager" || r.status === "pending_admin");
        const canReject = ((r.status === "pending_manager" || r.status === "submitted") && canApp) || canOpsRoomApprove || canAdminApprove;

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
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{r.contractor}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.invNumber}</p>
                </div>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium text-white" style={statusBadgeStyle(r.status)}>
                  {statusLabel(r.status)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {[
                  { label: "Company", value: r.companyName },
                  { label: "Submitted by", value: r.submittedBy },
                  { label: "Submission Date", value: r.submissionDate },
                  { label: "Department", value: r.department },
                  { label: "Department 2", value: r.department2 },
                  { label: "Booked by", value: r.bookedBy },
                  { label: "Service Days", value: r.serviceDaysCount },
                  { label: "Month", value: r.month },
                  { label: "Days", value: r.days },
                  { label: "Rate/Day", value: r.serviceRate },
                  { label: "Additional Cost", value: r.additionalCost },
                  { label: "Add. Cost Reason", value: r.additionalCostReason },
                  { label: "Amount", value: r.amount },
                  { label: "Currency", value: r.currency ? (r.currency === "USD" ? "USD ($)" : r.currency === "EUR" ? "EUR (€)" : "GBP (£)") : "—" },
                  { label: "Approver", value: r.deptManager },
                  { label: "Service Desc.", value: r.serviceDescription },
                  { label: "Paid Date", value: r.paidDate },
                  { label: "Created", value: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0 dark:border-gray-700">
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                    <span className="text-right text-gray-900 dark:text-white break-words min-w-0 max-w-[60%]">{value || "—"}</span>
                  </div>
                ))}
              </div>

              {r.status === "rejected" && r.rejectionReason && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
                  <span className="font-semibold">Rejection:</span> {r.rejectionReason}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => void openFile(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-100 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z" />
                  </svg>
                  View File
                </button>
                {["approved_by_manager", "pending_admin", "ready_for_payment", "paid", "archived"].includes(r.status) && (currentRole === "admin" || currentRole === "operations" || currentRole === "finance" || (currentRole === "manager" && r.deptManagerId === currentUserId) || isOperationsRoomMember) && (
                  <>
                    <button
                      onClick={() => void viewBookingForm(r.id, r.contractor, r.month)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-800/50"
                    >
                      View Booking Form
                    </button>
                    <button
                      onClick={() => void downloadBookingForm(r.id, r.contractor, r.month)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      Download BF
                    </button>
                    {currentRole === "admin" && (
                      <button
                        onClick={() => void sendBookingFormEmails(r.id)}
                        disabled={actionLoadingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {actionLoadingId === r.id ? "…" : "📧"} Send BF
                      </button>
                    )}
                  </>
                )}
                {(r.status === "pending_manager" || r.status === "submitted") && canApp && (
                  <>
                    <button
                      onClick={() => void onManagerApprove(r.id)}
                      disabled={actionLoadingId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {actionLoadingId === r.id ? "…" : "✓"} Approve
                    </button>
                    <button
                      onClick={() => openRejectModal(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                    >
                      ✗ Reject
                    </button>
                  </>
                )}
                {(canOpsRoomApprove || canAdminApprove) && (
                  <button
                    onClick={() => void onAdminApprove(r.id)}
                    disabled={actionLoadingId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {actionLoadingId === r.id ? "…" : "✓"} Approve
                  </button>
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
                    onClick={() => openRejectModal(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
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
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? "w-4 bg-teal-500 dark:bg-teal-400" : "bg-gray-300 dark:bg-gray-600"}`}
              aria-hidden
            />
          ))}
        </div>
      )}
    </div>
  );
}
