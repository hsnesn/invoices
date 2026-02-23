"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";

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

function SubmitPageContent() {
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
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    if (!file) {
      setError("Please select a file (PDF, DOCX, DOC, XLSX, XLS)");
      return;
    }
    const allowedExts = [".pdf", ".docx", ".doc", ".xlsx", ".xls"];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowedExts.includes(fileExt)) {
      setError("Unsupported file type. Allowed: PDF, DOCX, DOC, XLSX, XLS");
      return;
    }
    setLoading(true);

    const serviceDescription = [
      `Guest Name: ${guestName}`,
      `Title: ${title}`,
      `Producer: ${producer}`,
      `Topic: ${topic}`,
      `Department Name: ${departments.find((d) => d.id === departmentId)?.name ?? ""}`,
      `Programme Name: ${programs.find((p) => p.id === programId)?.name ?? ""}`,
      `Invoice Date: ${invoiceDate}`,
      `TX Date: ${txDate1}`,
      txDate2 ? `2. TX Date: ${txDate2}` : "",
      txDate3 ? `3. TX Date: ${txDate3}` : "",
      `Payment Type: ${paymentType}`,
      file ? `Source File Name: ${file.name}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("department_id", departmentId);
    formData.append("program_id", programId);
    formData.append("service_description", serviceDescription);
    formData.append("service_date_from", txDate1);
    formData.append("service_date_to", txDate3 || txDate2 || txDate1);
    formData.append("currency", currency);

    try {
      const res = await fetch("/api/invoices/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError((data as { error?: string }).error || "Upload failed");
        return;
      }
      setSuccess("Invoice submitted. Redirecting...");
      router.push("/invoices");
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg.includes("fetch") ? "Connection error. Make sure the server is running." : msg);
    }
  };

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-sky-700">TRT<span className="text-slate-800">WORLD</span></h1>
          <h2 className="mt-4 text-5xl font-semibold text-slate-900">Guest Invoice Submission</h2>
        </div>
      </div>

      {rejectedId && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Resubmitting after rejection. Link previous invoice when creating the new one.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Guest Name <span className="text-red-500">*</span>
          </label>
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value.slice(0, 255))}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          />
          <p className="mt-1 text-right text-sm text-slate-500">{guestName.length}/255</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          />
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
          <label className="block text-sm font-semibold text-slate-800">
            Department <span className="text-red-500">*</span>
          </label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
          >
            <option value="">Select...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800">
            Programme Name <span className="text-red-500">*</span>
          </label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            disabled={!departmentId}
          >
            <option value="">Select...</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800">
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
          <label className="block text-sm font-semibold text-slate-800">
            Invoice File <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 file:mr-4 file:rounded file:border-0 file:bg-sky-600 file:px-4 file:py-2 file:text-white"
          />
          <p className="mt-1 text-xs text-slate-500">PDF, DOCX, DOC, XLSX, XLS</p>
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
    </div>
  );
}
