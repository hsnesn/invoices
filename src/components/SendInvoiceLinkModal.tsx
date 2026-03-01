"use client";

import { useState } from "react";
import { toast } from "sonner";

export function SendInvoiceLinkModal({
  initialGuestName,
  initialEmail,
  initialProgramName = "",
  initialTitle = "",
  initialPhone = "",
  programs: programNames,
  onClose,
  onSent,
}: {
  initialGuestName: string;
  initialEmail: string | null;
  initialProgramName?: string;
  initialTitle?: string;
  initialPhone?: string;
  programs: string[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [guestName, setGuestName] = useState(initialGuestName);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [title, setTitle] = useState(initialTitle);
  const [phone, setPhone] = useState(initialPhone);
  const [programName, setProgramName] = useState(initialProgramName);
  const [recordingDate, setRecordingDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordingTopic, setRecordingTopic] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("GBP");
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
    setSending(true);
    try {
      const res = await fetch("/api/guest-invoice-submit/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: name,
          email: em,
          title: title.trim() || undefined,
          phone: phone.trim() || undefined,
          program_name: prog,
          recording_date: date,
          recording_topic: topic,
          payment_amount: parseFloat(paymentAmount) || 0,
          payment_currency: paymentCurrency,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        onSent();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800 my-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Send invoice submit link</h2>
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
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Professor, Analyst" />
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
            <div className="w-24">
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <select value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value)} className={inputCls}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={sending} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
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
