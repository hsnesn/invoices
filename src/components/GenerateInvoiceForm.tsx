"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(async (r) => {
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error ?? "Request failed");
  return Array.isArray(d) ? d : [];
});

type Appearance = { programmeName: string; topic: string; date: string; amount: string };
type Expense = { label: string; amount: string };

export function GenerateInvoiceForm() {
  const today = new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState("");
  const { data: departments = [] } = useSWR<{ id: string; name: string }[]>("/api/departments", fetcher);
  const { data: programs = [] } = useSWR<{ id: string; name: string; department_id: string }[]>(
    departmentId ? `/api/programs?department_id=${departmentId}` : null,
    fetcher
  );

  const [invNo, setInvNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [currency, setCurrency] = useState<"GBP" | "EUR" | "USD">("GBP");
  const [guestName, setGuestName] = useState("");
  const [guestAddress, setGuestAddress] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [title, setTitle] = useState("");
  const [producer, setProducer] = useState("");
  const [programId, setProgramId] = useState("");
  const [appearances, setAppearances] = useState<Appearance[]>([{ programmeName: "", topic: "", date: today, amount: "" }]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paypal, setPaypal] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [producerLoaded, setProducerLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json();
        if (data?.full_name && !producerLoaded) {
          setProducer(data.full_name);
          setProducerLoaded(true);
        }
      })
      .catch(console.error);
  }, [producerLoaded]);

  useEffect(() => {
    if (departmentId) setProgramId("");
  }, [departmentId]);

  const addAppearance = () => setAppearances((p) => [...p, { programmeName: "", topic: "", date: today, amount: "" }]);
  const removeAppearance = (i: number) => setAppearances((p) => p.filter((_, j) => j !== i));
  const updateAppearance = (i: number, key: keyof Appearance, val: string) =>
    setAppearances((p) => p.map((a, j) => (j === i ? { ...a, [key]: val } : a)));

  const addExpense = () => setExpenses((p) => [...p, { label: "", amount: "" }]);
  const removeExpense = (i: number) => setExpenses((p) => p.filter((_, j) => j !== i));
  const updateExpense = (i: number, key: keyof Expense, val: string) =>
    setExpenses((p) => p.map((e, j) => (j === i ? { ...e, [key]: val } : e)));

  const progName = programs.find((p) => p.id === programId)?.name ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!invNo.trim()) { setError("INV NO is required"); return; }
    if (!guestName.trim()) { setError("Guest name is required"); return; }
    if (!title.trim() || !producer.trim()) { setError("Title and Producer are required for list display"); return; }
    if (!departmentId || !programId) { setError("Department and Programme are required"); return; }
    const validAppearances = appearances.filter((a) => a.topic.trim() && a.date && parseFloat(a.amount) > 0);
    if (validAppearances.length === 0) { setError("At least one appearance with topic, date and amount is required"); return; }
    if (!accountName.trim() || !accountNumber.trim() || !sortCode.trim()) {
      setError("Account name, account number and sort code are required");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append(
        "data",
        JSON.stringify({
          invNo: invNo.trim(),
          invoiceDate: invoiceDate,
          currency,
          guestName: guestName.trim(),
          guestAddress: guestAddress.trim() || undefined,
          guestEmail: guestEmail.trim() || undefined,
          guestPhone: guestPhone.trim() || undefined,
          appearances: validAppearances.map((a) => ({
            programmeName: progName,
            topic: a.topic.trim(),
            date: a.date,
            amount: parseFloat(a.amount) || 0,
          })),
          expenses: expenses
            .filter((e) => e.label.trim() && parseFloat(e.amount) > 0)
            .map((e) => ({ label: e.label.trim(), amount: parseFloat(e.amount) || 0 })),
          paypal: paypal.trim() || undefined,
          accountName: accountName.trim(),
          bankName: bankName.trim() || undefined,
          accountNumber: accountNumber.trim(),
          sortCode: sortCode.trim(),
          bankAddress: bankAddress.trim() || undefined,
          department_id: departmentId,
          program_id: programId,
          title: title.trim(),
          producer: producer.trim(),
        })
      );
      supportingFiles.forEach((f) => formData.append("supporting_files", f));

      const res = await fetch("/api/invoices/generate", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push("/invoices");
      } else {
        setError((result as { error?: string }).error ?? "Generate failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  };

  const subtotal = appearances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const total = subtotal + expenseTotal;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-slate-600">
        Generate an invoice when the guest has not provided one. The PDF will be created and added to the Files section.
      </p>

      {/* Internal - for list display (not on invoice) */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">For list display (not on invoice)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Producer <span className="text-red-500">*</span></label>
            <input value={producer} onChange={(e) => setProducer(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Department <span className="text-red-500">*</span></label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option value="">Select...</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Programme <span className="text-red-500">*</span></label>
            <select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!departmentId} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option value="">Select...</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Invoice header */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-semibold text-slate-800">INV NO <span className="text-red-500">*</span></label>
          <input value={invNo} onChange={(e) => setInvNo(e.target.value)} placeholder="INV-2024-001" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800">Date <span className="text-red-500">*</span></label>
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as "GBP" | "EUR" | "USD")} className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
            <option value="GBP">GBP (£)</option>
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      {/* FROM - Guest */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800">FROM (Guest)</h3>
        <div className="mt-2 space-y-2">
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest Name *" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={guestAddress} onChange={(e) => setGuestAddress(e.target.value)} placeholder="Address" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Phone" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
        </div>
      </div>

      {/* Appearances */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Appearances</h3>
          <button type="button" onClick={addAppearance} className="text-sm font-medium text-sky-600 hover:text-sky-700">+ Add</button>
        </div>
        <div className="mt-2 space-y-2">
          {appearances.map((a, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <input value={a.topic} onChange={(e) => updateAppearance(i, "topic", e.target.value)} placeholder="Topic *" className="flex-1 min-w-[120px] rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
              <input type="date" value={a.date} onChange={(e) => updateAppearance(i, "date", e.target.value)} className="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
              <input value={a.amount} onChange={(e) => updateAppearance(i, "amount", e.target.value)} placeholder="Amount" type="number" step="0.01" min="0" className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
              <button type="button" onClick={() => removeAppearance(i)} className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Remove</button>
            </div>
          ))}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-600">Subtotal: {currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}{subtotal.toFixed(2)}</p>
      </div>

      {/* Expenses */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Expenses (Travel, Parking, etc.)</h3>
          <button type="button" onClick={addExpense} className="text-sm font-medium text-sky-600 hover:text-sky-700">+ Add</button>
        </div>
        <div className="mt-2 space-y-2">
          {expenses.map((e, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-600">
              <input value={e.label} onChange={(ev) => updateExpense(i, "label", ev.target.value)} placeholder="e.g. Travel, Parking" className="flex-1 min-w-[120px] rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
              <input value={e.amount} onChange={(ev) => updateExpense(i, "amount", ev.target.value)} placeholder="Amount" type="number" step="0.01" min="0" className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
              <button type="button" onClick={() => removeExpense(i)} className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Remove</button>
            </div>
          ))}
        </div>
        {expenseTotal > 0 && <p className="mt-1 text-sm font-medium text-slate-600">Expenses total: {currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}{expenseTotal.toFixed(2)}</p>}
        <p className="mt-1 text-sm font-bold text-slate-800">TOTAL: {currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}{total.toFixed(2)}</p>
      </div>

      {/* Payment */}
      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-600">
        <h3 className="text-sm font-semibold text-slate-800">Payment</h3>
        <p className="mt-1 text-xs text-slate-500">We prefer PayPal if you have one.</p>
        <div className="mt-3 space-y-2">
          <input value={paypal} onChange={(e) => setPaypal(e.target.value)} placeholder="PayPal (email or account)" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account Name *" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank Name" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account Number *" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={sortCode} onChange={(e) => setSortCode(e.target.value)} placeholder="Sort Code * (e.g. 09-01-27)" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          <input value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} placeholder="Bank Address" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
        </div>
      </div>

      {/* Supporting documents */}
      <div>
        <label className="block text-sm font-semibold text-slate-800">Supporting documents (tickets, receipts)</label>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png"
          onChange={(e) => setSupportingFiles(Array.from(e.target.files ?? []))}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 file:mr-4 file:rounded file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-white dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        {supportingFiles.length > 0 && <p className="mt-1 text-sm text-sky-600">{supportingFiles.length} file(s) selected</p>}
      </div>

      <button type="submit" disabled={loading} className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
        {loading ? "Generating..." : "Generate Invoice"}
      </button>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </form>
  );
}
