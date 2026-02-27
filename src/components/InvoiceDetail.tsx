"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  const [files, setFiles] = useState<{ storage_path: string; file_name: string }[]>([]);
  const [addingFile, setAddingFile] = useState(false);
  const [excelPreview, setExcelPreview] = useState<{ name: string; html: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminComment, setAdminComment] = useState("");
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

  useEffect(() => {
    fetch(`/api/invoices/${invoice.id}/files`)
      .then((r) => r.json())
      .then((list) => (Array.isArray(list) ? setFiles(list) : setFiles([])))
      .catch(() => setFiles([]));
  }, [invoice.id]);

  const openFile = async (path?: string, fileName?: string) => {
    const url = path
      ? `/api/invoices/${invoice.id}/pdf?path=${encodeURIComponent(path)}`
      : `/api/invoices/${invoice.id}/pdf`;
    const d = await fetch(url).then((r) => r.json()).catch(() => null);
    if (!d?.url) return;
    const fileRes = await fetch(d.url);
    const blob = await fileRes.blob();
    const mime = blob.type.toLowerCase();
    const pathLower = (path ?? "").toLowerCase();
    const nameLower = (fileName ?? "").toLowerCase();
    const isExcel = mime.includes("sheet") || mime.includes("excel") || pathLower.endsWith(".xlsx") || pathLower.endsWith(".xls") || nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls");
    if (isExcel) {
      try {
        const XLSX = await import("xlsx");
        const arrayBuf = await blob.arrayBuffer();
        const wb = XLSX.read(arrayBuf, { type: "array" });
        let html = "";
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          html += `<h3 style="margin:16px 0 8px;font-weight:bold;font-size:14px;">${name}</h3>`;
          html += XLSX.utils.sheet_to_html(ws, { editable: false });
        }
        setExcelPreview({ name: fileName ?? "Spreadsheet", html });
      } catch {
        window.open(d.url, "_blank", "noopener,noreferrer");
      }
    } else {
      window.open(d.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/invoices/${invoice.id}/add-file`, { method: "POST", body: fd });
      if (res.ok) {
        const list = await fetch(`/api/invoices/${invoice.id}/files`).then((r) => r.json());
        setFiles(Array.isArray(list) ? list : []);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: (data as { error?: string }).error ?? "Add file failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Add file failed" });
    } finally {
      setAddingFile(false);
      e.target.value = "";
    }
  };

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
  const invoiceType = (invoice.invoice_type as string) ?? "";
  const isOtherInvoice = invoiceType === "other";
  const serviceDescription = (invoice.service_description as string) || "";
  const producerMatch = serviceDescription
    .split("\n")
    .find((line) => line.toLowerCase().startsWith("producer:"));
  const producer = producerMatch ? producerMatch.split(":").slice(1).join(":").trim() : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-100">
          Invoice {invoiceNumber}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {invoice.submitter_user_id && invoice.submitter_user_id !== profile.id && (
            <Link
              href={`/messages?invoiceId=${invoice.id}&recipientId=${invoice.submitter_user_id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Message submitter
            </Link>
          )}
          <Link
            href={`/messages?invoiceId=${invoice.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Message about this invoice
          </Link>
        </div>
      </div>

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
              <dt className="text-slate-400">{isOtherInvoice ? "Purpose (what for)" : "Service description"}</dt>
              <dd className="text-slate-200">
                {(invoice.service_description as string) || "—"}
              </dd>
            </div>
            {!isOtherInvoice && (
            <div>
              <dt className="text-slate-400">Producer</dt>
              <dd className="text-slate-200">{producer || "—"}</dd>
            </div>
            )}
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

          <div className="mt-4 space-y-2">
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => openFile(f.storage_path, f.file_name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-sm text-sky-400 hover:bg-slate-700/50 hover:text-sky-300"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z"/></svg>
                    {f.file_name}
                  </button>
                ))}
              </div>
            ) : pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sky-400 hover:text-sky-300"
              >
                Open PDF
              </a>
            )}
            {(profile.role === "admin" || profile.role === "manager" || profile.role === "operations" || invoice.submitter_user_id === profile.id) && (
              <label className="ml-2 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600/50 disabled:opacity-50">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                {addingFile ? "Adding..." : "Add file"}
                <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg" onChange={handleAddFile} disabled={addingFile} />
              </label>
            )}
          </div>
          {!pdfUrl && !files.length && pdfError && (
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
              {status === "ready_for_payment" && (
                <button
                  onClick={() =>
                    transitionStatus("paid", {
                      paid_date: paidDate,
                    })
                  }
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Mark paid
                </button>
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
                <button
                  onClick={() =>
                    transitionStatus("paid", {
                      paid_date: paidDate,
                    })
                  }
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Mark paid
                </button>
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

      {excelPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setExcelPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
              <h3 className="font-medium text-slate-200">{excelPreview.name}</h3>
              <button onClick={() => setExcelPreview(null)} className="rounded-lg px-3 py-1 text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200">Close</button>
            </div>
            <div className="max-h-[calc(90vh-4rem)] overflow-auto p-4">
              <div className="overflow-x-auto rounded-lg border border-slate-600 bg-white p-4 text-slate-900" dangerouslySetInnerHTML={{ __html: excelPreview.html }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
