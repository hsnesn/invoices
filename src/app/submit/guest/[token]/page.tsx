"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TrtLogo } from "@/components/TrtLogo";

type GuestData = {
  guest_name: string;
  title: string | null;
  program_name: string | null;
  recording_date: string | null;
  recording_topic: string | null;
  payment_amount: number | null;
  payment_currency: string | null;
};

export default function GuestInvoiceSubmitPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<GuestData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<"upload" | "generate" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [currency, setCurrency] = useState("GBP");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [paypal, setPaypal] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [hasExpenses, setHasExpenses] = useState(false);
  const [expenses, setExpenses] = useState<{ label: string; amount: string }[]>([{ label: "", amount: "" }]);
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/guest-invoice-submit/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setData(d);
          if (d.payment_currency) setCurrency(d.payment_currency);
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [token]);

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
        setSuccess(true);
      } else {
        setError(d.error ?? "Upload failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !accountName.trim() || !accountNumber.trim() || !sortCode.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const validExpenses = hasExpenses
        ? expenses
            .filter((e) => e.label.trim() && e.amount.trim() && !Number.isNaN(parseFloat(e.amount)))
            .map((e) => ({ label: e.label.trim(), amount: parseFloat(e.amount) }))
        : [];
      const useFormData = receiptFiles.length > 0;
      const body = useFormData
        ? (() => {
            const fd = new FormData();
            fd.set("token", token);
            fd.set("account_name", accountName.trim());
            fd.set("account_number", accountNumber.trim());
            fd.set("sort_code", sortCode.trim());
            if (bankName.trim()) fd.set("bank_name", bankName.trim());
            if (bankAddress.trim()) fd.set("bank_address", bankAddress.trim());
            if (paypal.trim()) fd.set("paypal", paypal.trim());
            if (guestAddress.trim()) fd.set("guest_address", guestAddress.trim());
            if (validExpenses.length > 0) fd.set("expenses", JSON.stringify(validExpenses));
            receiptFiles.forEach((f) => fd.append("receipt_files", f));
            return fd;
          })()
        : JSON.stringify({
            token,
            account_name: accountName.trim(),
            account_number: accountNumber.trim(),
            sort_code: sortCode.trim(),
            bank_name: bankName.trim() || undefined,
            bank_address: bankAddress.trim() || undefined,
            paypal: paypal.trim() || undefined,
            guest_address: guestAddress.trim() || undefined,
            expenses: validExpenses.length > 0 ? validExpenses : undefined,
          });
      const res = await fetch("/api/guest-invoice-submit/generate", {
        method: "POST",
        headers: useFormData ? {} : { "Content-Type": "application/json" },
        body: body as BodyInit,
      });
      const d = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(d.error ?? "Generation failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <p className="mt-4 text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <div className="mt-6 max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-800 dark:bg-rose-950/30">
          <p className="font-medium text-rose-800 dark:text-rose-200">{error}</p>
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">
            Please contact the producer if you need a new link.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4">
        <TrtLogo size="md" />
        <div className="mt-6 max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Invoice submitted successfully</p>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
            Thank you! We will process your payment as soon as possible.
          </p>
        </div>
      </div>
    );
  }

  const inputCls = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white";
  const readOnlyCls = "bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-8 px-4">
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center mb-6">
          <TrtLogo size="md" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/60">
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
                className="w-full rounded-lg border-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50"
              >
                <span className="block font-semibold">I have my invoice ready</span>
                <span className="mt-0.5 block text-xs font-normal opacity-90">Upload your PDF, Word, Excel or JPEG file</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("generate")}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice file</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg"
                  required
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-gray-500">PDF, Word, Excel or JPEG. Max 10 MB.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
              {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              <button type="submit" disabled={submitting || !file} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                {submitting ? "Submitting…" : "Submit invoice"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleGenerate} className="mt-6 space-y-4">
              <button type="button" onClick={() => setMode(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                ← Back
              </button>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The following details were provided by the producer. Please add your bank details below.
              </p>
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
                          className={`${inputCls} flex-1`}
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
                          placeholder="Amount"
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
              <hr className="border-gray-200 dark:border-gray-700" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your bank details</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account name *</label>
                <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account number *</label>
                <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort code *</label>
                <input type="text" value={sortCode} onChange={(e) => setSortCode(e.target.value)} placeholder="e.g. 12-34-56" required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank name</label>
                <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank address</label>
                <input type="text" value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PayPal (optional)</label>
                <input type="text" value={paypal} onChange={(e) => setPaypal(e.target.value)} placeholder="email@example.com" className={inputCls} />
              </div>
              {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              <button type="submit" disabled={submitting || !accountName.trim() || !accountNumber.trim() || !sortCode.trim()} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600">
                {submitting ? "Generating…" : "Generate invoice"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
