"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BankDetailsFields, BANK_DETAILS_DEFAULT, validateBankDetails, type BankDetailsValues } from "@/components/BankDetailsFields";

export function SendInvoiceLinkModal({
  initialGuestName,
  initialEmail,
  initialProgramName = "",
  initialTitle = "",
  initialPhone = "",
  initialPaymentCurrency,
  programs: programNames,
  onClose,
  onSent,
}: {
  initialGuestName: string;
  initialEmail: string | null;
  initialProgramName?: string;
  initialTitle?: string;
  initialPhone?: string;
  /** Only pass when guest has a previously saved currency. New guests get empty. */
  initialPaymentCurrency?: string;
  programs: string[];
  onClose: () => void;
  onSent: (message?: string) => void;
}) {
  const [guestName, setGuestName] = useState(initialGuestName);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [title, setTitle] = useState(initialTitle);
  const [phone, setPhone] = useState(initialPhone);
  const [programName, setProgramName] = useState(initialProgramName);
  const [recordingDate, setRecordingDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordingTopic, setRecordingTopic] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState(initialPaymentCurrency ?? "");
  const [generateInvoice, setGenerateInvoice] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [bankDetails, setBankDetails] = useState<BankDetailsValues>(BANK_DETAILS_DEFAULT);
  const [sending, setSending] = useState(false);
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    const em = email.trim();
    const prog = programName.trim();
    const date = recordingDate.trim();
    const topic = recordingTopic.trim();
    if (!name || name.length < 2) {
      toast.error("Guest name is required");
      return;
    }
    if (!em || !em.includes("@")) {
      toast.error("Valid email is required");
      return;
    }
    if (!prog || prog.length < 2) {
      toast.error("Program name is required");
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Recording date is required (YYYY-MM-DD)");
      return;
    }
    if (!topic || topic.length < 2) {
      toast.error("Recording topic is required");
      return;
    }
    const titleVal = title.trim();
    if (!titleVal || titleVal.length < 2) {
      toast.error("Title is required");
      return;
    }
    const amount = parseFloat(paymentAmount) || 0;
    if (amount > 0 && !paymentCurrency.trim()) {
      toast.error("Currency is required when payment amount is specified");
      return;
    }
    if (generateInvoice) {
      if (!invoiceNumber.trim()) {
        toast.error("Invoice number is required when generating invoice");
        return;
      }
      const bankErr = validateBankDetails(bankDetails);
      if (bankErr) {
        toast.error(bankErr);
        return;
      }
    }
    setSending(true);
    try {
      const res = await fetch("/api/guest-invoice-submit/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name,
          email: em,
          title: titleVal,
          phone: phone.trim() || undefined,
          program_name: prog,
          recording_date: date,
          recording_topic: topic,
          payment_amount: amount,
          payment_currency: paymentCurrency.trim() || undefined,
          generate_invoice_for_guest: generateInvoice,
          invoice_number: generateInvoice ? invoiceNumber.trim() : undefined,
          invoice_date: generateInvoice ? invoiceDate : undefined,
          account_name: generateInvoice ? bankDetails.accountName.trim() : undefined,
          bank_name: generateInvoice ? bankDetails.bankName.trim() : undefined,
          bank_address: generateInvoice ? bankDetails.bankAddress.trim() : undefined,
          paypal: generateInvoice ? bankDetails.paypal.trim() : undefined,
          bank_type: generateInvoice ? bankDetails.bankType : undefined,
          account_number: generateInvoice && bankDetails.bankType === "uk" ? bankDetails.accountNumber.trim() : undefined,
          sort_code: generateInvoice && bankDetails.bankType === "uk" ? bankDetails.sortCode.trim() : undefined,
          iban: generateInvoice && bankDetails.bankType === "international" ? bankDetails.iban.trim() : undefined,
          swift_bic: generateInvoice && bankDetails.bankType === "international" ? bankDetails.swiftBic.trim() : undefined,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        onSent(data.message);
      } else {
        toast.error(data.error ?? "Failed to send link");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="send-invoice-link-title">
      <div className="w-full max-w-md rounded-xl border-2 border-emerald-600 bg-white p-6 shadow-xl dark:border-emerald-500 dark:bg-gray-800 my-4" onClick={(e) => e.stopPropagation()}>
        <div className="-mx-6 -mt-6 mb-4 rounded-t-xl bg-emerald-600 px-6 py-3 dark:bg-emerald-700">
          <h2 id="send-invoice-link-title" className="text-lg font-semibold text-white">Send invoice submit link</h2>
        </div>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Fill in the details below. The guest will receive an email with a link to upload their invoice online. The link is valid for 7 days.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Guest name *</label>
            <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} required className={inputCls} placeholder="Guest full name" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder="guest@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} placeholder="e.g. Professor, Analyst" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+44 20 1234 5678" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Program name *</label>
            <input type="text" value={programName} onChange={(e) => setProgramName(e.target.value)} list="send-link-programs" required className={inputCls} placeholder="e.g. Newshour" />
            <datalist id="send-link-programs">
              {programNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Recording date *</label>
            <input type="date" value={recordingDate} onChange={(e) => setRecordingDate(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Recording topic *</label>
            <input type="text" value={recordingTopic} onChange={(e) => setRecordingTopic(e.target.value)} required className={inputCls} placeholder="e.g. Foreign Policy" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium">Payment amount</label>
              <input type="number" min={0} step={0.01} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <select value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value)} className={inputCls}>
                <option value="">Select currency</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={generateInvoice}
                onChange={(e) => {
                  const gen = e.target.checked;
                  setGenerateInvoice(gen);
                  if (gen && !invoiceNumber) {
                    fetch("/api/invoices/next-invoice-number", { credentials: "same-origin" })
                      .then((r) => r.json())
                      .then((d) => d?.next_invoice_number && setInvoiceNumber(d.next_invoice_number))
                      .catch(() => {});
                  }
                }}
                className="h-4 w-4 rounded text-emerald-600"
              />
              <span className="text-sm font-medium">Generate invoice on behalf of guest</span>
            </label>
          </div>
          {generateInvoice && (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Invoice number *</label>
                  <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputCls} placeholder="e.g. INV-2025-001" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Invoice date</label>
                  <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={inputCls} />
                </div>
              </div>
              <BankDetailsFields
                values={bankDetails}
                onChange={setBankDetails}
                inputCls={inputCls}
                showPaypalEncouragement={true}
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={sending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              {sending ? "Sending..." : "Send link"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
