"use client";

import { useState, useEffect } from "react";
import type { Profile } from "@/lib/types";

interface InvoiceDetailProps {
  invoice: Record<string, unknown>;
  workflow: Record<string, unknown> | null;
  extracted: Record<string, unknown> | null;
  profile: Profile;
}

export function InvoiceDetail({
  invoice,
  workflow,
  extracted,
  profile,
}: InvoiceDetailProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminComment, setAdminComment] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paidDate, setPaidDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [confirmBank, setConfirmBank] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  );

  const status = (workflow?.status as string) ?? "submitted";
  const raw = (extracted?.raw_json as Record<string, unknown> | undefined) ?? {};
  const beneficiary =
    (extracted?.beneficiary_name as string | undefined) ||
    (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name : "") ||
    "—";
  const accountNumber =
    (extracted?.account_number as string | undefined) ||
    (typeof raw.account_number === "string" ? raw.account_number : "") ||
    "—";
  const sortCode =
    (extracted?.sort_code as string | undefined) ||
    (typeof raw.sort_code === "string" ? raw.sort_code : "") ||
    "—";
  const invoiceNumber =
    (extracted?.invoice_number as string | undefined) ||
    (typeof raw.invoice_number === "string" ? raw.invoice_number : "") ||
    String(invoice.id).slice(0, 8);
  const extractedCurrency =
    (extracted?.extracted_currency as string | undefined) ||
    (typeof raw.currency === "string" ? raw.currency : "") ||
    (invoice.currency as string) ||
    "GBP";
  const netAmount: number | null =
    (extracted?.net_amount as number | null) ??
    (typeof raw.net_amount === "number" ? raw.net_amount : typeof raw.net_amount === "string" ? Number(raw.net_amount) : null);
  const vatAmount: number | null =
    (extracted?.vat_amount as number | null) ??
    (typeof raw.vat_amount === "number" ? raw.vat_amount : typeof raw.vat_amount === "string" ? Number(raw.vat_amount) : null);
  const grossAmount: number | null =
    (extracted?.gross_amount as number | null) ??
    (typeof raw.gross_amount === "number"
      ? raw.gross_amount
      : typeof raw.gross_amount === "string"
        ? Number(raw.gross_amount)
        : null);

  useEffect(() => {
    fetch(`/api/invoices/${invoice.id}/pdf`)
      .then((r) => r.json())
      .then((d) => {
        if (d.url) {
          setPdfUrl(d.url);
          setPdfError(null);
        } else {
          setPdfError(d.error || "PDF link could not be generated.");
        }
      })
      .catch(() => {
        setPdfError("PDF could not be loaded.");
      });
  }, [invoice.id]);

  const runExtract = async () => {
    setExtracting(true);
    setMessage(null);
    const res = await fetch(`/api/invoices/${invoice.id}/extract`, {
      method: "POST",
    });
    const data = await res.json();
    setExtracting(false);
    if (res.ok) {
      setMessage({
        type: "success",
        text: data.needs_review
          ? "Extraction complete. Some fields need review."
          : "Extraction complete.",
      });
      window.location.reload();
    } else {
      setMessage({ type: "error", text: data.error });
    }
  };

  const confirmBankDetails = async () => {
    setLoading(true);
    const res = await fetch(`/api/invoices/${invoice.id}/confirm-extracted`, {
      method: "POST",
    });
    setLoading(false);
    if (res.ok) window.location.reload();
  };

  const transitionStatus = async (to: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    setMessage(null);
    const body: Record<string, unknown> = { to_status: to, ...extra };
    const res = await fetch(`/api/invoices/${invoice.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMessage({ type: "success", text: "Updated." });
      window.location.reload();
    } else {
      setMessage({ type: "error", text: data.error });
    }
  };

  const canManagerApprove =
    profile.role === "manager" &&
    status === "pending_manager" &&
    (extracted?.manager_confirmed === true || confirmBank);
  const serviceDescription = (invoice.service_description as string) || "";
  const producerMatch = serviceDescription
    .split("\n")
    .find((line) => line.toLowerCase().startsWith("producer:"));
  const producer = producerMatch ? producerMatch.split(":").slice(1).join(":").trim() : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">
        Invoice {invoiceNumber}
      </h1>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/50 bg-red-500/10 text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="mb-4 font-medium text-slate-200">Details</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd className="capitalize text-slate-200">
                {status.replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Service description</dt>
              <dd className="text-slate-200">
                {(invoice.service_description as string) || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Producer</dt>
              <dd className="text-slate-200">{producer || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Service dates</dt>
              <dd className="text-slate-200">
                {invoice.service_date_from && invoice.service_date_to
                  ? `${invoice.service_date_from} to ${invoice.service_date_to}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Currency</dt>
              <dd className="text-slate-200">{invoice.currency as string}</dd>
            </div>
          </dl>

          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sky-400 hover:text-sky-300"
            >
              Open PDF
            </a>
          )}
          {!pdfUrl && pdfError && (
            <p className="mt-4 text-sm text-red-300">{pdfError}</p>
          )}
        </div>

        {extracted ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-medium text-slate-200">
                Extracted fields
                {!!extracted.needs_review && (
                  <span className="ml-2 text-amber-400">(needs review)</span>
                )}
              </h2>
              <button
                onClick={runExtract}
                disabled={extracting}
                className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {extracting ? "Extracting..." : "Re-run AI extraction"}
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-400">Beneficiary</dt>
                <dd className="text-slate-200">
                  {beneficiary}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Account</dt>
                <dd className="font-mono text-slate-200">
                  {accountNumber}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Sort code</dt>
                <dd className="font-mono text-slate-200">
                  {sortCode}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Invoice #</dt>
                <dd className="text-slate-200">
                  {invoiceNumber}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Amounts</dt>
                <dd className="text-slate-200">
                  Net: {netAmount ?? "—"} | VAT: {vatAmount ?? "—"} | Gross: {grossAmount ?? "—"}{" "}
                  {extractedCurrency}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
            <h2 className="mb-4 font-medium text-slate-200">AI extraction</h2>
            <p className="mb-4 text-sm text-slate-400">
              Extract invoice fields from the PDF.
            </p>
            <button
              onClick={runExtract}
              disabled={extracting}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {extracting ? "Extracting…" : "Extract fields"}
            </button>
          </div>
        )}
      </div>

      {/* Manager: confirm bank + approve/reject */}
      {profile.role === "manager" && status === "pending_manager" && extracted && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="mb-4 font-medium text-slate-200">Manager approval</h2>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={confirmBank}
                onChange={(e) => setConfirmBank(e.target.checked)}
                className="rounded border-slate-600"
              />
              <span className="text-sm text-slate-300">
                I confirm bank details are correct
              </span>
            </label>
            {!extracted.manager_confirmed && (
              <button
                onClick={confirmBankDetails}
                disabled={loading}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-500 disabled:opacity-50"
              >
                Confirm
              </button>
            )}
            <button
              onClick={() =>
                transitionStatus("approved_by_manager", {
                  manager_confirmed: extracted.manager_confirmed || confirmBank,
                })
              }
              disabled={!extracted.manager_confirmed && !confirmBank || loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Approve
            </button>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rejection reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
              <button
                onClick={() =>
                  transitionStatus("rejected", { rejection_reason: rejectionReason })
                }
                disabled={!rejectionReason.trim() || loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin: ready for payment / reject / archive */}
      {profile.role === "admin" &&
        ["approved_by_manager", "pending_admin", "ready_for_payment", "paid"].includes(
          status
        ) ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
            <h2 className="mb-4 font-medium text-slate-200">Admin actions</h2>
            <div className="flex flex-wrap items-center gap-4">
              {(status === "approved_by_manager" || status === "pending_admin") && (
                <>
                  <input
                    type="text"
                    placeholder="Comment"
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  />
                  <button
                    onClick={() =>
                      transitionStatus("ready_for_payment", {
                        admin_comment: adminComment || undefined,
                      })
                    }
                    disabled={loading}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Mark ready for payment
                  </button>
                  <input
                    type="text"
                    placeholder="Rejection reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  />
                  <button
                    onClick={() =>
                      transitionStatus("rejected", {
                        rejection_reason: rejectionReason,
                        admin_comment: adminComment || undefined,
                      })
                    }
                    disabled={!rejectionReason.trim() || loading}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
              {(status === "paid" || status === "ready_for_payment") && (
                <button
                  onClick={() => transitionStatus("archived")}
                  disabled={loading || status !== "paid"}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-500 disabled:opacity-50"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        ) : null}

      {/* Finance: mark paid / archive */}
      {profile.role === "finance" &&
        ["ready_for_payment", "paid", "archived"].includes(status) ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
            <h2 className="mb-4 font-medium text-slate-200">Finance actions</h2>
            <div className="flex flex-wrap items-center gap-4">
              {status === "ready_for_payment" && (
                <>
                  <input
                    type="text"
                    placeholder="Payment reference"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  />
                  <input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  />
                  <button
                    onClick={() =>
                      transitionStatus("paid", {
                        payment_reference: paymentRef || undefined,
                        paid_date: paidDate,
                      })
                    }
                    disabled={loading}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Mark paid
                  </button>
                </>
              )}
              {status === "paid" && (
                <button
                  onClick={() => transitionStatus("archived")}
                  disabled={loading}
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-500 disabled:opacity-50"
                >
                  Archive
                </button>
              )}
            </div>
          </div>
        ) : null}

      {!!workflow?.rejection_reason && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
          <strong>Rejection reason:</strong> {workflow.rejection_reason as string}
        </div>
      )}

      {!!workflow?.admin_comment && (
        <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-4 text-sm text-slate-300">
          <strong>Admin comment:</strong> {workflow.admin_comment as string}
        </div>
      )}

      {status === "paid" && (
        <div className="text-sm text-slate-400">
          Payment ref: {workflow?.payment_reference as string} | Paid:{" "}
          {workflow?.paid_date as string}
        </div>
      )}
    </div>
  );
}
