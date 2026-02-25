"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ALL_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type SetupItem = { id: string; value: string };

const fetcher = (url: string) => fetch(url).then(async (r) => {
  const d = await r.json();
  return Array.isArray(d) ? d : [];
});

export default function FreelancerSubmitPage() {
  const router = useRouter();
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  const { data: departments = [] } = useSWR<{ id: string; name: string }[]>("/api/departments", fetcher);
  const { data: serviceDescriptions = [] } = useSWR<SetupItem[]>("/api/freelancer-setup?category=service_description", fetcher);
  const { data: bookedByOptions = [] } = useSWR<SetupItem[]>("/api/freelancer-setup?category=booked_by", fetcher);

  const [contractorName, setContractorName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [department2, setDepartment2] = useState("");
  const [bookedBy, setBookedBy] = useState("");
  const [serviceMonth, setServiceMonth] = useState("");
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [serviceRatePerDay, setServiceRatePerDay] = useState("");
  const [additionalCost, setAdditionalCost] = useState("");
  const [additionalCostReasonCustom, setAdditionalCostReasonCustom] = useState("");
  const [submissionDate] = useState(today);
  const [currency, setCurrency] = useState("GBP");
  const [invNumber, setInvNumber] = useState("");
  const [accountDetailsChanged, setAccountDetailsChanged] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      if (data?.full_name) setContractorName(data.full_name);
    }).catch(() => {});
  }, []);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const serviceDaysCountAuto = selectedDays.size;

  const computedAmount = (() => {
    const days = serviceDaysCountAuto;
    const rate = parseFloat(serviceRatePerDay) || 0;
    const add = parseFloat(additionalCost) || 0;
    return days * rate + add;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) { setError("Please select at least one file"); return; }
    if (accountDetailsChanged && (!beneficiaryName.trim() || !accountNumber.trim() || !sortCode.trim())) {
      setError("When account details have changed, please fill Beneficiary name, Account number and Sort code.");
      return;
    }
    if (!contractorName.trim()) { setError("Contractor name is required"); return; }
    if (!serviceDescription) { setError("Service description is required"); return; }
    if (!serviceMonth) { setError("Month is required"); return; }
    if (selectedDays.size === 0) { setError("Please select at least one day"); return; }
    if (!bookedBy) { setError("Booked by is required"); return; }
    if (!invNumber.trim()) { setError("INV Number is required"); return; }
    setLoading(true); setError("");

    const fd = new FormData();
    files.forEach((f) => fd.append("file", f));
    fd.append("contractor_name", contractorName);
    fd.append("company_name", "");
    fd.append("department_id", departmentId);
    fd.append("department_2", department2);
    fd.append("istanbul_team", "");
    fd.append("service_description", serviceDescription);
    fd.append("service_days_count", String(serviceDaysCountAuto));
    fd.append("service_days", Array.from(selectedDays).sort((a, b) => a - b).join(", "));
    fd.append("service_rate_per_day", serviceRatePerDay);
    fd.append("service_month", serviceMonth);
    fd.append("additional_cost", additionalCost);
    fd.append("additional_cost_reason", additionalCostReasonCustom.trim());
    fd.append("booked_by", bookedBy);
    fd.append("currency", currency);
    fd.append("inv_number", invNumber.trim());
    fd.append("account_details_changed", accountDetailsChanged ? "1" : "0");
    if (accountDetailsChanged) {
      fd.append("beneficiary_name", beneficiaryName.trim());
      fd.append("account_number", accountNumber.trim());
      fd.append("sort_code", sortCode.trim());
    }

    try {
      const res = await fetch("/api/freelancer-invoices/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      router.push("/freelancer-invoices");
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white";
  const labelCls = "block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1";
  const hintCls = "text-xs text-gray-400 mt-0.5";

  return (
    <div className="mx-auto max-w-2xl py-8 px-4">
      <div className="mb-6">
        <button onClick={() => router.push("/freelancer-invoices")} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-3 inline-flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back to list
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contractor Invoice and Booking Form</h1>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">

        {/* 1. Name */}
        <div>
          <label className={labelCls}>1. Name <span className="text-red-500">*</span></label>
          <p className={hintCls}>Contractor or Company Name</p>
          <input value={contractorName} onChange={(e) => setContractorName(e.target.value)} className={inputCls} required maxLength={255} />
          <p className="text-right text-[11px] text-gray-400">{contractorName.length}/255</p>
        </div>

        {/* 2. Service Description */}
        <div>
          <label className={labelCls}>2. Service Description <span className="text-red-500">*</span></label>
          <p className={hintCls}>Please select the service provided as part of the agreed freelance engagement</p>
          <select value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} className={inputCls} required>
            <option value="">Select...</option>
            {serviceDescriptions.map((s) => <option key={s.id} value={s.value}>{s.value}</option>)}
          </select>
        </div>

        {/* 3. Department */}
        <div>
          <label className={labelCls}>3. Department <span className="text-red-500">*</span></label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputCls} required>
            <option value="">Select...</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* 4. Department 2 */}
        <div>
          <label className={labelCls}>4. Department 2</label>
          <select value={department2} onChange={(e) => setDepartment2(e.target.value)} className={inputCls}>
            <option value="">Select...</option>
            {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>

        {/* 5. Booked by */}
        <div>
          <label className={labelCls}>5. Booked by <span className="text-red-500">*</span></label>
          <select value={bookedBy} onChange={(e) => setBookedBy(e.target.value)} className={inputCls} required>
            <option value="">Select...</option>
            {bookedByOptions.map((b) => <option key={b.id} value={b.value}>{b.value}</option>)}
          </select>
        </div>

        {/* 6. Number of service delivery days */}
        <div>
          <label className={labelCls}>6. Number of service delivery days <span className="text-red-500">*</span></label>
          <p className={hintCls}>Automatically calculated from selected days (section 8)</p>
          <input type="number" min={0} value={serviceDaysCountAuto} readOnly className={inputCls + " bg-gray-50 dark:bg-gray-700 cursor-not-allowed"} tabIndex={-1} aria-readonly />
        </div>

        {/* 7. Month */}
        <div>
          <label className={labelCls}>7. Month <span className="text-red-500">*</span></label>
          <select value={serviceMonth} onChange={(e) => setServiceMonth(e.target.value)} className={inputCls} required>
            <option value="">Select...</option>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* 8. Days */}
        <div>
          <label className={labelCls}>8. Days <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-8 gap-2 mt-2">
            {ALL_DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedDays.has(day)}
                  onChange={() => toggleDay(day)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                {day}
              </label>
            ))}
          </div>
          {selectedDays.size > 0 && (
            <p className="mt-2 text-xs text-teal-600">{selectedDays.size} days selected: {Array.from(selectedDays).sort((a, b) => a - b).join(", ")}</p>
          )}
        </div>

        {/* 9. Service rate (per day) */}
        <div>
          <label className={labelCls}>9. Service rate (per day) <span className="text-red-500">*</span></label>
          <p className={hintCls}>Rate applicable to each service delivery day, as agreed under the freelance services contract</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}</span>
            <input type="number" step="0.01" min={0} value={serviceRatePerDay} onChange={(e) => setServiceRatePerDay(e.target.value)} className={inputCls + " pl-7"} required />
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={currency !== "GBP"} onChange={(e) => { setCurrency(e.target.checked ? "USD" : "GBP"); }} className="h-3 w-3 rounded border-gray-300 text-teal-600" />
              <span>Currency is not GBP</span>
            </label>
            {currency !== "GBP" && (
              <span className="flex gap-2">
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="currency" value="USD" checked={currency === "USD"} onChange={() => setCurrency("USD")} className="h-3 w-3 text-teal-600" />USD ($)</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="currency" value="EUR" checked={currency === "EUR"} onChange={() => setCurrency("EUR")} className="h-3 w-3 text-teal-600" />EUR (€)</label>
              </span>
            )}
          </div>
        </div>

        {/* 10. Additional Cost */}
        <div>
          <label className={labelCls}>10. Additional Cost</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}</span>
            <input type="number" step="0.01" min={0} value={additionalCost} onChange={(e) => setAdditionalCost(e.target.value)} className={inputCls + " pl-7"} />
          </div>
          <p className={hintCls}>If the services provided differed from the originally agreed scope of services (for example, location-based camera operation, studio-based camera operation, or editing services), please specify the nature of the services delivered and the relevant date(s). If you rented out your equipment, please specify which equipment and on which dates.</p>
        </div>

        {/* 11. Additional Cost Reason */}
        <div>
          <label className={labelCls}>11. Additional Cost Reason</label>
          <input value={additionalCostReasonCustom} onChange={(e) => setAdditionalCostReasonCustom(e.target.value.slice(0, 75))} placeholder="Describe the reason for additional cost..." maxLength={75} className={inputCls} />
          {additionalCostReasonCustom.length > 0 && <p className="text-right text-[11px] text-gray-400 mt-0.5">{additionalCostReasonCustom.length}/75</p>}
        </div>

        {/* Computed Amount */}
        {(() => {
          const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
          return (
            <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 dark:bg-teal-900/20 dark:border-teal-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-teal-700 dark:text-teal-400">Computed Amount</span>
                <span className="text-lg font-bold text-teal-800 dark:text-teal-300">{sym}{computedAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-xs text-teal-600 dark:text-teal-500 mt-1">({serviceDaysCountAuto} days × {sym}{serviceRatePerDay || 0}/day) + {sym}{additionalCost || 0} additional</p>
            </div>
          );
        })()}

        {/* INV Number (below computed amount) */}
        <div>
          <label className={labelCls}>12. INV Number <span className="text-red-500">*</span></label>
          <p className={hintCls}>Short number or code (e.g. INV-001, 123)</p>
          <input value={invNumber} onChange={(e) => setInvNumber(e.target.value.slice(0, 50))} placeholder="e.g. INV-001" maxLength={50} className={inputCls} required />
          <p className="text-right text-[11px] text-gray-400">{invNumber.length}/50</p>
        </div>

        {/* 13. Submission Date */}
        <div>
          <label className={labelCls}>13. Submission Date <span className="text-red-500">*</span></label>
          <input value={submissionDate} readOnly className={inputCls + " bg-gray-50 dark:bg-gray-700"} />
        </div>

        {/* 14. My account details have changed */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={accountDetailsChanged} onChange={(e) => setAccountDetailsChanged(e.target.checked)} className="h-4 w-4 rounded border-amber-500 text-amber-600" />
            <span className={labelCls + " mb-0"}>My account details have changed</span>
          </label>
          <p className={hintCls + " mt-1"}>If checked, enter your new bank details below.</p>
          {accountDetailsChanged && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Beneficiary name <span className="text-red-500">*</span></label>
                <input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} className={inputCls} placeholder="Account holder name" required={accountDetailsChanged} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Account number <span className="text-red-500">*</span></label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 8))} className={inputCls} placeholder="8 digits" maxLength={8} required={accountDetailsChanged} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sort code <span className="text-red-500">*</span></label>
                <input value={sortCode} onChange={(e) => setSortCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className={inputCls} placeholder="6 digits (e.g. 12-34-56)" maxLength={8} required={accountDetailsChanged} />
              </div>
            </div>
          )}
        </div>

        {/* 15. Files */}
        <div>
          <label className={labelCls}>15. Files</label>
          <p className={hintCls}>You can add multiple documents (invoice, timesheet, etc.)</p>
          <div className="relative mt-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-700/30 hover:border-teal-400 transition-colors">
            <input type="file" accept=".pdf,.docx,.doc,.xlsx,.xls" multiple onChange={(e) => { const newFiles = Array.from(e.target.files ?? []); setFiles((prev) => [...prev, ...newFiles]); e.target.value = ""; }} className="absolute inset-0 cursor-pointer opacity-0" />
            {files.length > 0 ? (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{f.name}</span>
                    <button type="button" onClick={(e) => { e.preventDefault(); setFiles((prev) => prev.filter((_, j) => j !== i)); }} className="ml-2 text-xs text-red-500 hover:text-red-700 flex-shrink-0">Remove</button>
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-1">{files.length} file(s). Click to add more.</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                <p className="mt-2 text-sm text-teal-600 font-medium">Choose files to upload<span className="text-gray-400 font-normal"> or drag and drop here</span></p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, DOC, XLSX, XLS — multiple files allowed</p>
              </div>
            )}
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-teal-500 disabled:opacity-50 transition-all">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" /></svg>
              Uploading...
            </span>
          ) : "Submit"}
        </button>
      </form>
    </div>
  );
}
