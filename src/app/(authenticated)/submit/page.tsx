"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { getApiErrorMessage, toUserFriendlyError } from "@/lib/error-messages";
import { GenerateInvoiceForm } from "@/components/GenerateInvoiceForm";

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
  const [tab, setTab] = useState<Tab>("upload");
  const today = new Date().toISOString().slice(0, 10);
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const markTouched = (field: string) => () => setTouched((p) => ({ ...p, [field]: true }));

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
    const allowedExts = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".jpg", ".jpeg"];
    for (const f of files) {
      const fileExt = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
      if (!allowedExts.includes(fileExt)) {
        setError(`Unsupported file type: ${f.name}. Allowed: PDF, DOCX, DOC, XLSX, XLS, JPEG`);
        return;
      }
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
        <GenerateInvoiceForm />
      ) : (
      <>
      {rejectedId && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Resubmitting after rejection. Link previous invoice when creating the new one.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="guestName" className="block text-sm font-semibold text-slate-800">
            Guest Name <span className="text-red-500">*</span>
          </label>
          <input
            id="guestName"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value.slice(0, 255))}
            onBlur={markTouched("guestName")}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 aria-[invalid=true]:border-red-500"
            aria-invalid={touched.guestName && !guestName.trim() ? true : undefined}
            aria-describedby={touched.guestName && !guestName.trim() ? "guestName-error" : undefined}
          />
          {touched.guestName && !guestName.trim() && <p id="guestName-error" className="mt-1 text-sm text-red-600" role="alert">Guest name is required</p>}
          <p className="mt-1 text-right text-sm text-slate-500">{guestName.length}/255</p>
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

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Producer <span className="text-red-500">*</span>
          </label>
          <input
            value={producer}
            onChange={(e) => setProducer(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Topic <span className="text-red-500">*</span>
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          />
        </div>

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
          <input
            id="invoiceFiles"
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            aria-describedby="files-hint"
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 file:mr-4 file:rounded file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-white"
          />
          <p id="files-hint" className="mt-1 text-xs text-slate-500">PDF, DOCX, DOC, XLSX, XLS, JPEG. Select multiple files to create one invoice per file.</p>
          {files.length > 0 && <p className="mt-1 text-sm text-sky-600 font-medium">{files.length} file(s) selected</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="ml-auto block rounded-lg bg-sky-600 px-6 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit invoice"}
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
    </div>
  );
}
