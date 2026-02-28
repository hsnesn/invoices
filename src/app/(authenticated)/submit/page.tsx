"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { getApiErrorMessage, toUserFriendlyError } from "@/lib/error-messages";
import { GenerateInvoiceForm } from "@/components/GenerateInvoiceForm";
import { LogoLoader } from "@/components/LogoLoader";
import { UploadOverlay } from "@/components/UploadOverlay";
import AutocompleteInput from "@/components/AutocompleteInput";
import { toast } from "sonner";

type DuplicateHit = {
  id: string;
  guest: string;
  amount: number | null;
  date: string | null;
  status: string;
  invoice_number: string | null;
  match_reasons: string[];
};

type FormTemplate = {
  name: string;
  departmentId: string;
  programId: string;
  producer: string;
  paymentType: string;
  currency: string;
};
const TEMPLATES_KEY = "invoice-templates";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error ?? "Request failed");
    return Array.isArray(d) ? d : [];
  });

export default function SubmitPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center p-12 text-slate-500">Loading...</div>}>
      <SubmitPageContent />
    </Suspense>
  );
}

type Tab = "upload" | "generate";

function SubmitPageContent() {
  const searchParams = useSearchParams();
  const guestIdFromUrl = searchParams.get("guest_id");
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(tabFromUrl === "generate" || guestIdFromUrl ? "generate" : "upload");
  const today = new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const rejectedId = searchParams.get("rejected");

  const [departmentId, setDepartmentId] = useState("");
  const { data: departments = [], error: deptError } = useSWR<{ id: string; name: string }[]>("/api/departments", fetcher);
  const { data: programs = [] } = useSWR<{ id: string; name: string; department_id: string }[]>(
    departmentId ? `/api/programs?department_id=${departmentId}` : null,
    fetcher
  );
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [title, setTitle] = useState("");
  const [producer, setProducer] = useState("");
  const [producerLoaded, setProducerLoaded] = useState(false);
  const [topic, setTopic] = useState("");
  const [programId, setProgramId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [txDate1, setTxDate1] = useState(today);
  const [txDate2, setTxDate2] = useState("");
  const [txDate3, setTxDate3] = useState("");
  const [paymentType, setPaymentType] = useState<"paid_guest" | "unpaid_guest" | "">("");
  const [currency, setCurrency] = useState("GBP");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draftBanner, setDraftBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const ALLOWED_EXTS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".jpg", ".jpeg"];

  useEffect(() => {
    if (deptError) setError(deptError.message ?? "Failed to load departments");
  }, [deptError]);

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

  // --- Draft auto-save (debounced 10s) ---
  const DRAFT_KEY = "invoice-draft";

  useEffect(() => {
    const timer = setTimeout(() => {
      const draft = { guestName, guestPhone, guestEmail, title, producer, topic, departmentId, programId, invoiceDate, txDate1, txDate2, txDate3, paymentType, currency };
      const hasContent = Object.values(draft).some((v) => typeof v === "string" && v.trim() !== "");
      if (hasContent) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    }, 10_000);
    return () => clearTimeout(timer);
  }, [guestName, guestPhone, guestEmail, title, producer, topic, departmentId, programId, invoiceDate, txDate1, txDate2, txDate3, paymentType, currency]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraftBanner(true);
    } catch { /* noop */ }
  }, []);

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.guestName) setGuestName(d.guestName);
      if (d.guestPhone) setGuestPhone(d.guestPhone);
      if (d.guestEmail) setGuestEmail(d.guestEmail);
      if (d.title) setTitle(d.title);
      if (d.producer) { setProducer(d.producer); setProducerLoaded(true); }
      if (d.topic) setTopic(d.topic);
      if (d.departmentId) setDepartmentId(d.departmentId);
      if (d.programId) setTimeout(() => setProgramId(d.programId), 200);
      if (d.invoiceDate) setInvoiceDate(d.invoiceDate);
      if (d.txDate1) setTxDate1(d.txDate1);
      if (d.txDate2) setTxDate2(d.txDate2);
      if (d.txDate3) setTxDate3(d.txDate3);
      if (d.paymentType) setPaymentType(d.paymentType);
      if (d.currency) setCurrency(d.currency);
    } catch { /* noop */ }
    setDraftBanner(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraftBanner(false);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEMPLATES_KEY);
      if (saved) setTemplates(JSON.parse(saved));
    } catch { /* noop */ }
  }, []);

  function saveTemplate() {
    if (!templateName.trim()) return;
    const t: FormTemplate = { name: templateName.trim(), departmentId, programId, producer, paymentType, currency };
    const updated = [...templates.filter(x => x.name !== t.name), t];
    setTemplates(updated);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setShowSaveTemplate(false);
    setTemplateName("");
    toast.success("Template saved");
  }

  function loadTemplate(t: FormTemplate) {
    setDepartmentId(t.departmentId);
    setProgramId(t.programId);
    setProducer(t.producer);
    setPaymentType(t.paymentType as typeof paymentType);
    setCurrency(t.currency);
    toast.success(`Template "${t.name}" loaded`);
  }

  function deleteTemplate(name: string) {
    const updated = templates.filter(x => x.name !== name);
    setTemplates(updated);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
  }

  // --- Drag-and-drop helpers ---
  const validateAndMergeFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      return ALLOWED_EXTS.includes(ext);
    });
    if (valid.length < incoming.length) {
      setError(`${incoming.length - valid.length} file(s) skipped (unsupported type). Allowed: PDF, DOCX, DOC, XLSX, XLS, JPEG`);
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const deduped = valid.filter((f) => !existing.has(`${f.name}-${f.size}-${f.lastModified}`));
      return [...prev, ...deduped];
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) validateAndMergeFiles(dropped);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  };

  const markTouched = (field: string) => () => setTouched((p) => ({ ...p, [field]: true }));

  const checkDuplicates = useCallback(async () => {
    if (!guestName.trim()) return;
    try {
      const res = await fetch("/api/invoices/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: guestName.trim(),
          invoice_date: txDate1 || undefined,
          department_id: departmentId || undefined,
        }),
      });
      const data = await res.json();
      if (data.duplicates?.length > 0) {
        setDuplicates(data.duplicates);
      } else {
        setDuplicates([]);
      }
      setDuplicateChecked(true);
    } catch {
      setDuplicateChecked(true);
    }
  }, [guestName, txDate1, departmentId]);

  useEffect(() => {
    if (!guestName.trim()) {
      setDuplicates([]);
      setDuplicateChecked(false);
      return;
    }
    if (files.length > 0) {
      void checkDuplicates();
    } else {
      setDuplicateChecked(false);
    }
  }, [guestName, files.length, checkDuplicates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!guestName.trim() || !title.trim() || !producer.trim() || !topic.trim()) {
      setError("Please fill all required guest fields.");
      return;
    }
    if (!departmentId || !programId) {
      setError("Please select department and programme.");
      return;
    }
    if (!invoiceDate || !txDate1 || !paymentType) {
      setError("Invoice date, TX date and payment type are required.");
      return;
    }
    if (files.length === 0) {
      setError("Please select at least one file (PDF, DOCX, DOC, XLSX, XLS, JPEG)");
      return;
    }
    for (const f of files) {
      const fileExt = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!ALLOWED_EXTS.includes(fileExt)) {
        setError(`Unsupported file type: ${f.name}. Allowed: PDF, DOCX, DOC, XLSX, XLS, JPEG`);
        return;
      }
    }

    if (!duplicateChecked) {
      await checkDuplicates();
    }
    if (!showDuplicateWarning && duplicates.length > 0) {
      setShowDuplicateWarning(true);
      return;
    }

    setLoading(true);

    const serviceDescription = [
      `Guest Name: ${guestName}`,
      `Title: ${title}`,
      guestPhone.trim() ? `Guest Phone: ${guestPhone.trim()}` : "",
      guestEmail.trim() ? `Guest Email: ${guestEmail.trim()}` : "",
      `Producer: ${producer}`,
      `Topic: ${topic}`,
      `Department Name: ${departments.find((d) => d.id === departmentId)?.name ?? ""}`,
      `Programme Name: ${programs.find((p) => p.id === programId)?.name ?? ""}`,
      `Invoice Date: ${invoiceDate}`,
      `TX Date: ${txDate1}`,
      txDate2 ? `2. TX Date: ${txDate2}` : "",
      txDate3 ? `3. TX Date: ${txDate3}` : "",
      `Payment Type: ${paymentType}`,
      files.length > 0 ? `Source File Name: ${files.map((f) => f.name).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    let successCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("department_id", departmentId);
        formData.append("program_id", programId);
        formData.append("service_description", serviceDescription);
        formData.append("service_date_from", txDate1);
        formData.append("service_date_to", txDate3 || txDate2 || txDate1);
        formData.append("currency", currency);

        const res = await fetch("/api/invoices/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          successCount++;
        } else {
          errors.push(`${file.name}: ${getApiErrorMessage(data as { error?: string } | null)}`);
        }
      }
      setLoading(false);

      if (successCount > 0) {
        localStorage.removeItem(DRAFT_KEY);
        setSuccess(
          successCount === files.length
            ? `${successCount} invoice(s) submitted. Redirecting...`
            : `${successCount} of ${files.length} invoice(s) submitted. ${errors.length > 0 ? errors.join("; ") : ""}`
        );
        router.push("/invoices");
      } else {
        setError(errors.join("; ") || "Upload failed");
      }
    } catch (err) {
      setLoading(false);
      setError(toUserFriendlyError(err));
    }
  };

  return (
    <>
      {loading && <UploadOverlay message="Submitting..." />}
    <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-sky-700">TRT<span className="text-slate-800 dark:text-slate-200">WORLD</span></h1>
          <h2 className="mt-4 text-5xl font-semibold text-slate-900 dark:text-slate-100">Guest Invoice Submission</h2>
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-600" role="tablist" aria-label="Submission method">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upload"}
          aria-controls="upload-panel"
          id="tab-upload"
          onClick={() => setTab("upload")}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors min-h-[44px] touch-manipulation ${tab === "upload" ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
        >
          Upload Invoice
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "generate"}
          aria-controls="generate-panel"
          id="tab-generate"
          onClick={() => setTab("generate")}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors min-h-[44px] touch-manipulation ${tab === "generate" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"}`}
        >
          Generate Invoice
        </button>
      </div>

      {tab === "generate" ? (
        <GenerateInvoiceForm guestId={guestIdFromUrl} />
      ) : (
      <>
      {rejectedId && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Resubmitting after rejection. Link previous invoice when creating the new one.
        </div>
      )}

      {draftBanner && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-200">
          <span>You have an unsaved draft. Resume where you left off?</span>
          <div className="flex gap-2">
            <button type="button" onClick={restoreDraft} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500">Resume</button>
            <button type="button" onClick={discardDraft} className="rounded-md border border-sky-300 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:text-sky-300 dark:hover:bg-sky-900">Discard</button>
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-950/40" role="alert">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/50">
          {templates.length > 0 && (
            <div className="relative group">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                Load Template
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div className="invisible absolute left-0 top-full z-20 mt-1 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg group-hover:visible dark:border-slate-600 dark:bg-slate-800">
                {templates.map((t) => (
                  <div key={t.name} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                    <button
                      type="button"
                      onClick={() => loadTemplate(t)}
                      className="flex-1 text-left text-xs text-slate-700 dark:text-slate-200"
                    >
                      {t.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(t.name)}
                      className="ml-2 flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-red-500"
                      aria-label={`Delete template ${t.name}`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!showSaveTemplate ? (
            <button
              type="button"
              onClick={() => setShowSaveTemplate(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z"/><path strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8V3M7 14h10"/></svg>
              Save as Template
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveTemplate(); } }}
                placeholder="Template name..."
                className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                autoFocus
              />
              <button
                type="button"
                onClick={saveTemplate}
                className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setShowSaveTemplate(false); setTemplateName(""); }}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div>
          <AutocompleteInput value={guestName} onChange={setGuestName} field="guest" label="Guest Name" required placeholder="e.g. John Doe" />
          {touched.guestName && !guestName.trim() && <p id="guestName-error" className="mt-1 text-sm text-red-600" role="alert">Guest name is required</p>}
          <p className="mt-1 text-right text-sm text-slate-500">{guestName.length}/255</p>
          {duplicates.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                Potential duplicate{duplicates.length > 1 ? "s" : ""} found ({duplicates.length})
              </div>
              <div className="mt-2 space-y-1.5">
                {duplicates.slice(0, 3).map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-medium">{d.guest}</span>
                    {d.amount != null && <span>| {d.amount.toLocaleString("en-GB", { style: "currency", currency: "GBP" })}</span>}
                    {d.date && <span>| {d.date}</span>}
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-medium dark:bg-amber-800">{d.status.replace(/_/g, " ")}</span>
                    {d.match_reasons.map((r) => (
                      <span key={r} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] dark:bg-amber-900">{r}</span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-slate-800">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={markTouched("title")}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 aria-[invalid=true]:border-red-500"
            aria-invalid={touched.title && !title.trim() ? true : undefined}
            aria-describedby={touched.title && !title.trim() ? "title-error" : undefined}
          />
          {touched.title && !title.trim() && <p id="title-error" className="mt-1 text-sm text-red-600" role="alert">Title is required</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="guestPhone" className="block text-sm font-semibold text-slate-800">Guest Phone</label>
            <input id="guestPhone" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="Optional" className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900" />
          </div>
          <div>
            <label htmlFor="guestEmail" className="block text-sm font-semibold text-slate-800">Guest Email</label>
            <input id="guestEmail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="Optional" className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900" />
          </div>
        </div>

        <AutocompleteInput value={producer} onChange={setProducer} field="producer" label="Producer" required placeholder="e.g. Jane Smith" />

        <AutocompleteInput value={topic} onChange={setTopic} field="topic" label="Topic" placeholder="e.g. Politics" />

        <div>
          <label htmlFor="departmentId" className="block text-sm font-semibold text-slate-800">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            id="departmentId"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            onBlur={markTouched("departmentId")}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 aria-[invalid=true]:border-red-500"
            aria-invalid={touched.departmentId && !departmentId ? true : undefined}
            aria-describedby={touched.departmentId && !departmentId ? "departmentId-error" : undefined}
          >
            <option value="">Select...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {touched.departmentId && !departmentId && <p id="departmentId-error" className="mt-1 text-sm text-red-600" role="alert">Department is required</p>}
        </div>
        <div>
          <label htmlFor="programId" className="block text-sm font-semibold text-slate-800">
            Programme Name <span className="text-red-500">*</span>
          </label>
          <select
            id="programId"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            onBlur={markTouched("programId")}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 aria-[invalid=true]:border-red-500"
            disabled={!departmentId}
            aria-invalid={touched.programId && !!departmentId && !programId ? true : undefined}
            aria-describedby={touched.programId && departmentId && !programId ? "programId-error" : undefined}
          >
            <option value="">Select...</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {touched.programId && departmentId && !programId && <p id="programId-error" className="mt-1 text-sm text-red-600" role="alert">Programme is required</p>}
        </div>

        <div>
          <label htmlFor="invoiceDate" className="block text-sm font-semibold text-slate-800">
            Invoice Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-slate-800">
              TX Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={txDate1}
              onChange={(e) => setTxDate1(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800">2. TX Date</label>
            <input
              type="date"
              value={txDate2}
              onChange={(e) => setTxDate2(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-800">3. TX Date</label>
            <input
              type="date"
              value={txDate3}
              onChange={(e) => setTxDate3(e.target.value)}
              className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Payment Type <span className="text-red-500">*</span>
          </label>
          <div className="mt-2 flex gap-4">
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-slate-800">
              <input
                type="radio"
                name="paymentType"
                value="paid_guest"
                checked={paymentType === "paid_guest"}
                onChange={() => setPaymentType("paid_guest")}
              />
              Paid Guest
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-slate-800">
              <input
                type="radio"
                name="paymentType"
                value="unpaid_guest"
                checked={paymentType === "unpaid_guest"}
                onChange={() => setPaymentType("unpaid_guest")}
              />
              Unpaid Guest
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          >
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div>
          <label htmlFor="invoiceFiles" className="block text-sm font-semibold text-slate-800">
            Invoice File(s) <span className="text-red-500">*</span>
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragOver
                ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950/30"
                : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-600 dark:bg-slate-700"
            }`}
          >
            {dragOver ? (
              <p className="text-sm font-medium text-sky-600 dark:text-sky-400">Drop files here</p>
            ) : (
              <>
                <svg className="mb-2 h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
                <p className="text-sm text-slate-600 dark:text-slate-300">Drag & drop files here, or <span className="font-medium text-sky-600 dark:text-sky-400">browse</span></p>
              </>
            )}
            <input
              ref={fileInputRef}
              id="invoiceFiles"
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg"
              multiple
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length) validateAndMergeFiles(picked);
                e.target.value = "";
              }}
              aria-describedby="files-hint"
              className="hidden"
            />
          </div>
          <p id="files-hint" className="mt-1 text-xs text-slate-500">PDF, DOCX, DOC, XLSX, XLS, JPEG. Select multiple files to create one invoice per file.</p>
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm dark:bg-slate-700">
                  <span className="truncate text-slate-700 dark:text-slate-200">{f.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, idx) => idx !== i)); }}
                    className="ml-2 flex-shrink-0 text-slate-400 hover:text-red-500"
                    aria-label={`Remove ${f.name}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              <p className="text-sm font-medium text-sky-600">{files.length} file(s) selected</p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="ml-auto flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <LogoLoader size="sm" variant="light" />
              <span>Submitting...</span>
            </>
          ) : (
            "Submit invoice"
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}
      </>
      )}

      {showDuplicateWarning && duplicates.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white shadow-2xl dark:border-amber-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-6 py-4 dark:border-amber-800 dark:bg-amber-950/30 rounded-t-2xl">
              <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
              <div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200">Possible Duplicate Invoice</h3>
                <p className="text-sm text-amber-600 dark:text-amber-400">We found existing invoices that may be duplicates.</p>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto px-6 py-4 space-y-3">
              {duplicates.map((d) => (
                <div key={d.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">{d.guest}</span>
                    <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200">{d.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                    {d.invoice_number && <span>INV# {d.invoice_number}</span>}
                    {d.amount != null && <span>| {d.amount.toLocaleString("en-GB", { style: "currency", currency: "GBP" })}</span>}
                    {d.date && <span>| {d.date}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.match_reasons.map((r) => (
                      <span key={r} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">{r}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDuplicateWarning(false);
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
