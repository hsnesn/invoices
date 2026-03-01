"use client";

import { useState, useEffect, useCallback } from "react";
import { TrtLogo } from "@/components/TrtLogo";
import { UploadOverlay } from "@/components/UploadOverlay";
import { BankDetailsFields, BANK_DETAILS_DEFAULT, validateBankDetails, type BankDetailsValues } from "@/components/BankDetailsFields";
import type { GuestSubmitData } from "@/lib/guest-submit-token-data";

const BANK_DETAILS_STORAGE_KEY = "guest_invoice_bank_draft";
const MAX_FILE_SIZE_MB = 10;
const SESSION_TIMEOUT_MIN = 60;

type GuestData = Pick<
  GuestSubmitData,
  "guest_name" | "title" | "program_name" | "recording_date" | "recording_topic" | "payment_amount" | "payment_currency"
>;

export function GuestSubmitFormClient({ token, initialData }: { token: string; initialData: GuestData }) {
  const [data, setData] = useState<GuestData | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [notifyingProducer, setNotifyingProducer] = useState(false);
  const [producerNotified, setProducerNotified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ statusToken?: string; invoiceNumber?: string } | null>(null);
  const [producerContact, setProducerContact] = useState<{ producerName: string; producerEmail: string | null } | null>(null);
  const [mode, setMode] = useState<"upload" | "generate" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [currency, setCurrency] = useState(initialData.payment_currency ?? "GBP");
  const [bankDetails, setBankDetails] = useState<BankDetailsValues>(() => {
    if (typeof window === "undefined") return BANK_DETAILS_DEFAULT;
    try {
      const s = localStorage.getItem(BANK_DETAILS_STORAGE_KEY);
      if (s) {
        const parsed = JSON.parse(s) as Partial<BankDetailsValues>;
        return { ...BANK_DETAILS_DEFAULT, ...parsed };
      }
    } catch {
      /* ignore */
    }
    return BANK_DETAILS_DEFAULT;
  });
  const [guestAddress, setGuestAddress] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hasExpenses, setHasExpenses] = useState(false);
  const [expenses, setExpenses] = useState<{ label: string; amount: string }[]>([{ label: "", amount: "" }]);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [showGenerateSummary, setShowGenerateSummary] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSessionExpired(true), SESSION_TIMEOUT_MIN * 60 * 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!token || data !== null || !error) return;
    fetch(`/api/guest-invoice-submit/contact?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.producerName) setProducerContact({ producerName: d.producerName, producerEmail: d.producerEmail ?? null });
      })
      .catch(() => {});
  }, [token, data, error]);

  const setBankDetailsWithStorage = useCallback((v: BankDetailsValues | ((prev: BankDetailsValues) => BankDetailsValues)) => {
    setBankDetails((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try {
        localStorage.setItem(BANK_DETAILS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !token) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("file", file);
      formData.set("currency", currency);
      const res = await fetch("/api/guest-invoice-submit/upload", {
        method: "POST",
        body: formData,
      });
      const d = await res.json();
      if (res.ok) {
        setSuccessData({ statusToken: d.status_token, invoiceNumber: d.invoice_number });
        setSuccess(true);
      } else {
        if (res.status === 410) {
          setData(null);
          setMode(null);
        }
        setError(d.error ?? "Upload failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGenerateReview(e: React.FormEvent) {
    e.preventDefault();
    const bankErr = validateBankDetails(bankDetails);
    if (!token || bankErr) {
      setError(bankErr ?? null);
      return;
    }
    setError(null);
    setShowGenerateSummary(true);
  }

  async function handleGenerateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showGenerateSummary) return handleGenerateReview(e);
    setSubmitting(true);
    setError(null);
    try {
      const validExpenses = hasExpenses
        ? expenses
            .filter((e) => e.label.trim() && e.amount.trim() && !Number.isNaN(parseFloat(e.amount)))
            .map((e) => ({ label: e.label.trim(), amount: parseFloat(e.amount) }))
        : [];
      const useFormData = receiptFiles.length > 0 || validExpenses.length > 0;
      const basePayload = {
        token,
        bank_type: bankDetails.bankType,
        account_name: bankDetails.accountName.trim(),
        bank_name: bankDetails.bankName.trim() || undefined,
        bank_address: bankDetails.bankAddress.trim() || undefined,
        paypal: bankDetails.paypal.trim() || undefined,
        guest_address: guestAddress.trim() || undefined,
        expenses: validExpenses.length > 0 ? validExpenses : undefined,
      };
      if (bankDetails.bankType === "uk") {
        (basePayload as Record<string, unknown>).account_number = bankDetails.accountNumber.trim();
        (basePayload as Record<string, unknown>).sort_code = bankDetails.sortCode.trim();
      } else {
        (basePayload as Record<string, unknown>).iban = bankDetails.iban.trim();
        (basePayload as Record<string, unknown>).swift_bic = bankDetails.swiftBic.trim();
      }
      const body = useFormData
        ? (() => {
            const fd = new FormData();
            Object.entries(basePayload).forEach(([k, v]) => {
              if (v != null && v !== "") fd.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
            });
            receiptFiles.forEach((f) => fd.append("receipt_files", f));
            return fd;
          })()
        : JSON.stringify(basePayload);
      const res = await fetch("/api/guest-invoice-submit/generate", {
        method: "POST",
        headers: useFormData ? {} : { "Content-Type": "application/json" },
        body: body as BodyInit,
      });
      const d = await res.json();
      if (res.ok) {
        setSuccessData({ statusToken: d.status_token, invoiceNumber: d.invoice_number });
        setSuccess(true);
      } else {
        if (res.status === 410) {
          setData(null);
          setMode(null);
        }
        setError(d.error ?? "Generation failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNotifyProducer() {
    if (!token || notifyingProducer) return;
    setNotifyingProducer(true);
    setError(null);
    try {
      const res = await fetch("/api/guest-invoice-submit/request-new-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json();
      if (res.ok) {
        setProducerNotified(true);
      } else {
        setError(d.error ?? "Request failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setNotifyingProducer(false);
    }
  }

  if (data === null && error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <div className="mt-6 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/30">
          <p className="font-medium text-rose-800 dark:text-rose-200">{error}</p>
          {producerNotified ? (
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
              We have notified the producer. They will send you a new link soon.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
                If you believe this is a mistake, click below to notify the producer.
              </p>
              {producerContact && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  If you need help, contact <strong>{producerContact.producerName}</strong>
                  {producerContact.producerEmail && <> at <a href={`mailto:${producerContact.producerEmail}`} className="text-sky-600 hover:underline dark:text-sky-400">{producerContact.producerEmail}</a></>}.
                </p>
              )}
              <button
                type="button"
                onClick={handleNotifyProducer}
                disabled={notifyingProducer}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600 min-h-[44px] min-w-[44px] touch-manipulation"
                aria-label="Notify producer about link issue"
              >
                {notifyingProducer ? "Sending…" : "Notify producer"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (success) {
    const statusUrl = successData?.statusToken ? `/submit/status/${successData.statusToken}` : null;
    const downloadUrl = successData?.statusToken ? `/api/guest-invoice-submit/status/${successData.statusToken}?download=1` : null;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <div className="mt-6 max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Invoice submitted successfully</p>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            Thank you! Payment is typically made within 10–14 working days after approval.
          </p>
          {successData?.invoiceNumber && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Reference: {successData.invoiceNumber}</p>
          )}
          {statusUrl && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <a
                href={statusUrl}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600"
              >
                Check invoice status
              </a>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border-2 border-emerald-600 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                >
                  Download invoice
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const inputCls = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white";
  const readOnlyCls = "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400";

  const step = mode === null ? 1 : mode === "upload" ? 2 : 3;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-6 sm:py-8 px-4">
      {submitting && <UploadOverlay message={mode === "generate" ? "Generating invoice…" : "Submitting…"} />}
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center mb-6">
          <TrtLogo size="md" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
          <nav className="flex items-center gap-2 mb-4 text-xs" aria-label="Progress">
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-medium ${step >= 1 ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>1</span>
            <span className={`flex-1 h-0.5 ${step >= 2 ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`} />
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-medium ${step >= 2 ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>2</span>
            <span className={`flex-1 h-0.5 ${step >= 3 ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"}`} />
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-medium ${step >= 3 ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>3</span>
          </nav>
          {sessionExpired && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
              Session may have expired. Please refresh the page to continue.
            </div>
          )}
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Submit your invoice</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hello {data?.guest_name}. Choose how you would like to submit.
          </p>
          {data?.program_name && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Program: {data.program_name}
              {data.recording_date && ` · Recorded: ${data.recording_date}`}
            </p>
          )}

          {mode === null ? (
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => setMode("upload")}
                className="w-full rounded-lg border-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50 min-h-[44px] touch-manipulation"
                aria-label="Upload your invoice file"
              >
                <span className="block font-semibold">I have my invoice ready</span>
                <span className="mt-0.5 block text-xs font-normal opacity-90">Upload your PDF, Word, Excel or JPEG file</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("generate")}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20 min-h-[44px] touch-manipulation"
                aria-label="Generate invoice with bank details"
              >
                <span className="block font-semibold">Generate invoice for me</span>
                <span className="mt-0.5 block text-xs font-normal opacity-90">I don&apos;t have an invoice – create one with my bank details</span>
              </button>
            </div>
          ) : mode === "upload" ? (
            <form onSubmit={handleUpload} className="mt-6 space-y-4">
              <button type="button" onClick={() => setMode(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                ← Back
              </button>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="invoice-file">
                  Invoice file
                </label>
                <input
                  id="invoice-file"
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className={inputCls}
                  aria-describedby="file-hint"
                />
                <p id="file-hint" className="mt-1 text-xs text-gray-500">
                  PDF, Word, Excel or JPEG. Max {MAX_FILE_SIZE_MB} MB.
                </p>
                {file && file.size > MAX_FILE_SIZE_MB * 1024 * 1024 && (
                  <p className="mt-1 text-sm text-amber-600 dark:text-amber-400" role="alert">
                    File is too large ({(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is {MAX_FILE_SIZE_MB} MB.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              {error && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    Retry
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || !file || (file ? file.size > MAX_FILE_SIZE_MB * 1024 * 1024 : false)}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600 min-h-[44px] touch-manipulation"
                aria-busy={submitting}
              >
                {submitting ? "Submitting…" : "Submit invoice"}
              </button>
            </form>
          ) : (
            <form onSubmit={showGenerateSummary ? handleGenerateSubmit : handleGenerateReview} className="mt-6 space-y-4">
              <button type="button" onClick={() => { setMode(null); setShowGenerateSummary(false); }} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                ← Back
              </button>
              {!showGenerateSummary && (
                <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                  This invoice is for <strong>{data?.program_name ?? "this programme"}</strong>. If you appeared on multiple programmes, you will receive a separate link for each.
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {showGenerateSummary ? "Review your invoice before submitting." : "The following details were provided by the producer. Please add your bank details below."}
              </p>
              {!showGenerateSummary && (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Guest name</label>
                  <input type="text" value={data?.guest_name ?? ""} readOnly className={`${inputCls} ${readOnlyCls}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Title</label>
                  <input type="text" value={data?.title ?? ""} readOnly className={`${inputCls} ${readOnlyCls}`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Program</label>
                <input type="text" value={data?.program_name ?? ""} readOnly className={`${inputCls} ${readOnlyCls}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Recording date</label>
                  <input type="text" value={data?.recording_date ?? ""} readOnly className={`${inputCls} ${readOnlyCls}`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Topic</label>
                  <input type="text" value={data?.recording_topic ?? ""} readOnly className={`${inputCls} ${readOnlyCls}`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Amount</label>
                <input
                  type="text"
                  value={data?.payment_amount != null ? `${data.payment_currency === "GBP" ? "£" : data.payment_currency === "EUR" ? "€" : "$"}${data.payment_amount.toLocaleString("en-GB")}` : "—"}
                  readOnly
                  className={`${inputCls} ${readOnlyCls}`}
                />
              </div>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address (optional)</label>
                <input
                  type="text"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="Street, city, postcode"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={hasExpenses}
                    onChange={(e) => {
                      setHasExpenses(e.target.checked);
                      if (!e.target.checked) setExpenses([{ label: "", amount: "" }]);
                    }}
                  />
                  Do you have expenses (e.g. train ticket, parking)?
                </label>
                {hasExpenses && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                      <span className="flex-1">Expense reason (e.g. train ticket, parking)</span>
                      <span className="w-24">Amount</span>
                    </div>
                    {expenses.map((exp, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={exp.label}
                          onChange={(e) => {
                            const next = [...expenses];
                            next[i] = { ...next[i], label: e.target.value };
                            setExpenses(next);
                          }}
                          placeholder="e.g. Train ticket"
                          aria-label="Expense reason"
                          className={`${inputCls} flex-1 min-w-[200px] text-base py-2.5`}
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={exp.amount}
                          onChange={(e) => {
                            const next = [...expenses];
                            next[i] = { ...next[i], amount: e.target.value };
                            setExpenses(next);
                          }}
                          placeholder="0"
                          aria-label="Amount"
                          className={`${inputCls} w-24`}
                        />
                        {expenses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpenses(expenses.filter((_, j) => j !== i))}
                            className="text-rose-600 hover:text-rose-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setExpenses([...expenses, { label: "", amount: "" }])}
                      className="text-sm text-emerald-600 hover:text-emerald-700"
                    >
                      + Add expense
                    </button>
                  </div>
                )}
              </div>
              {hasExpenses && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Receipts (optional)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => setReceiptFiles(Array.from(e.target.files ?? []))}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-gray-500">PDF, JPG or PNG. Receipts will be appended to the invoice.</p>
                </div>
              )}
              </>
              )}
              {!showGenerateSummary && (
              <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your bank details</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Payment is typically made within 10–14 working days after approval.</p>
              <BankDetailsFields values={bankDetails} onChange={setBankDetailsWithStorage} inputCls={inputCls} />
              </>
              )}
              {showGenerateSummary && (
                <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-600 dark:bg-gray-800/50">
                  <p className="font-semibold text-gray-900 dark:text-white">Summary</p>
                  <dl className="mt-2 space-y-1 text-gray-700 dark:text-gray-300">
                    <div><dt className="inline font-medium">Guest:</dt> <dd className="inline">{data?.guest_name}</dd></div>
                    <div><dt className="inline font-medium">Programme:</dt> <dd className="inline">{data?.program_name}</dd></div>
                    <div><dt className="inline font-medium">Amount:</dt> <dd className="inline">{data?.payment_currency === "GBP" ? "£" : data?.payment_currency === "EUR" ? "€" : "$"}{data?.payment_amount?.toLocaleString("en-GB") ?? "—"}</dd></div>
                    <div><dt className="inline font-medium">Account:</dt> <dd className="inline">{bankDetails.accountName} • {bankDetails.bankType === "uk" ? `${bankDetails.sortCode} / ${bankDetails.accountNumber}` : `${bankDetails.iban}`}</dd></div>
                    {hasExpenses && expenses.some((e) => e.label.trim() && e.amount.trim()) && (
                      <div><dt className="inline font-medium">Expenses:</dt> <dd className="inline">{expenses.filter((e) => e.label.trim() && e.amount.trim()).map((e) => `${e.label}: ${data?.payment_currency === "GBP" ? "£" : data?.payment_currency === "EUR" ? "€" : "$"}${e.amount}`).join(", ")}</dd></div>
                    )}
                  </dl>
                </div>
                <button type="button" onClick={() => setShowGenerateSummary(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  ← Edit details
                </button>
                </>
              )}
              {error && (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                  >
                    Retry
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={submitting || (!showGenerateSummary && !!validateBankDetails(bankDetails))}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600 min-h-[44px] touch-manipulation"
                aria-busy={submitting}
              >
                {submitting ? "Generating…" : showGenerateSummary ? "Confirm and submit" : "Review and generate invoice"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
