"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { BankDetailsFields, BANK_DETAILS_DEFAULT, validateBankDetails, type BankDetailsValues } from "@/components/BankDetailsFields";

type DuplicateHit = {
  id: string;
  guest: string;
  amount: number | null;
  date: string | null;
  status: string;
  invoice_number: string | null;
  match_reasons: string[];
};

const fetcher = (url: string) => fetch(url).then(async (r) => {
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error ?? "Request failed");
  return Array.isArray(d) ? d : [];
});

type Appearance = { programmeName: string; topic: string; date: string; amount: string };
type Expense = { label: string; amount: string };

type GuestTemplate = {
  id: string;
  name: string;
  title: string | null;
  guest_name: string | null;
  guest_address: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  account_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  bank_address: string | null;
  paypal: string | null;
  bank_type?: string | null;
  iban?: string | null;
  swift_bic?: string | null;
  department_id: string | null;
  program_id: string | null;
};

export function GenerateInvoiceForm({ guestId }: { guestId?: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const [departmentId, setDepartmentId] = useState("");
  const { data: departments = [] } = useSWR<{ id: string; name: string }[]>("/api/departments", fetcher);
  const { data: programs = [] } = useSWR<{ id: string; name: string; department_id: string }[]>(
    departmentId ? `/api/programs?department_id=${departmentId}` : null,
    fetcher
  );

  const [invNo, setInvNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
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
  const [bankDetails, setBankDetails] = useState<BankDetailsValues>(BANK_DETAILS_DEFAULT);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateMessage, setTemplateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const skipDuplicateCheckRef = useRef(false);

  const checkDuplicates = useCallback(async (): Promise<DuplicateHit[]> => {
    if (!guestName.trim()) return [];
    try {
      const firstDate = appearances[0]?.date || invoiceDate;
      const res = await fetch("/api/invoices/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: guestName.trim(),
          invoice_date: firstDate || undefined,
          department_id: departmentId || undefined,
          invoice_type: "guest",
        }),
      });
      const data = await res.json();
      const dups = data.duplicates ?? [];
      setDuplicates(dups);
      setDuplicateChecked(true);
      return dups;
    } catch {
      setDuplicateChecked(true);
      return [];
    }
  }, [guestName, departmentId, invoiceDate, appearances]);

  const templatesFetcher = (url: string) =>
    fetch(url).then(async (r) => {
      const d = await r.json();
      if (!r.ok) return [] as GuestTemplate[];
      return Array.isArray(d) ? d : [];
    });
  const { data: templates = [], mutate: mutateTemplates } = useSWR<GuestTemplate[]>(
    "/api/guest-invoice-templates",
    templatesFetcher
  );

  // Auto-fill from last invitation when guestId is provided (e.g. from Invited Guests "Create invoice")
  useEffect(() => {
    if (!guestId?.trim()) return;
    fetch(`/api/producer-guests/${guestId}/last-invitation`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.guest_name) setGuestName(data.guest_name);
        if (data?.guest_email) setGuestEmail(data.guest_email);
        if (data?.program_name || data?.program_specific_topic || data?.record_date) {
          const defaultDate = new Date().toISOString().slice(0, 10);
          setAppearances((prev) => {
            const first = prev[0] ?? { programmeName: "", topic: "", date: defaultDate, amount: "" };
            return [
              {
                ...first,
                programmeName: data.program_name || first.programmeName,
                topic: data.program_specific_topic || first.topic,
                date: data.record_date && /^\d{4}-\d{2}-\d{2}$/.test(data.record_date) ? data.record_date : first.date,
              },
              ...prev.slice(1),
            ];
          });
        }
      })
      .catch(() => {});
  }, [guestId]);

  const loadTemplate = (t: GuestTemplate, startEdit = false) => {
    setTitle(t.title ?? "");
    setGuestName(t.guest_name ?? "");
    setGuestAddress(t.guest_address ?? "");
    setGuestPhone(t.guest_phone ?? "");
    setGuestEmail(t.guest_email ?? "");
    setBankDetails({
      bankType: t.bank_type === "international" ? "international" : "uk",
      accountName: t.account_name ?? "",
      bankName: t.bank_name ?? "",
      accountNumber: t.account_number ?? "",
      sortCode: t.sort_code ?? "",
      bankAddress: t.bank_address ?? "",
      iban: t.iban ?? "",
      swiftBic: t.swift_bic ?? "",
      paypal: t.paypal ?? "",
    });
    if (t.department_id) setDepartmentId(t.department_id);
    if (t.program_id) setProgramId(t.program_id);
    setSaveTemplateName(t.name);
    setEditingTemplateId(startEdit ? t.id : null);
    setTemplateMessage(null);
  };

  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/guest-invoice-templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        mutateTemplates();
        if (editingTemplateId === id) {
          setEditingTemplateId(null);
          setSaveTemplateName("");
        }
      }
    } catch {
      setTemplateMessage({ type: "error", text: "Failed to delete template" });
    }
  };

  const updateTemplate = async () => {
    if (!editingTemplateId) return;
    const name = saveTemplateName.trim();
    if (!name) {
      setTemplateMessage({ type: "error", text: "Template name is required" });
      return;
    }
    setSavingTemplate(true);
    setTemplateMessage(null);
    try {
      const res = await fetch(`/api/guest-invoice-templates/${editingTemplateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title,
          guest_name: guestName,
          guest_address: guestAddress,
          guest_phone: guestPhone,
          guest_email: guestEmail,
          account_name: bankDetails.accountName,
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          sort_code: bankDetails.sortCode,
          bank_address: bankDetails.bankAddress,
          paypal: bankDetails.paypal,
          bank_type: bankDetails.bankType,
          iban: bankDetails.iban,
          swift_bic: bankDetails.swiftBic,
          department_id: departmentId || undefined,
          program_id: programId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        mutateTemplates();
        setEditingTemplateId(null);
        setSaveTemplateName("");
        setTemplateMessage({ type: "success", text: "Template updated" });
      } else {
        setTemplateMessage({ type: "error", text: data.error ?? "Failed to update template" });
      }
    } catch {
      setTemplateMessage({ type: "error", text: "Connection error" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const saveAsTemplate = async () => {
    const name = saveTemplateName.trim();
    if (!name) {
      setTemplateMessage({ type: "error", text: "Template name is required" });
      return;
    }
    setSavingTemplate(true);
    setTemplateMessage(null);
    try {
      const res = await fetch("/api/guest-invoice-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title,
          guest_name: guestName,
          guest_address: guestAddress,
          guest_phone: guestPhone,
          guest_email: guestEmail,
          account_name: bankDetails.accountName,
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          sort_code: bankDetails.sortCode,
          bank_address: bankDetails.bankAddress,
          paypal: bankDetails.paypal,
          bank_type: bankDetails.bankType,
          iban: bankDetails.iban,
          swift_bic: bankDetails.swiftBic,
          department_id: departmentId || undefined,
          program_id: programId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        mutateTemplates();
        setSaveTemplateName("");
        setEditingTemplateId(null);
        setTemplateMessage({ type: "success", text: "Template saved" });
      } else {
        setTemplateMessage({ type: "error", text: data.error ?? "Failed to save template" });
      }
    } catch {
      setTemplateMessage({ type: "error", text: "Connection error" });
    } finally {
      setSavingTemplate(false);
    }
  };

  // Producer is not auto-filled; user must enter/select explicitly

  useEffect(() => {
    if (departmentId) {
      setProgramId("");
    }
  }, [departmentId]);

  useEffect(() => {
    if (!guestName.trim()) {
      setDuplicates([]);
      setDuplicateChecked(false);
      return;
    }
    const t = setTimeout(() => void checkDuplicates(), 400);
    return () => clearTimeout(t);
  }, [guestName, departmentId, checkDuplicates]);

  // When department has no programs (e.g. "Other departments"), program stays None
  const departmentHasPrograms = programs.length > 0;

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
    if (!invoiceDate) { setError("Invoice date is required"); return; }
    if (!guestName.trim()) { setError("Guest name is required"); return; }
    if (!title.trim() || !producer.trim()) { setError("Title and Producer are required for list display"); return; }
    if (!departmentId) { setError("Department is required"); return; }
    if (departmentHasPrograms && !programId) { setError("Programme name is required when a department with programmes is selected"); return; }
    const validAppearances = appearances.filter((a) => a.topic.trim() && a.date && parseFloat(a.amount) > 0);
    if (validAppearances.length === 0) { setError("At least one appearance with topic, date and amount is required"); return; }
    const bankErr = validateBankDetails(bankDetails);
    if (bankErr) {
      setError(bankErr);
      return;
    }

    if (!skipDuplicateCheckRef.current) {
      const dups = duplicateChecked ? duplicates : await checkDuplicates();
      if (dups.length > 0) {
        setShowDuplicateWarning(true);
        return;
      }
    }
    skipDuplicateCheckRef.current = false;

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
          paypal: bankDetails.paypal.trim() || undefined,
          accountName: bankDetails.accountName.trim(),
          bankName: bankDetails.bankName.trim() || undefined,
          bankAddress: bankDetails.bankAddress.trim() || undefined,
          bank_type: bankDetails.bankType,
          ...(bankDetails.bankType === "uk"
            ? { accountNumber: bankDetails.accountNumber.trim(), sortCode: bankDetails.sortCode.trim() }
            : { iban: bankDetails.iban.trim(), swift_bic: bankDetails.swiftBic.trim() }),
          department_id: departmentId,
          program_id: programId || undefined,
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

      {duplicates.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950/40" role="alert">
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">Possible duplicate invoice{duplicates.length > 1 ? "s" : ""} detected</p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">We found {duplicates.length} existing invoice{duplicates.length > 1 ? "s" : ""} that may match. Please verify before submitting.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {duplicates.slice(0, 3).map((d) => (
                  <a key={d.id} href={`/invoices?expand=${d.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-amber-200 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700">
                    {d.guest} {d.invoice_number ? `#${d.invoice_number}` : ""}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template selector and save */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-800/50">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Saved templates</h3>
        <p className="mt-1 text-xs text-slate-500">Load a template to pre-fill guest and bank details, or save the current form as a template.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) {
                const t = templates.find((x) => x.id === id);
                if (t) loadTemplate(t, false);
                e.target.value = "";
              }
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            aria-label="Load template"
          >
            <option value="">Load template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              value={saveTemplateName}
              onChange={(e) => setSaveTemplateName(e.target.value)}
              placeholder="Template name"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
              aria-label="Template name for save"
            />
            {editingTemplateId ? (
              <>
                <button
                  type="button"
                  onClick={updateTemplate}
                  disabled={savingTemplate || !saveTemplateName.trim()}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {savingTemplate ? "Updating..." : "Update template"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingTemplateId(null); setSaveTemplateName(""); setTemplateMessage(null); }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={savingTemplate || !saveTemplateName.trim()}
                className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
              >
                {savingTemplate ? "Saving..." : "Save as template"}
              </button>
            )}
          </div>
        </div>
        {templateMessage && (
          <p className={`mt-2 text-sm ${templateMessage.type === "success" ? "text-emerald-600" : "text-red-600"}`}>
            {templateMessage.text}
          </p>
        )}
        {templates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 ${editingTemplateId === t.id ? "ring-2 ring-sky-500 bg-sky-100 dark:bg-sky-900/40" : "bg-slate-200 dark:bg-slate-600"}`}
              >
                <button
                  type="button"
                  onClick={() => loadTemplate(t)}
                  className="hover:underline"
                >
                  {t.name}
                </button>
                <button
                  type="button"
                  onClick={() => loadTemplate(t, true)}
                  className="rounded p-0.5 text-slate-500 hover:bg-slate-300 hover:text-sky-600 dark:hover:bg-slate-500 dark:hover:text-sky-400"
                  aria-label={`Edit template ${t.name}`}
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(t.id)}
                  className="rounded p-0.5 text-slate-500 hover:bg-slate-300 hover:text-red-600 dark:hover:bg-slate-500 dark:hover:text-red-400"
                  aria-label={`Delete template ${t.name}`}
                  title="Delete"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

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
            <label className="block text-sm font-medium text-slate-700">
              Programme {departmentHasPrograms ? <span className="text-red-500">*</span> : <span className="text-slate-400">(None for other departments)</span>}
            </label>
            <select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!departmentId} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
              <option value="">{departmentHasPrograms ? "Select..." : "None"}</option>
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
        <div className="mt-3">
          <BankDetailsFields
            values={bankDetails}
            onChange={setBankDetails}
            inputCls="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
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

      {showDuplicateWarning && duplicates.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-amber-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-4 dark:border-amber-800 dark:bg-amber-950/30 rounded-t-2xl">
              <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
              <div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">Possible Duplicate Invoice</h3>
                <p className="text-sm text-amber-600 dark:text-amber-400">We found existing invoices that may be duplicates. Continue anyway?</p>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto px-6 py-4 space-y-3">
              {duplicates.map((d) => (
                <div key={d.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">{d.guest}</span>
                    <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200">{d.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    {d.match_reasons.map((r) => (
                      <span key={r} className="rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-900/50">{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowDuplicateWarning(false)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateWarning(false);
                  skipDuplicateCheckRef.current = true;
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
