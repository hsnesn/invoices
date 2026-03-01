"use client";

import React, { useMemo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { getApiErrorMessage, toUserFriendlyError } from "@/lib/error-messages";
import { fireApprovalConfetti } from "@/lib/action-animations";
import { triggerPaidAnimation } from "@/components/PaidIconOverlay";
import { EmptyState } from "./EmptyState";
import { InvoiceMobileCards } from "./InvoiceMobileCards";

const DashboardSection = lazy(() => import("./InvoiceDashboard").then((m) => ({ default: m.InvoiceDashboard })));
import { BulkMoveModal, type MoveGroup } from "./BulkMoveModal";
import { useExportLocale } from "@/contexts/ExportLocaleContext";
import { ExportLocaleSelector } from "./ExportLocaleSelector";
import { departmentBadgeStyle, programmeBadgeStyle, GUEST_SECTION_COLORS } from "@/lib/colors";
import { sanitizeHtml } from "@/lib/sanitize-html";

function parseInvoiceDate(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

type InvoiceRow = {
  id: string;
  storage_path?: string | null;
  submitter_user_id: string;
  service_description: string | null;
  currency: string;
  created_at: string;
  service_date_from: string | null;
  service_date_to: string | null;
  department_id: string | null;
  program_id: string | null;
  previous_invoice_id: string | null;
  tags?: string[] | null;
  invoice_workflows: {
    status: string;
    rejection_reason: string | null;
    manager_user_id: string | null;
    paid_date: string | null;
  }[] | null;
  invoice_files?: { storage_path: string; file_name: string; sort_order: number }[] | null;
  invoice_extracted_fields: {
    invoice_number: string | null;
    beneficiary_name: string | null;
    account_number: string | null;
    sort_code: string | null;
    gross_amount: number | null;
    extracted_currency: string | null;
    raw_json?: Record<string, unknown> | null;
    needs_review?: boolean;
  }[] | null;
};

type DisplayRow = {
  id: string;
  submitterId: string;
  guest: string;
  title: string;
  producer: string;
  paymentType: string;
  department: string;
  departmentId: string;
  programme: string;
  programmeId: string;
  topic: string;
  tx1: string;
  tx2: string;
  tx3: string;
  invoiceDate: string;
  accountName: string;
  amount: string;
  amountNum: number | null;
  anomalyFlags: string[];
  invNumber: string;
  sortCode: string;
  accountNumber: string;
  currency: string;
  iban: string;
  swiftBic: string;
  bankName: string;
  bankAddress: string;
  intTransfer: string;
  lineManager: string;
  lineManagerId: string;
  paymentDate: string;
  status: string;
  rejectionReason: string;
  createdAt: string;
  group: "pending_line_manager" | "ready_for_payment" | "paid_invoices" | "no_payment_needed" | "rejected";
  hasMissingInfo: boolean;
  missingFields: string[];
  files: { storage_path: string; file_name: string }[];
  tags: string[];
  isGuestCreated?: boolean;
  isProducerCreated?: boolean;
};

type TimelineEvent = {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown> | null;
  actor_name: string;
  created_at: string;
};

type NoteItem = {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
};

type SavedFilter = {
  name: string;
  filters: {
    search: string;
    departmentFilter: string;
    programmeFilter: string;
    groupFilter: string;
    missingInfoFilter: boolean;
    anomalyFilter: boolean;
    producerFilter: string;
    paymentTypeFilter: string;
    managerFilter: string;
    tagFilter: string;
    dateFrom: string;
    dateTo: string;
    sortField: string;
    sortDir: string;
  };
};

const ALL_COLUMNS = [
  { key: "checkbox", label: "" },
  { key: "status", label: "✓" },
  { key: "guest", label: "Guest Name" },
  { key: "title", label: "Title" },
  { key: "producer", label: "Producer" },
  { key: "paymentType", label: "Payment Type" },
  { key: "department", label: "Department" },
  { key: "programme", label: "Programme Name" },
  { key: "topic", label: "Topic" },
  { key: "tx1", label: "TX Date" },
  { key: "tx2", label: "2. TX Date" },
  { key: "tx3", label: "3. TX Date" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "file", label: "Invoice File" },
  { key: "accountName", label: "Account Name" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "invNumber", label: "INV Number" },
  { key: "sortCode", label: "Sort Code" },
  { key: "accountNumber", label: "Account Number" },
  { key: "iban", label: "IBAN" },
  { key: "swiftBic", label: "SWIFT/BIC" },
  { key: "bankName", label: "Bank Name" },
  { key: "bankAddress", label: "Bank Address" },
  { key: "intTransfer", label: "Int Transfer" },
  { key: "lineManager", label: "Dept EP" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "tags", label: "Tags" },
  { key: "actions", label: "Actions" },
];

const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.map((c) => c.key);

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch { /* */ }
  return fallback;
}

const RECENT_FILTERS_KEY = "invoice_recent_filters";
const FILTER_STATE_KEY = "invoice_filter_state";
const RECENT_MAX = 5;

function loadFilterState(): Partial<Record<string, string | boolean>> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(FILTER_STATE_KEY);
    if (stored) return JSON.parse(stored) as Partial<Record<string, string | boolean>>;
  } catch { /* */ }
  return null;
}

function saveFilterState(state: Record<string, string | boolean>) {
  try {
    sessionStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
  } catch { /* */ }
}

function clearFilterState() {
  try {
    sessionStorage.removeItem(FILTER_STATE_KEY);
  } catch { /* */ }
}

function pushRecentFilter(filters: SavedFilter["filters"]) {
  try {
    const recent = loadFromStorage<SavedFilter["filters"][]>(RECENT_FILTERS_KEY, []);
    const key = JSON.stringify(filters);
    const filtered = recent.filter((r) => JSON.stringify(r) !== key);
    const next = [filters, ...filtered].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_FILTERS_KEY, JSON.stringify(next));
  } catch { /* */ }
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function EditGuestInvoiceModal({
  row,
  departmentPairs,
  programPairs,
  profilePairs,
  managerProfilePairs,
  onSave,
  onClose,
  saving,
  onReplaceFile,
  openPdf,
}: {
  row: DisplayRow;
  departmentPairs: [string, string][];
  programPairs: [string, string][];
  profilePairs: [string, string][];
  managerProfilePairs?: [string, string][];
  onSave: (draft: EditDraft, file?: File) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  onReplaceFile: (id: string, file: File) => Promise<void>;
  openPdf: (id: string) => Promise<void>;
}) {
  const [guest, setGuest] = useState(row.guest === "—" ? "" : row.guest);
  const [title, setTitle] = useState(row.title === "—" ? "" : row.title);
  const [producer, setProducer] = useState(row.producer === "—" ? "" : row.producer);
  const [paymentType, setPaymentType] = useState(row.paymentType === "—" ? "paid guest" : row.paymentType);
  const [departmentId, setDepartmentId] = useState(row.departmentId);
  const [programmeId, setProgrammeId] = useState(row.programmeId);
  const [topic, setTopic] = useState(row.topic === "—" ? "" : row.topic);
  const [tx1, setTx1] = useState(row.tx1 === "—" ? "" : row.tx1);
  const [tx2, setTx2] = useState(row.tx2 === "—" ? "" : row.tx2);
  const [tx3, setTx3] = useState(row.tx3 === "—" ? "" : row.tx3);
  const [invoiceDate, setInvoiceDate] = useState(row.invoiceDate === "—" ? "" : row.invoiceDate);
  const [accountName, setAccountName] = useState(row.accountName === "—" ? "" : row.accountName);
  const [amount, setAmount] = useState(row.amount === "—" ? "" : row.amount);
  const [invNumber, setInvNumber] = useState(row.invNumber === "—" ? "" : row.invNumber);
  const [sortCode, setSortCode] = useState(row.sortCode === "—" ? "" : row.sortCode);
  const [accountNumber, setAccountNumber] = useState(row.accountNumber === "—" ? "" : row.accountNumber);
  const [currency, setCurrency] = useState(row.currency === "—" ? "GBP" : row.currency);
  const bankTypeDefault: "uk" | "international" = (row.iban !== "—" && row.swiftBic !== "—") ? "international" : "uk";
  const [bankType, setBankType] = useState<"uk" | "international">(bankTypeDefault);
  const [iban, setIban] = useState(row.iban === "—" ? "" : row.iban);
  const [swiftBic, setSwiftBic] = useState(row.swiftBic === "—" ? "" : row.swiftBic);
  const [bankName, setBankName] = useState(row.bankName === "—" ? "" : row.bankName);
  const [bankAddress, setBankAddress] = useState(row.bankAddress === "—" ? "" : row.bankAddress);
  const [lineManagerId, setLineManagerId] = useState(row.lineManagerId);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);

  const draft: EditDraft = {
    guest,
    title,
    producer,
    paymentType,
    departmentId,
    programmeId,
    topic,
    tx1,
    tx2,
    tx3,
    invoiceDate,
    accountName,
    amount,
    invNumber,
    sortCode,
    accountNumber,
    currency,
    bankType,
    iban,
    swiftBic,
    bankName,
    bankAddress,
    lineManagerId,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(draft, replaceFile ?? undefined);
  };

  const isRejected = row.status === "rejected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Invoice</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Guest Name</label>
              <input type="text" value={guest} onChange={(e) => setGuest(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Producer</label>
              <select value={producer} onChange={(e) => setProducer(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="">Select...</option>
                {producer && !profilePairs.some(([, n]) => n === producer) && (
                  <option value={producer}>{producer}</option>
                )}
                {profilePairs.map(([id, name]) => (
                  <option key={id} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Type</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="paid guest">Paid Guest</option>
                <option value="unpaid guest">Unpaid Guest</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
              <select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setProgrammeId(""); }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="">Select...</option>
                {departmentPairs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Programme</label>
              <select value={programmeId} onChange={(e) => setProgrammeId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="">Select...</option>
                {programPairs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Topic</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">TX Date</label>
              <input type="date" value={tx1} onChange={(e) => setTx1(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">2. TX Date</label>
              <input type="date" value={tx2} onChange={(e) => setTx2(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">3. TX Date</label>
              <input type="date" value={tx3} onChange={(e) => setTx3(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Name</label>
              <input type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
              <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">INV Number</label>
              <input type="text" value={invNumber} onChange={(e) => setInvNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dept EP</label>
              <select value={lineManagerId} onChange={(e) => setLineManagerId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="">Unassigned</option>
                {(managerProfilePairs ?? profilePairs).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Type</label>
              <select value={bankType} onChange={(e) => setBankType(e.target.value as "uk" | "international")} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <option value="uk">UK (Sort Code / Account Number)</option>
                <option value="international">International (IBAN / SWIFT)</option>
              </select>
            </div>
          </div>
          {bankType === "uk" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sort Code</label>
                <input type="text" value={sortCode} onChange={(e) => setSortCode(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Account Number</label>
                <input type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">IBAN</label>
                  <input type="text" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="e.g. GB82WEST12345698765432" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">SWIFT / BIC</label>
                  <input type="text" value={swiftBic} onChange={(e) => setSwiftBic(e.target.value.toUpperCase())} placeholder="e.g. DEUTGB2L" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Name</label>
                  <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Address</label>
                  <input type="text" value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice File</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void openPdf(row.id)} className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4zM6 10h8v2H6v-2zm0 4h5v2H6v-2z"/></svg>
                Open
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-800/40">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                Replace
                <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) setReplaceFile(f); e.target.value = ""; }} />
              </label>
              {replaceFile && <span className="text-sm text-gray-600 dark:text-gray-400">{replaceFile.name}</span>}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              {saving ? (isRejected ? "Resubmitting..." : "Saving...") : (isRejected ? "Resubmit" : "Save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type EditDraft = {
  guest: string;
  title: string;
  producer: string;
  paymentType: string;
  departmentId: string;
  programmeId: string;
  topic: string;
  tx1: string;
  tx2: string;
  tx3: string;
  invoiceDate: string;
  accountName: string;
  amount: string;
  invNumber: string;
  sortCode: string;
  accountNumber: string;
  currency: string;
  bankType: "uk" | "international";
  iban: string;
  swiftBic: string;
  bankName: string;
  bankAddress: string;
  lineManagerId: string;
};


function paymentTypeBadge(value: string): string {
  const v = value.toLowerCase();
  if (v.includes("unpaid")) return "bg-slate-300 text-slate-800 border border-slate-500 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500";
  return "bg-emerald-600 text-white border-0 shadow-md font-semibold";
}

function producerColor(name: string): string {
  const colors = [
    "bg-rose-400", "bg-violet-400", "bg-sky-400", "bg-teal-400",
    "bg-amber-400", "bg-fuchsia-400", "bg-indigo-400", "bg-emerald-400",
    "bg-pink-400", "bg-cyan-400", "bg-blue-400", "bg-orange-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function sectionColor(group: DisplayRow["group"]): string {
  if (group === "pending_line_manager") return "text-amber-700 dark:text-amber-300";
  if (group === "ready_for_payment") return "text-sky-700 dark:text-sky-300";
  if (group === "paid_invoices") return "text-emerald-700 dark:text-emerald-300";
  if (group === "rejected") return "text-rose-700 dark:text-rose-300";
  return "text-slate-600 dark:text-slate-400";
}

function parseServiceDescription(value: string | null): Record<string, string> {
  if (!value) return {};
  const out: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const sep = l.includes(":") ? ":" : l.includes("-") ? "-" : null;
    if (!sep) continue;
    const idx = l.indexOf(sep);
    if (idx === -1) continue;
    const key = l
      .slice(0, idx)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const val = l.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = val;
  }
  return out;
}

function fromAliases(
  meta: Record<string, string>,
  aliases: string[],
  fallback = "—"
): string {
  for (const key of aliases) {
    const v = meta[key];
    if (v && v.trim()) return v.trim();
  }
  return fallback;
}

function normalizeInvoiceNumber(value: string): string {
  return value.replace(/\.[^.]+$/, "").trim();
}

function calcGroup(status: string, paymentType: string): DisplayRow["group"] {
  if (status === "rejected") return "rejected";
  if (paymentType === "unpaid guest" || paymentType === "unpaid_guest") return "no_payment_needed";
  if (status === "paid" || status === "archived") return "paid_invoices";
  if (status === "approved_by_manager" || status === "pending_admin" || status === "ready_for_payment") {
    return "ready_for_payment";
  }
  return "pending_line_manager";
}

function sectionTitle(group: DisplayRow["group"] | "pending"): string {
  if (group === "pending") return "Pending";
  if (group === "pending_line_manager") return "Pending Dept EP Approval";
  if (group === "ready_for_payment") return "Ready For Payment";
  if (group === "paid_invoices") return "Paid Invoices";
  if (group === "rejected") return "Rejected Invoices";
  return "No Payment Needed";
}

const GUEST_MOVE_GROUPS: MoveGroup[] = [
  { key: "pending_line_manager", label: "Pending Dept EP Approval", bgHex: GUEST_SECTION_COLORS.pending_line_manager },
  { key: "rejected", label: "Rejected Invoices", bgHex: GUEST_SECTION_COLORS.rejected },
  { key: "ready_for_payment", label: "Ready For Payment", bgHex: GUEST_SECTION_COLORS.ready_for_payment },
  { key: "paid_invoices", label: "Paid Invoices", bgHex: GUEST_SECTION_COLORS.paid_invoices },
  { key: "no_payment_needed", label: "No Payment Needed", bgHex: GUEST_SECTION_COLORS.no_payment_needed },
];

function InvoiceTable({
  rows,
  currentRole,
  currentUserId,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  onManagerApprove,
  onRejectInvoice,
  onResubmit,
  onMarkPaid,
  onDeleteInvoice,
  onMoveToLineManager,
  onMoveToArchived,
  onReplaceFile,
  onAddFile,
  openPdf,
  openPdfInNewTab,
  onDownloadFile,
  onDownloadAllFiles,
  onDownloadAllFilesLoading,
  onGenerateBankTransferForm,
  onGenerateBankTransferFormLoading,
  onStartEdit,
  actionLoadingId,
  visibleColumns,
  expandedRowId,
  onToggleExpand,
  timelineData,
  filesData,
  notesData,
  newNote,
  onNewNoteChange,
  onAddNote,
  detailLoading,
  duplicates,
  pageSize,
  currentPage,
  onPageChange,
  departmentPairs,
  programPairs,
  profilePairs,
  managerProfilePairs,
  producerColorsMap = {},
  onSaveTag,
  onRemoveTag,
  rejectInlineShakeId = null,
  rolesCanDelete = ["admin", "finance", "operations", "submitter"],
}: {
  rows: DisplayRow[];
  currentRole: string;
  currentUserId: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onManagerApprove: (id: string) => Promise<void>;
  onRejectInvoice: (id: string) => void;
  onResubmit: (id: string) => Promise<void>;
  onMarkPaid: (id: string) => Promise<void>;
  onDeleteInvoice: (id: string) => Promise<void>;
  onMoveToLineManager: (id: string) => Promise<void>;
  onMoveToArchived: (id: string) => Promise<void>;
  onReplaceFile: (id: string, file: File) => Promise<void>;
  onAddFile?: (id: string, file: File) => Promise<void>;
  openPdf: (id: string, storagePath?: string) => Promise<void>;
  openPdfInNewTab: (id: string, storagePath?: string) => void;
  onDownloadFile?: (id: string, storagePath: string, fileName: string) => void;
  onDownloadAllFiles?: (id: string) => Promise<void>;
  onDownloadAllFilesLoading?: boolean;
  onGenerateBankTransferForm?: (id: string) => Promise<void>;
  onGenerateBankTransferFormLoading?: boolean;
  onStartEdit: (row: DisplayRow) => void;
  actionLoadingId: string | null;
  visibleColumns: string[];
  expandedRowId: string | null;
  onToggleExpand: (id: string) => void;
  timelineData: TimelineEvent[];
  filesData: { storage_path: string; file_name: string }[];
  notesData: NoteItem[];
  newNote: string;
  onNewNoteChange: (v: string) => void;
  onAddNote: () => void;
  detailLoading: boolean;
  duplicates: Set<string>;
  pageSize: number;
  currentPage: number;
  onPageChange: (p: number) => void;
  departmentPairs: [string, string][];
  programPairs: [string, string][];
  profilePairs: [string, string][];
  managerProfilePairs?: [string, string][];
  producerColorsMap?: Record<string, string>;
  onSaveTag?: (invoiceId: string, newTag: string, currentTags: string[]) => Promise<void>;
  onRemoveTag?: (invoiceId: string, tag: string, currentTags: string[]) => Promise<void>;
  rejectInlineShakeId?: string | null;
  rolesCanDelete?: string[];
}) {
  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const canBulkSelect = currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter" || currentRole === "viewer";
  const canRowBulkSelect = (r: DisplayRow) => canBulkSelect && (currentRole === "viewer" || currentRole === "manager" || currentRole === "operations" || currentRole === "admin" || (currentRole === "submitter" && r.submitterId === currentUserId && ["submitted", "pending_manager", "rejected"].includes(r.status)));
  const colCount = visibleColumns.filter((k) => k !== "checkbox" || canBulkSelect).length;

  const isCol = (key: string) => visibleColumns.includes(key);

  const [fileDropTargetId, setFileDropTargetId] = useState<string | null>(null);
  const FILE_EXTS = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg"];
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRowClick = useCallback((r: DisplayRow) => {
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { onToggleExpand(r.id); clickTimerRef.current = null; }, 250);
  }, [onToggleExpand]);
  const handleRowDblClick = useCallback(() => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
  }, []);

  return (
    <div className="overflow-x-auto overflow-y-visible rounded-2xl border-2 border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <table className="min-w-[2800px] divide-y divide-slate-200 dark:divide-slate-600">
        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-700 shadow-sm">
          <tr>
            {isCol("checkbox") && canBulkSelect && (
            <th className="px-2 py-3 text-center w-10">
              <input
                type="checkbox"
                checked={(() => {
                  const selectable = paginatedRows.filter(canRowBulkSelect);
                  return selectable.length > 0 && selectable.every((r) => selectedIds.has(r.id));
                })()}
                onChange={(e) => onToggleAll(paginatedRows.filter(canRowBulkSelect).map((r) => r.id), e.target.checked)}
                className="h-4 w-4 rounded border-2 border-gray-300 text-blue-600 accent-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
            </th>
            )}
            {ALL_COLUMNS.filter((c) => c.key !== "checkbox" && isCol(c.key)).map((c) => (
              <th
                key={c.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-slate-50 dark:divide-slate-600 dark:bg-slate-800">
          {paginatedRows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-4 py-6 text-center text-sm text-gray-400">
                No rows in this group.
              </td>
            </tr>
          ) : (
            paginatedRows.map((r) => {
              const isSubmitter = r.submitterId === currentUserId;
              const canApprove = currentRole === "admin" || (!isSubmitter && currentRole === "manager");
              const isDuplicate = duplicates.has(r.id);
              const pendingDays = (r.status === "pending_manager" || r.status === "submitted") ? daysSince(r.createdAt) : 0;
              const canEditRow = currentRole === "admin" || currentRole === "manager" || (isSubmitter && ["submitted", "pending_manager", "rejected"].includes(r.status));
              const startEditOnDblClick = (e: React.MouseEvent) => { handleRowDblClick(); if (canEditRow) { e.stopPropagation(); e.preventDefault(); onStartEdit(r); } };
              return (
              <React.Fragment key={r.id}>
              <tr data-row-id={r.id} className={`${r.status === "rejected" ? "bg-rose-200 hover:bg-rose-300 dark:bg-rose-900/50 dark:hover:bg-rose-900/70" : isDuplicate ? "bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900/70" : r.isGuestCreated ? "bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 border-l-4 border-l-amber-500 dark:border-l-amber-400" : r.isProducerCreated ? "bg-sky-50/60 hover:bg-sky-100/70 dark:bg-sky-950/25 dark:hover:bg-sky-900/35 border-l-4 border-l-sky-400 dark:border-l-sky-500" : "hover:bg-slate-100 dark:hover:bg-slate-700/80"} transition-colors duration-150 cursor-pointer`} onClick={() => handleRowClick(r)} onDoubleClick={startEditOnDblClick} title={r.isGuestCreated ? "Created by guest (upload or generate)" : r.isProducerCreated ? "Created by producer (Mark accepted, Send link, or Submit)" : undefined}>
              {isCol("checkbox") && canBulkSelect && (
              <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                {canRowBulkSelect(r) ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => onToggleSelect(r.id)}
                    className="h-4 w-4 rounded border-2 border-gray-300 text-blue-600 accent-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                  />
                ) : null}
              </td>
              )}
              {isCol("status") && (
              <td className="px-2 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                {r.status === "pending_manager" && canApprove ? (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => void onManagerApprove(r.id)}
                      disabled={actionLoadingId === r.id}
                      title="Approve"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {actionLoadingId === r.id ? "…" : "✓"}
                    </button>
                    <button
                      onClick={() => void onRejectInvoice(r.id)}
                      disabled={actionLoadingId === r.id}
                      title="Reject"
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-white hover:bg-red-500 disabled:opacity-50 transition-colors shadow-sm ${rejectInlineShakeId === r.id ? "animate-shake-reject" : ""}`}
                    >
                      ✗
                    </button>
                  </div>
                ) : r.status === "rejected" ? (
                  <div className="flex items-center justify-center gap-1">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-sm" title={r.rejectionReason || "Rejected"}>✗</span>
                    {(r.submitterId === currentUserId || currentRole === "admin") && currentRole !== "viewer" && (
                      <button
                        onClick={() => void onResubmit(r.id)}
                        disabled={actionLoadingId === r.id}
                        title="Resubmit for approval"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm text-sm"
                      >
                        {actionLoadingId === r.id ? "…" : "↻"}
                      </button>
                    )}
                  </div>
                ) : r.status === "ready_for_payment" && (currentRole === "admin" || currentRole === "finance") ? (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => void onMarkPaid(r.id)}
                      disabled={actionLoadingId === r.id}
                      title="Mark as paid"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition-all duration-200 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-500"
                    >
                      {actionLoadingId === r.id ? "…" : "£"}
                    </button>
                    {currentRole === "admin" && (
                      <button
                        onClick={() => void onRejectInvoice(r.id)}
                        disabled={actionLoadingId === r.id}
                        title="Reject (reason required)"
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm ${rejectInlineShakeId === r.id ? "animate-shake-reject" : ""}`}
                      >
                        ✗
                      </button>
                    )}
                  </div>
                ) : (r.status === "approved_by_manager" || r.status === "pending_admin") && (currentRole === "admin" || currentRole === "finance") ? (
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => void onMarkPaid(r.id)}
                      disabled={actionLoadingId === r.id}
                      title="Mark as paid"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition-all duration-200 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-500"
                    >
                      {actionLoadingId === r.id ? "…" : "£"}
                    </button>
                    {currentRole === "admin" && (
                      <button
                        onClick={() => void onRejectInvoice(r.id)}
                        disabled={actionLoadingId === r.id}
                        title="Reject (reason required)"
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm ${rejectInlineShakeId === r.id ? "animate-shake-reject" : ""}`}
                      >
                        {actionLoadingId === r.id ? "…" : "✗"}
                      </button>
                    )}
                  </div>
                ) : r.status === "paid" || r.status === "archived" ? (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm" title="Paid">✓</span>
                ) : r.status === "ready_for_payment" ? (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm" title="Approved">✓</span>
                ) : (
                  <div className="flex items-center justify-center gap-1">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-sm dark:bg-amber-900/40 dark:text-amber-300" title="Pending">○</span>
                    {pendingDays >= 3 && (
                      <span className={`text-[9px] font-bold ${pendingDays >= 7 ? "text-red-600" : "text-orange-500"}`} title={`Pending for ${pendingDays} days`}>
                        {pendingDays}d
                      </span>
                    )}
                  </div>
                )}
              {isDuplicate && <div className="mt-0.5 text-[9px] font-bold text-yellow-600" title="Possible duplicate">⚠ DUP</div>}
              {r.hasMissingInfo && (
                <div className="mt-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400" title={r.missingFields.length ? `Missing: ${r.missingFields.join(", ")}` : "Missing or invalid info"}>
                  ⚠ Missing
                </div>
              )}
              </td>
              )}
              {isCol("guest") && (
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); void openPdf(r.id); }}
                    onDoubleClick={(e) => { e.stopPropagation(); void openPdfInNewTab(r.id); }}
                    title="Click to preview, double-click to open in new tab"
                  >
                    {r.guest}
                  </span>
                  {r.isGuestCreated && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-200 text-amber-800 dark:bg-amber-700/50 dark:text-amber-200 border border-amber-400/50 dark:border-amber-500/50" title="Created by guest (upload or generate)">
                      Guest
                    </span>
                  )}
                  {r.isProducerCreated && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-sky-200 text-sky-800 dark:bg-sky-700/50 dark:text-sky-200 border border-sky-400/50 dark:border-sky-500/50" title="Created by producer (Mark accepted, Send link, or Submit)">
                      Producer
                    </span>
                  )}
                  {r.status === "rejected" && r.rejectionReason && (
                    <div className="mt-1 rounded-lg bg-rose-50 border border-rose-200 px-2 py-1 text-xs text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300">
                      <span className="font-semibold">Rejection reason:</span> {r.rejectionReason}
                    </div>
                  )}
                </div>
              </td>
              )}
              {isCol("title") && <td className="max-w-[120px] truncate px-4 py-3 text-sm text-gray-700" title={r.title}>{r.title}</td>}
              {isCol("producer") && <td className="px-4 py-3 text-sm text-gray-700"><div className="group relative inline-flex items-center"><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white cursor-pointer ${producerColorsMap[r.producer] ? "" : producerColor(r.producer)}`} style={producerColorsMap[r.producer] ? { backgroundColor: producerColorsMap[r.producer] } : undefined}>{r.producer.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2)}</span><span className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">{r.producer}</span></div></td>}
              {isCol("paymentType") && <td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${paymentTypeBadge(r.paymentType)}`}>{r.paymentType.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</span></td>}
              {isCol("department") && <td className="px-4 py-3"><span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white" style={departmentBadgeStyle(r.department)}>{r.department}</span></td>}
              {isCol("programme") && <td className="px-4 py-3"><span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white" style={programmeBadgeStyle(r.programme)}>{r.programme}</span></td>}
              {isCol("topic") && <td className="max-w-[120px] truncate px-4 py-3 text-sm text-gray-700" title={r.topic}>{r.topic}</td>}
              {isCol("tx1") && <td className="px-4 py-3 text-sm text-gray-600">{r.tx1}</td>}
              {isCol("tx2") && <td className="px-4 py-3 text-sm text-gray-600">{r.tx2}</td>}
              {isCol("tx3") && <td className="px-4 py-3 text-sm text-gray-600">{r.tx3}</td>}
              {isCol("invoiceDate") && <td className="px-4 py-3 text-sm text-gray-600">{r.invoiceDate}</td>}
              {isCol("file") && <td
                className={`px-4 py-3 min-w-[140px] transition-colors ${fileDropTargetId === r.id ? "bg-amber-100 dark:bg-amber-900/30" : ""}`}
                onClick={(e) => e.stopPropagation()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (r.submitterId === currentUserId || currentRole === "admin" || currentRole === "manager") setFileDropTargetId(r.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setFileDropTargetId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setFileDropTargetId(null);
                  const f = e.dataTransfer.files?.[0];
                  if (f && (r.submitterId === currentUserId || currentRole === "admin" || currentRole === "manager")) {
                    const ext = f.name.split(".").pop()?.toLowerCase();
                    if (ext && FILE_EXTS.includes(ext)) void onReplaceFile(r.id, f);
                    else if (f) toast.error("Unsupported file type. Use PDF, DOCX, DOC, XLSX, XLS, or JPEG.");
                  }
                  e.dataTransfer.clearData();
                }}
              >
                <div className="flex flex-wrap items-center gap-0.5">
                {r.files.length === 0 ? (
                  <span className="text-xs text-gray-400">—</span>
                ) : (
                  r.files.map((f, i) => {
                    const ext = (f.file_name.split(".").pop() ?? "").toLowerCase();
                    const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
                    return (
                      <button
                        key={f.storage_path || `${i}-${f.file_name}`}
                        onClick={(e) => { e.stopPropagation(); void openPdf(r.id, f.storage_path); }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-400 dark:hover:bg-sky-800/60 transition-colors"
                        title={`${f.file_name} — Click to preview`}
                      >
                        {isImage ? (
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4l-2-2H4a2 2 0 00-2 2zm2 6a1 1 0 011-1h6a1 1 0 011 1v4a1 1 0 01-1 1H7a1 1 0 01-1-1V9z" clipRule="evenodd"/></svg>
                        ) : (
                          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z"/></svg>
                        )}
                      </button>
                    );
                  })
                )}
                {r.files.length > 0 && onDownloadFile && (
                  <button
                    onClick={() => onDownloadFile(r.id, r.files[0].storage_path, r.files[0].file_name)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-400 dark:hover:bg-sky-800/60 transition-colors"
                    title="Download"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                  </button>
                )}
                {(r.submitterId === currentUserId || currentRole === "admin" || currentRole === "manager") && (
                  <>
                    <label className="inline-flex h-7 w-7 items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 cursor-pointer dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-800/40 transition-colors" title="Replace (upload)">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
                      <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onReplaceFile(r.id, f); e.target.value = ""; }} />
                    </label>
                    <label className="inline-flex h-7 w-7 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-800/40 transition-colors" title="Add file">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                      <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAddFile?.(r.id, f); e.target.value = ""; }} />
                    </label>
                  </>
                )}
                </div>
              </td>}
              {isCol("accountName") && <td className="max-w-[120px] truncate px-4 py-3 text-sm text-gray-700" title={r.accountName}>{r.accountName}</td>}
              {isCol("amount") && (
                <td className="px-4 py-3 text-sm text-gray-700">
                  <span className="inline-flex items-center gap-1">
                    {r.amount}
                    {r.anomalyFlags?.length > 0 && (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
                        title={r.anomalyFlags.join("; ")}
                        aria-label={`Anomaly: ${r.anomalyFlags.join("; ")}`}
                      >
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                      </span>
                    )}
                  </span>
                </td>
              )}
              {isCol("currency") && <td className="px-4 py-3 text-sm text-gray-700">{r.currency}</td>}
              {isCol("invNumber") && <td className="max-w-[120px] truncate px-4 py-3 text-sm text-gray-700" title={r.invNumber}>{r.invNumber}</td>}
              {isCol("sortCode") && <td className="px-4 py-3 text-sm text-gray-700">{r.sortCode}</td>}
              {isCol("accountNumber") && <td className="max-w-[120px] truncate px-4 py-3 text-sm text-gray-700" title={r.accountNumber}>{r.accountNumber}</td>}
              {isCol("iban") && <td className="max-w-[140px] truncate px-4 py-3 text-sm text-gray-700" title={r.iban}>{r.iban}</td>}
              {isCol("swiftBic") && <td className="max-w-[100px] truncate px-4 py-3 text-sm text-gray-700" title={r.swiftBic}>{r.swiftBic}</td>}
              {isCol("bankName") && <td className="max-w-[140px] truncate px-4 py-3 text-sm text-gray-700" title={r.bankName}>{r.bankName}</td>}
              {isCol("bankAddress") && <td className="max-w-[160px] truncate px-4 py-3 text-sm text-gray-700" title={r.bankAddress}>{r.bankAddress}</td>}
              {isCol("intTransfer") && (
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const bankFormFile = r.files.find((f) => f.file_name.includes("-TRTW-") && f.file_name.toLowerCase().endsWith(".docx"));
                    const isInternational = r.iban !== "—" && r.swiftBic !== "—";
                    if (bankFormFile) {
                      return (
                        <button
                          onClick={() => onDownloadFile?.(r.id, bankFormFile.storage_path, bankFormFile.file_name)}
                          className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                          title={`Download ${bankFormFile.file_name}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                          Word
                        </button>
                      );
                    }
                    if (isInternational && onGenerateBankTransferForm) {
                      return (
                        <button
                          onClick={() => void onGenerateBankTransferForm(r.id)}
                          disabled={onGenerateBankTransferFormLoading ?? false}
                          className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-800/50 disabled:opacity-50"
                          title="Generate bank transfer form (Word)"
                        >
                          {onGenerateBankTransferFormLoading ? "…" : "Generate"}
                        </button>
                      );
                    }
                    return <span className="text-gray-400">—</span>;
                  })()}
                </td>
              )}
              {isCol("lineManager") && <td className="px-4 py-3 text-sm text-gray-600">{r.lineManager}</td>}
              {isCol("paymentDate") && <td className="px-4 py-3 text-sm text-gray-600">{r.paymentDate}</td>}
              {isCol("tags") && (
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap items-center gap-1">
                    {r.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                        {tag}
                        {onRemoveTag && (currentRole === "admin" || currentRole === "manager" || currentRole === "operations") && (
                          <button onClick={() => void onRemoveTag(r.id, tag, r.tags)} className="ml-0.5 text-teal-500 hover:text-red-500">✕</button>
                        )}
                      </span>
                    ))}
                    {onSaveTag && (currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter") && (
                      editingTagsId === r.id ? (
                        <input
                          autoFocus
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && tagInput.trim()) {
                              void onSaveTag(r.id, tagInput, r.tags);
                              setTagInput("");
                              setEditingTagsId(null);
                            }
                            if (e.key === "Escape") { setEditingTagsId(null); setTagInput(""); }
                          }}
                          onBlur={() => { setEditingTagsId(null); setTagInput(""); }}
                          placeholder="add tag..."
                          className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-[11px] focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingTagsId(r.id); setTagInput(""); }}
                          className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-teal-100 hover:text-teal-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-teal-900/40"
                        >
                          +
                        </button>
                      )
                    )}
                  </div>
                </td>
              )}
              {isCol("actions") && <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const submitterCanEdit = isSubmitter && (r.status === "pending_manager" || r.status === "submitted");
                  const submitterCanResubmit = isSubmitter && r.status === "rejected" && currentRole !== "viewer";
                  const managerOrAdmin = currentRole === "manager" || currentRole === "admin";

                  if (managerOrAdmin) {
                    const inPaymentStage = ["ready_for_payment", "approved_by_manager", "pending_admin"].includes(r.status);
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onStartEdit(r)} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 shadow-sm dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50">Edit</button>
                        {r.status === "rejected" && (
                          <button onClick={() => void onResubmit(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 shadow-sm">
                            {actionLoadingId === r.id ? "..." : "Resubmit"}
                          </button>
                        )}
                        {currentRole === "admin" && inPaymentStage && (
                          <>
                            <button onClick={() => void onMoveToLineManager(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 shadow-sm">
                              Move to Dept EP
                            </button>
                            <button onClick={() => void onMoveToArchived(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                              Move to Archived
                            </button>
                          </>
                        )}
                        {currentRole === "admin" && rolesCanDelete.includes("admin") && (
                          <button onClick={() => void onDeleteInvoice(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 shadow-sm">
                            {actionLoadingId === r.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (submitterCanEdit && rolesCanDelete.includes("submitter")) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onStartEdit(r)} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 shadow-sm dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50">Edit</button>
                        <button onClick={() => void onDeleteInvoice(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 shadow-sm">
                          {actionLoadingId === r.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    );
                  }

                  if (submitterCanResubmit && rolesCanDelete.includes("submitter")) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => onStartEdit(r)} className="rounded-lg bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 shadow-sm dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50">Edit</button>
                        <button onClick={() => void onResubmit(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 shadow-sm">
                          {actionLoadingId === r.id ? "Resubmitting..." : "Resubmit"}
                        </button>
                        <button onClick={() => void onDeleteInvoice(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 shadow-sm">
                          {actionLoadingId === r.id ? "Deleting..." : "Delete"}
                        </button>
                        <span className="text-xs font-medium text-red-600" title={r.rejectionReason}>
                          {r.rejectionReason || "Rejected"}
                        </span>
                      </div>
                    );
                  }

                  if ((currentRole === "operations" || currentRole === "finance") && rolesCanDelete.includes(currentRole)) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void onDeleteInvoice(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 shadow-sm">
                          {actionLoadingId === r.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    );
                  }

                  if ((currentRole === "manager" || currentRole === "viewer") && rolesCanDelete.includes(currentRole)) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void onDeleteInvoice(r.id)} disabled={actionLoadingId === r.id} className="rounded bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 shadow-sm">
                          {actionLoadingId === r.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    );
                  }

                  if (r.status === "rejected") {
                    return (
                      <span className="text-xs font-medium text-red-600" title={r.rejectionReason}>
                        Rejected: {r.rejectionReason || "—"}
                      </span>
                    );
                  }

                  return (
                    <span className="text-xs text-gray-400">
                      {r.status === "pending_manager" ? "Pending" : r.status === "paid" ? "Paid" : r.status === "ready_for_payment" ? "Ready" : "Approved"}
                    </span>
                  );
                })()}
              </td>}
              </tr>
              {/* Expanded Detail Row */}
              {expandedRowId === r.id && (
                <tr className="bg-gray-50">
                  <td colSpan={colCount} className="px-6 py-4">
                    {detailLoading ? (
                      <p className="text-sm text-gray-500">Loading...</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <a href={`/invoices/${expandedRowId}`} className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400">
                            View full invoice →
                          </a>
                          <a href={`/messages?invoiceId=${expandedRowId}`} className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400">
                            Message about this invoice
                          </a>
                          {rows.find((x) => x.id === expandedRowId)?.submitterId && rows.find((x) => x.id === expandedRowId)!.submitterId !== currentUserId && (
                            <a href={`/messages?invoiceId=${expandedRowId}&recipientId=${rows.find((x) => x.id === expandedRowId)!.submitterId}`} className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400">
                              Message submitter
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          {/* Timeline */}
                          <div>
                            <h4 className="mb-2 text-sm font-semibold text-gray-700">Timeline</h4>
                          {timelineData.length === 0 ? (
                            <p className="text-xs text-gray-400">No events yet.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {timelineData.map((ev) => {
                                const changes = (ev.payload as Record<string, unknown>)?.changes as Record<string, { from: string; to: string }> | undefined;
                                const hasChanges = changes && Object.keys(changes).length > 0;
                                const eventIcon = ev.event_type === "invoice_updated" ? "bg-amber-400" : ev.event_type === "invoice_extracted" ? "bg-cyan-400" : ev.event_type.includes("reject") ? "bg-red-400" : ev.event_type.includes("approv") ? "bg-green-400" : ev.event_type.includes("paid") ? "bg-purple-400" : "bg-blue-400";

                                const deptMap = Object.fromEntries(departmentPairs);
                                const progMap = Object.fromEntries(programPairs);
                                const profMap = Object.fromEntries(profilePairs);
                                const resolveName = (field: string, val: string) => {
                                  if (!val || val === "—" || val === "Unassigned") return val;
                                  if (field === "department_id") return deptMap[val] ?? val;
                                  if (field === "program_id") return progMap[val] ?? val;
                                  if (field === "manager") return profMap[val] ?? val;
                                  return val;
                                };

                                return (
                                <div key={ev.id} className="flex items-start gap-2 text-xs">
                                  <div className={`mt-0.5 h-2 w-2 rounded-full ${eventIcon} flex-shrink-0`} />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-700">{ev.actor_name}</span>
                                    <span className="text-gray-500"> — {ev.event_type.replace(/_/g, " ")}</span>
                                    {ev.from_status && ev.to_status && (
                                      <span className="text-gray-400"> ({ev.from_status} → {ev.to_status})</span>
                                    )}
                                    {ev.payload && typeof ev.payload === "object" && typeof (ev.payload as Record<string, string>).rejection_reason === "string" && (
                                      <span className="text-red-600"> — {(ev.payload as Record<string, string>).rejection_reason}</span>
                                    )}
                                    {hasChanges && (
                                      <div className="mt-1 space-y-0.5 rounded bg-gray-50 border border-gray-200 px-2 py-1.5">
                                        {Object.entries(changes!).map(([field, { from, to }]) => (
                                          <div key={field} className="flex items-center gap-1 text-[11px]">
                                            <span className="font-medium text-gray-600 capitalize">{field.replace(/_/g, " ")}:</span>
                                            <span className="text-red-500 line-through">{resolveName(field, from) || "—"}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="text-green-600 font-medium">{resolveName(field, to) || "—"}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="text-gray-400 mt-0.5">{new Date(ev.created_at).toLocaleString("en-GB")}</div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                          </div>
                          {/* Files */}
                          <div>
                            <h4 className="mb-2 text-sm font-semibold text-gray-700">Files</h4>
                            {filesData.length === 0 ? (
                              <p className="text-xs text-gray-400">No files.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                {filesData.map((f, i) => (
                                  <button key={i} onClick={() => expandedRowId && void openPdf(expandedRowId, f.storage_path)} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 truncate max-w-[200px]" title={f.file_name}>
                                    <svg className="h-3.5 w-3.5 flex-shrink-0 text-sky-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z"/></svg>
                                    <span className="truncate">{f.file_name}</span>
                                  </button>
                                ))}
                                {onDownloadAllFiles && expandedRowId && filesData.length > 0 && (
                                  <button
                                    onClick={() => void onDownloadAllFiles(expandedRowId)}
                                    disabled={onDownloadAllFilesLoading}
                                    className="inline-flex items-center gap-1 rounded border border-sky-300 bg-sky-50 px-2 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50 disabled:opacity-50"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                                    {onDownloadAllFilesLoading ? "Downloading..." : "Download all"}
                                  </button>
                                )}
                              </div>
                            )}
                            {onAddFile && expandedRowId && (
                              <label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                                Add file
                                <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAddFile(expandedRowId, f); e.target.value = ""; }} />
                              </label>
                            )}
                            {onGenerateBankTransferForm && expandedRowId && (() => {
                              const r = rows.find((x) => x.id === expandedRowId);
                              const isInternational = r && r.iban !== "—" && r.swiftBic !== "—";
                              return isInternational ? (
                                <button
                                  onClick={() => void onGenerateBankTransferForm(expandedRowId)}
                                  disabled={onGenerateBankTransferFormLoading ?? false}
                                  className="mt-2 inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-800/50 disabled:opacity-50"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                  {onGenerateBankTransferFormLoading ? "Generating..." : "Bank transfer form"}
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        {/* Notes - below Files */}
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-gray-700">Notes</h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                            {notesData.length === 0 ? (
                              <p className="text-xs text-gray-400">No notes yet.</p>
                            ) : (
                              notesData.map((n) => (
                                <div key={n.id} className="rounded border border-gray-200 bg-white px-3 py-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-gray-700">{n.author_name}</span>
                                    <span className="text-gray-400">{new Date(n.created_at).toLocaleString("en-GB")}</span>
                                  </div>
                                  <p className="mt-1 text-gray-600">{n.content}</p>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={newNote}
                              onChange={(e) => onNewNoteChange(e.target.value)}
                              placeholder="Add a note..."
                              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900"
                              onKeyDown={(e) => { if (e.key === "Enter") void onAddNote(); }}
                            />
                            <button
                              onClick={() => void onAddNote()}
                              disabled={!newNote.trim()}
                              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </React.Fragment>
            );})
          )}
        </tbody>
      </table>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t-2 border-slate-300 bg-slate-200 px-4 py-3 dark:border-slate-600 dark:bg-slate-700">
          <span className="text-xs text-gray-500">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange(0)} disabled={currentPage === 0} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">«</button>
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">‹</button>
            <span className="px-2 text-xs font-medium text-gray-700">{currentPage + 1} / {totalPages}</span>
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">›</button>
            <button onClick={() => onPageChange(totalPages - 1)} disabled={currentPage >= totalPages - 1} className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30">»</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function InvoicesBoard({
  invoices,
  departmentPairs,
  programPairs,
  profilePairs,
  managerProfilePairs,
  producerColorsMap = {},
  currentRole,
  currentUserId,
  isOperationsRoomMember = false,
  initialExpandedId,
  initialGroupFilter,
  rolesCanDelete = ["admin", "finance", "operations", "submitter"],
}: {
  invoices: InvoiceRow[];
  departmentPairs: [string, string][];
  programPairs: [string, string][];
  profilePairs: [string, string][];
  managerProfilePairs?: [string, string][];
  producerColorsMap?: Record<string, string>;
  currentRole: string;
  currentUserId: string;
  isOperationsRoomMember?: boolean;
  initialExpandedId?: string;
  initialGroupFilter?: "" | DisplayRow["group"] | "pending";
  rolesCanDelete?: string[];
}) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<InvoiceRow[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState<"" | DisplayRow["group"] | "pending">(initialGroupFilter ?? "");
  const [missingInfoFilter, setMissingInfoFilter] = useState(false);
  const [anomalyFilter, setAnomalyFilter] = useState(false);
  const [producerFilter, setProducerFilter] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<"" | "guest" | "invoiceDate" | "amount" | "producer" | "programme">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editModalRow, setEditModalRow] = useState<DisplayRow | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectButtonShaking, setRejectButtonShaking] = useState(false);
  const [rejectInlineShakeId, setRejectInlineShakeId] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showAssignManagerModal, setShowAssignManagerModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareId1, setCompareId1] = useState("");
  const [compareId2, setCompareId2] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [singleDownloading, setSingleDownloading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([...DEFAULT_VISIBLE_COLUMNS]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const columnsAnchorRef = useRef<HTMLDivElement>(null);
  const [columnPickerPos, setColumnPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors?: string[] } | null>(null);
  const { locale: exportLocale } = useExportLocale();

  useEffect(() => {
    if (initialGroupFilter) setGroupFilter(initialGroupFilter);
  }, [initialGroupFilter]);

  // Full-text search: when search has 2+ chars, fetch from server
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      searchDebounceRef.current = null;
      setSearchLoading(true);
      fetch(`/api/invoices/search-full?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setSearchResults(data);
          else setSearchResults([]);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    if (!showColumnPicker) {
      setColumnPickerPos(null);
      return;
    }
    const updatePos = () => {
      if (columnsAnchorRef.current) {
        const rect = columnsAnchorRef.current.getBoundingClientRect();
        setColumnPickerPos({ top: rect.bottom + 4, left: rect.right - 224 });
      }
    };
    updatePos();
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (columnsAnchorRef.current?.contains(target)) return;
      const portal = document.getElementById("columns-dropdown-portal");
      if (portal?.contains(target)) return;
      setShowColumnPicker(false);
    };
    document.addEventListener("click", close);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [showColumnPicker]);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(initialExpandedId ?? null);
  const [timelineData, setTimelineData] = useState<TimelineEvent[]>([]);
  const [notesData, setNotesData] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [recentFilters, setRecentFilters] = useState<SavedFilter["filters"][]>([]);
  const [filterName, setFilterName] = useState("");
  const [showSaveFilter, setShowSaveFilter] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCustomReport, setShowCustomReport] = useState(false);
  const [customReportFields, setCustomReportFields] = useState<Record<string, boolean>>(
    () => {
      const defaults: Record<string, boolean> = {};
      ["guest", "producer", "department", "programme", "amount", "invoiceDate", "accountName", "invNumber", "status", "paymentType"].forEach((k) => { defaults[k] = true; });
      return defaults;
    }
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (previewUrl || previewHtml || previewLoading) { setPreviewUrl(null); setPreviewHtml(null); setPreviewLoading(false); return; }
      if (editModalRow) { setEditModalRow(null); return; }
      if (rejectModalId) { setRejectModalId(null); return; }
      if (showCompareModal) { setShowCompareModal(false); return; }
      if (compareIds.length) { setCompareIds([]); return; }
      if (showAssignManagerModal) { setShowAssignManagerModal(false); return; }
      if (showMoveModal) { setShowMoveModal(false); return; }
      if (showImportModal && !importing) { setShowImportModal(false); return; }
      if (showCustomReport) { setShowCustomReport(false); return; }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [previewUrl, previewHtml, previewLoading, editModalRow, rejectModalId, showCompareModal, compareIds, showAssignManagerModal, showMoveModal, showImportModal, importing, showCustomReport]);

  const departmentMap = useMemo(() => new Map(departmentPairs), [departmentPairs]);
  const programMap = useMemo(() => new Map(programPairs), [programPairs]);
  const profileMap = useMemo(() => new Map(profilePairs), [profilePairs]);

  useEffect(() => {
    setHydrated(true);
    const stored = loadFromStorage<string[]>("invoice_visible_columns", [...DEFAULT_VISIBLE_COLUMNS]);
    const normalized = DEFAULT_VISIBLE_COLUMNS.filter((k) => stored.includes(k));
    setVisibleColumns(normalized.length > 0 ? normalized : [...DEFAULT_VISIBLE_COLUMNS]);
    setSavedFilters(loadFromStorage<SavedFilter[]>("invoice_saved_filters", []));
    setRecentFilters(loadFromStorage<SavedFilter["filters"][]>(RECENT_FILTERS_KEY, []));
    const filterState = loadFilterState();
    if (filterState) {
      if (filterState.search != null) setSearch(String(filterState.search));
      if (filterState.departmentFilter != null) setDepartmentFilter(String(filterState.departmentFilter));
      if (filterState.programmeFilter != null) setProgrammeFilter(String(filterState.programmeFilter));
      if (!initialGroupFilter && filterState.groupFilter != null) setGroupFilter(String(filterState.groupFilter) as "" | DisplayRow["group"] | "pending");
      if (filterState.missingInfoFilter != null) setMissingInfoFilter(Boolean(filterState.missingInfoFilter));
      if (filterState.anomalyFilter != null) setAnomalyFilter(Boolean(filterState.anomalyFilter));
      if (filterState.producerFilter != null) setProducerFilter(String(filterState.producerFilter));
      if (filterState.paymentTypeFilter != null) setPaymentTypeFilter(String(filterState.paymentTypeFilter));
      if (filterState.managerFilter != null) setManagerFilter(String(filterState.managerFilter));
      if (filterState.tagFilter != null) setTagFilter(String(filterState.tagFilter));
      if (filterState.dateFrom != null) setDateFrom(String(filterState.dateFrom));
      if (filterState.dateTo != null) setDateTo(String(filterState.dateTo));
      if (filterState.sortField != null) setSortField(String(filterState.sortField) as typeof sortField);
      if (filterState.sortDir != null) setSortDir(String(filterState.sortDir) as typeof sortDir);
    }
  }, [initialGroupFilter]);

  // Persist filter state to sessionStorage when filters change
  React.useEffect(() => {
    if (!hydrated) return;
    const hasAny = search || departmentFilter || programmeFilter || groupFilter || missingInfoFilter || anomalyFilter || producerFilter || paymentTypeFilter || managerFilter || tagFilter || dateFrom || dateTo || sortField;
    if (hasAny) {
      saveFilterState({
        search,
        departmentFilter,
        programmeFilter,
        groupFilter: groupFilter || "",
        missingInfoFilter,
        anomalyFilter,
        producerFilter,
        paymentTypeFilter,
        managerFilter,
        tagFilter,
        dateFrom,
        dateTo,
        sortField: sortField || "",
        sortDir,
      });
    } else {
      clearFilterState();
    }
  }, [hydrated, search, departmentFilter, programmeFilter, groupFilter, missingInfoFilter, anomalyFilter, producerFilter, paymentTypeFilter, managerFilter, tagFilter, dateFrom, dateTo, sortField, sortDir]);

  // Push to recently used filters when any filter changes
  React.useEffect(() => {
    if (!hydrated) return;
    const hasAny = search || departmentFilter || programmeFilter || groupFilter || missingInfoFilter || anomalyFilter || producerFilter || paymentTypeFilter || managerFilter || dateFrom || dateTo;
    if (!hasAny) return;
    const f: SavedFilter["filters"] = { search, departmentFilter, programmeFilter, groupFilter: groupFilter || "", missingInfoFilter, anomalyFilter, producerFilter, paymentTypeFilter, managerFilter, tagFilter, dateFrom, dateTo, sortField: sortField || "", sortDir };
    pushRecentFilter(f);
    setRecentFilters(loadFromStorage<SavedFilter["filters"][]>(RECENT_FILTERS_KEY, []));
  }, [search, departmentFilter, programmeFilter, groupFilter, missingInfoFilter, anomalyFilter, producerFilter, paymentTypeFilter, managerFilter, tagFilter, dateFrom, dateTo, sortField, sortDir, hydrated]);

  const effectiveInvoices = useMemo(() => {
    const q = search.trim();
    if (q.length >= 2 && searchResults !== null) return searchResults;
    return invoices;
  }, [invoices, search, searchResults]);

  const rows = useMemo(() => {
    return effectiveInvoices.map((inv) => {
      const wfRaw = inv.invoice_workflows;
      const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw ?? null;
      const extRaw = inv.invoice_extracted_fields;
      const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw ?? null;
      const raw = (ext?.raw_json ?? {}) as Record<string, unknown>;
      const status = wf?.status ?? "submitted";
      const meta = parseServiceDescription(inv.service_description);

      const guest = fromAliases(meta, ["guest name", "guest", "guest_name"]);
      const title = fromAliases(meta, ["title", "programme title", "program title"]);
      const producer = fromAliases(meta, ["producer", "producer name", "prod"]);
      const paymentType = fromAliases(meta, ["payment type", "payment_type"], "paid_guest").replace(
        /_/g,
        " "
      );
      const department = inv.department_id
        ? departmentMap.get(inv.department_id) ?? inv.department_id
        : fromAliases(meta, ["department name", "department"], "—");
      const programme = inv.program_id
        ? programMap.get(inv.program_id) ?? inv.program_id
        : fromAliases(meta, ["programme name", "program name", "programme", "program"], "—");
      const topic = fromAliases(meta, ["topic", "description", "service description"]);
      const tx1 = fromAliases(meta, ["tx date", "tx date 1", "1. tx date"], inv.service_date_from ?? "—");
      const tx2 = fromAliases(meta, ["2. tx date", "tx date 2"], "—");
      const tx3 = fromAliases(meta, ["3. tx date", "tx date 3"], "—");
      const invoiceDate = fromAliases(meta, ["invoice date", "date"], inv.service_date_to ?? "—");
      const accountNameRaw =
        ext?.beneficiary_name ??
        (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name : null) ??
        "—";
      const accountName = (() => { const a = accountNameRaw === "—" ? "" : accountNameRaw; const p = guest || producer || "—"; if (!a || /trt/i.test(a)) return p; return a; })();
      const grossFromRaw =
        typeof raw.gross_amount === "number"
          ? raw.gross_amount
          : typeof raw.gross_amount === "string"
          ? Number(raw.gross_amount)
          : null;
      const amountNum = ext?.gross_amount ?? (Number.isFinite(grossFromRaw ?? NaN) ? grossFromRaw : null);
      const amount = amountNum != null ? String(amountNum) : "—";
      const amountNumVal = amountNum != null && Number.isFinite(amountNum) ? amountNum : null;
      const invNumber =
        ext?.invoice_number ??
        (typeof raw.invoice_number === "string" ? raw.invoice_number : null) ??
        (fromAliases(meta, ["source file name", "file name"], "").trim() || inv.id.slice(0, 8));
      const sortCode =
        ext?.sort_code ?? (typeof raw.sort_code === "string" ? raw.sort_code : null) ?? "—";
      const accountNumber =
        ext?.account_number ??
        (typeof raw.account_number === "string" ? raw.account_number : null) ??
        "—";
      const currency =
        ext?.extracted_currency ??
        (typeof raw.extracted_currency === "string" ? raw.extracted_currency : null) ??
        (typeof raw.currency === "string" ? raw.currency : null) ??
        (inv as { currency?: string }).currency ??
        "—";
      const bankType = (typeof raw.bank_type === "string" ? raw.bank_type : null) ?? null;
      const isInternational = bankType === "international";
      const iban =
        (typeof raw.iban === "string" ? raw.iban : null) ??
        (isInternational && accountNumber !== "—" ? accountNumber : null) ??
        "—";
      const swiftBic =
        (typeof raw.swift_bic === "string" ? raw.swift_bic : null) ??
        (isInternational && sortCode !== "—" ? sortCode : null) ??
        "—";
      const bankName = (typeof raw.bank_name === "string" ? raw.bank_name : null) ?? "—";
      const bankAddress = (typeof raw.bank_address === "string" ? raw.bank_address : null) ?? "—";
      const lineManagerId = wf?.manager_user_id ?? "";
      const lineManager = wf?.manager_user_id
        ? profileMap.get(wf.manager_user_id) ?? wf.manager_user_id
        : "—";
      const paymentDate = wf?.paid_date ?? "—";
      const group = calcGroup(status, paymentType);

      const missingFields: string[] = [];
      if (!ext?.beneficiary_name || (accountNameRaw === "—" && !ext.beneficiary_name)) missingFields.push("Beneficiary");
      if (!ext?.account_number || accountNumber === "—") missingFields.push("Account No");
      if (!ext?.sort_code || sortCode === "—") missingFields.push("Sort Code");
      if (!ext?.gross_amount || amount === "—") missingFields.push("Amount");
      if (!ext?.invoice_number) missingFields.push("Invoice No");
      const hasMissingInfo = missingFields.length > 0 || ext?.needs_review === true;

      const invFiles = (inv as { invoice_files?: { storage_path: string; file_name: string; sort_order: number }[] | null }).invoice_files;
      const sortedFiles = invFiles && invFiles.length > 0
        ? [...invFiles].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((f) => ({ storage_path: f.storage_path, file_name: f.file_name }))
        : [];
      // Always include main invoice (Invoice File) first; bank form (Int Transfer) from invoice_files
      const mainPath = inv.storage_path;
      const mainInFiles = mainPath && sortedFiles.some((f) => f.storage_path === mainPath);
      const files: { storage_path: string; file_name: string }[] =
        mainPath && !mainInFiles
          ? [{ storage_path: mainPath, file_name: mainPath.split("/").pop() ?? "invoice.pdf" }, ...sortedFiles]
          : sortedFiles.length > 0
            ? sortedFiles
            : mainPath
              ? [{ storage_path: mainPath, file_name: mainPath.split("/").pop() ?? "invoice.pdf" }]
              : [];

      const isGuestCreated =
        (inv.storage_path?.startsWith("guest-submit/") ?? false) ||
        files.some((f) => f.storage_path?.startsWith("guest-submit/"));
      const invoiceType = (inv as { invoice_type?: string }).invoice_type ?? "guest";
      const isProducerCreated = invoiceType === "guest" && !isGuestCreated;

      return {
        id: inv.id,
        submitterId: inv.submitter_user_id,
        guest,
        title,
        producer,
        paymentType,
        department,
        departmentId: inv.department_id ?? "",
        programme,
        programmeId: inv.program_id ?? "",
        topic,
        tx1,
        tx2,
        tx3,
        invoiceDate,
        accountName,
        amount,
        amountNum: amountNumVal,
        anomalyFlags: [],
        invNumber: normalizeInvoiceNumber(invNumber),
        sortCode,
        accountNumber,
        currency,
        iban,
        swiftBic,
        bankName,
        bankAddress,
        intTransfer: (() => {
          const bankFormFile = files.find((f) => f.file_name.includes("-TRTW-") && f.file_name.toLowerCase().endsWith(".docx"));
          if (bankFormFile) return bankFormFile.file_name;
          if (iban !== "—" && swiftBic !== "—") return "Generate";
          return "—";
        })(),
        lineManager,
        lineManagerId,
        paymentDate,
        status,
        rejectionReason: wf?.rejection_reason ?? "",
        createdAt: inv.created_at,
        group,
        hasMissingInfo,
        missingFields,
        files,
        tags: (inv as { tags?: string[] | null }).tags ?? [],
        isGuestCreated,
        isProducerCreated,
      } satisfies DisplayRow;
    });
  }, [effectiveInvoices, departmentMap, programMap, profileMap]);

  const rowsWithAnomalies = useMemo(() => {
    const amounts = rows.filter((r) => r.amountNum != null).map((r) => r.amountNum!);
    const n = amounts.length;
    const mean = n > 0 ? amounts.reduce((a, b) => a + b, 0) / n : 0;
    const variance = n > 1 ? amounts.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const std = Math.sqrt(variance) || 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return rows.map((r) => {
      const flags: string[] = [];
      if (r.amountNum != null && std > 0 && n >= 3) {
        if (r.amountNum > mean + 2 * std) flags.push("Unusual amount (high)");
        else if (r.amountNum < mean - 2 * std) flags.push("Unusual amount (low)");
      }
      const dateStr = r.invoiceDate?.trim();
      if (dateStr && dateStr !== "—") {
        const parsed = parseInvoiceDate(dateStr);
        if (parsed) {
          if (parsed > today) flags.push("Future date");
          else if (parsed < oneYearAgo) flags.push("Very old date (>1 year)");
        }
      }
      return { ...r, anomalyFlags: flags };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const useServerSearch = q.length >= 2 && searchResults !== null;
    let result = rowsWithAnomalies.filter((r) => {
      if (missingInfoFilter && !r.hasMissingInfo) return false;
      if (anomalyFilter && (!r.anomalyFlags || r.anomalyFlags.length === 0)) return false;
      if (departmentFilter && r.department !== departmentFilter) return false;
      if (programmeFilter && r.programme !== programmeFilter) return false;
      if (groupFilter) {
        if (groupFilter === "pending") {
          if (r.group !== "pending_line_manager" && r.group !== "ready_for_payment") return false;
        } else if (r.group !== groupFilter) return false;
      }
      if (producerFilter && r.producer !== producerFilter) return false;
      if (paymentTypeFilter && r.paymentType.toLowerCase().replace(/\s+/g, "_") !== paymentTypeFilter) return false;
      if (managerFilter && r.lineManager !== managerFilter) return false;
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      if (dateFrom && r.invoiceDate !== "—" && r.invoiceDate < dateFrom) return false;
      if (dateTo && r.invoiceDate !== "—" && r.invoiceDate > dateTo) return false;
      if (useServerSearch) return true;
      if (!q) return true;
      return (
        r.guest.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.producer.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q) ||
        r.invNumber.toLowerCase().includes(q) ||
        r.accountName.toLowerCase().includes(q) ||
        r.lineManager.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let va = a[sortField];
        let vb = b[sortField];
        if (sortField === "amount") {
          const na = parseFloat(va) || 0;
          const nb = parseFloat(vb) || 0;
          return sortDir === "asc" ? na - nb : nb - na;
        }
        va = va.toLowerCase();
        vb = vb.toLowerCase();
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rowsWithAnomalies, search, searchResults, departmentFilter, programmeFilter, groupFilter, missingInfoFilter, anomalyFilter, producerFilter, paymentTypeFilter, managerFilter, tagFilter, dateFrom, dateTo, sortField, sortDir]);

  const groupsForFilter: (DisplayRow["group"] | "pending")[] = [
    "pending",
    "pending_line_manager",
    "rejected",
    "ready_for_payment",
    "paid_invoices",
    "no_payment_needed",
  ];
  const groups: DisplayRow["group"][] = [
    "pending_line_manager",
    "rejected",
    "ready_for_payment",
    "paid_invoices",
    "no_payment_needed",
  ];

  const onManagerApprove = async (invoiceId: string) => {
    setActionLoadingId(invoiceId);
    try {
      const row = rows.find((r) => r.id === invoiceId);
      const previousStatus = row?.status ?? "pending_manager";
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "approved_by_manager",
          manager_confirmed: true,
        }),
      });
      if (res.ok) {
        fireApprovalConfetti();
        const reloadTimer = setTimeout(() => window.location.reload(), 5000);
        toast.success("Invoice approved", {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              clearTimeout(reloadTimer);
              fetch(`/api/invoices/${invoiceId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to_status: previousStatus }),
              }).then((r) => {
                if (r.ok) {
                  toast.success("Status reverted");
                  window.location.reload();
                } else {
                  toast.error("Failed to revert status");
                }
              }).catch(() => toast.error("Failed to revert status"));
            },
          },
        });
        return;
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onRejectInvoice = useCallback((invoiceId: string) => {
    setRejectInlineShakeId(invoiceId);
    setTimeout(() => setRejectInlineShakeId(null), 400);
    setRejectModalId(invoiceId);
    setRejectReason("");
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectModalId || !rejectReason.trim()) return;
    setRejectButtonShaking(true);
    setTimeout(() => setRejectButtonShaking(false), 400);
    const invoiceId = rejectModalId;
    const row = rows.find((r) => r.id === invoiceId);
    const previousStatus = row?.status ?? "pending_manager";
    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "rejected",
          rejection_reason: rejectReason.trim(),
        }),
      });
      if (res.ok) {
        const reloadTimer = setTimeout(() => window.location.reload(), 5000);
        toast.success("Invoice rejected", {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              clearTimeout(reloadTimer);
              fetch(`/api/invoices/${invoiceId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to_status: previousStatus }),
              }).then((r) => {
                if (r.ok) {
                  toast.success("Status reverted");
                  window.location.reload();
                } else {
                  toast.error("Failed to revert status");
                }
              }).catch(() => toast.error("Failed to revert status"));
            },
          },
        });
        return;
      }
    } finally {
      setActionLoadingId(null);
      setRejectModalId(null);
      setRejectReason("");
    }
  }, [rejectModalId, rejectReason, rows]);

  const onMarkPaid = async (invoiceId: string) => {
    setActionLoadingId(invoiceId);
    try {
      const row = rows.find((r) => r.id === invoiceId);
      const previousStatus = row?.status ?? "approved_by_manager";
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        triggerPaidAnimation();
        const reloadTimer = setTimeout(() => window.location.reload(), 5000);
        toast.success("Invoice marked as paid", {
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              clearTimeout(reloadTimer);
              fetch(`/api/invoices/${invoiceId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to_status: previousStatus }),
              }).then((r) => {
                if (r.ok) {
                  toast.success("Status reverted");
                  window.location.reload();
                } else {
                  toast.error("Failed to revert status");
                }
              }).catch(() => toast.error("Failed to revert status"));
            },
          },
        });
        return;
      }
      const data = await res.json().catch(() => null);
      toast.error(getApiErrorMessage(data));
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (!expandedRowId) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (rejectModalId || editModalRow || previewUrl || previewHtml || showCompareModal || showAssignManagerModal || showMoveModal || showImportModal || showCustomReport) return;

      const row = rows.find((r) => r.id === expandedRowId);
      if (!row) return;
      const isSubmitter = row.submitterId === currentUserId;
      const canApprove = currentRole === "admin" || (!isSubmitter && currentRole === "manager");

      if ((e.key === "a" || e.key === "A") && row.status === "pending_manager" && canApprove) {
        e.preventDefault();
        void onManagerApprove(expandedRowId);
      }
      if (e.key === "r" || e.key === "R") {
        const canReject =
          (row.status === "pending_manager" && canApprove) ||
          (row.status === "ready_for_payment" && currentRole === "admin") ||
          ((row.status === "approved_by_manager" || row.status === "pending_admin") && currentRole === "admin");
        if (canReject) {
          e.preventDefault();
          onRejectInvoice(expandedRowId);
        }
      }
      const canMarkPaid =
        (currentRole === "admin" || currentRole === "finance") &&
        ["approved_by_manager", "pending_admin", "ready_for_payment"].includes(row.status);
      if ((e.key === "p" || e.key === "P") && canMarkPaid) {
        e.preventDefault();
        void onMarkPaid(expandedRowId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expandedRowId, rejectModalId, editModalRow, previewUrl, previewHtml, showCompareModal, showAssignManagerModal, showMoveModal, showImportModal, showCustomReport, rows, currentRole, currentUserId, onManagerApprove, onRejectInvoice, onMarkPaid]);

  const closePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewHtml(null);
    setPreviewDownloadUrl(null);
    setPreviewLoading(false);
  }, []);

  const saveTag = useCallback(async (invoiceId: string, newTag: string, currentTags: string[]) => {
    const tag = newTag.trim().toLowerCase();
    if (!tag || currentTags.includes(tag)) return;
    const updated = [...currentTags, tag];
    try {
      const res = await fetch("/api/invoices/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, tags: updated }),
      });
      if (res.ok) {
        const row = rows.find((r) => r.id === invoiceId);
        if (row) row.tags = updated;
        toast.success(`Tag "${tag}" added`);
      }
    } catch { /* */ }
  }, [rows]);

  const removeTag = useCallback(async (invoiceId: string, tagToRemove: string, currentTags: string[]) => {
    const updated = currentTags.filter((t) => t !== tagToRemove);
    try {
      const res = await fetch("/api/invoices/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, tags: updated }),
      });
      if (res.ok) {
        const row = rows.find((r) => r.id === invoiceId);
        if (row) row.tags = updated;
        toast.success(`Tag "${tagToRemove}" removed`);
      }
    } catch { /* */ }
  }, [rows]);

  const openPdf = useCallback(async (invoiceId: string, storagePath?: string) => {
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewHtml(null);
    try {
      const url = storagePath
        ? `/api/invoices/${invoiceId}/pdf?path=${encodeURIComponent(storagePath)}`
        : `/api/invoices/${invoiceId}/pdf`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.url) return;
      const row = rows.find((r) => r.id === invoiceId);
      setPreviewName(storagePath ? (storagePath.split("/").pop() ?? row?.invNumber ?? "File") : (row?.invNumber ?? "File"));
      setPreviewDownloadUrl(data.url);

      const fileRes = await fetch(data.url);
      const blob = await fileRes.blob();
      const mime = blob.type.toLowerCase();
      const fileUrl = data.url.toLowerCase();
      const pathLower = storagePath?.toLowerCase() ?? "";

      if (mime.includes("pdf") || fileUrl.includes(".pdf")) {
        const blobUrl = URL.createObjectURL(blob);
        setPreviewHtml(null);
        setPreviewUrl(blobUrl);
      } else if (mime.includes("word") || mime.includes("docx") || fileUrl.includes(".docx") || fileUrl.includes(".doc")) {
        const mammoth = await import("mammoth");
        const arrayBuf = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
        setPreviewUrl(null);
        setPreviewHtml(sanitizeHtml(result.value));
      } else if (mime.includes("sheet") || mime.includes("excel") || fileUrl.includes(".xlsx") || fileUrl.includes(".xls") || pathLower.endsWith(".xlsx") || pathLower.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const arrayBuf = await blob.arrayBuffer();
        const wb = XLSX.read(arrayBuf, { type: "array" });
        let html = "";
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          html += `<h3 style="margin:16px 0 8px;font-weight:bold;font-size:14px;">${name}</h3>`;
          html += XLSX.utils.sheet_to_html(ws, { editable: false });
        }
        setPreviewUrl(null);
        setPreviewHtml(sanitizeHtml(html));
      } else {
        const blobUrl = URL.createObjectURL(blob);
        setPreviewHtml(null);
        setPreviewUrl(blobUrl);
      }
    } catch {
      // silently fail
    } finally {
      setPreviewLoading(false);
    }
  }, [rows]);

  const openPdfInNewTab = useCallback(async (id: string, storagePath?: string) => {
    try {
      const url = storagePath
        ? `/api/invoices/${id}/pdf?path=${encodeURIComponent(storagePath)}`
        : `/api/invoices/${id}/pdf`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
    } catch { /* */ }
  }, []);

  const onDownloadFile = useCallback(async (invoiceId: string, storagePath: string, fileName: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf?path=${encodeURIComponent(storagePath)}`);
      const data = await res.json();
      if (!data?.url) return;
      const fileRes = await fetch(data.url);
      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    }
  }, []);

  const onDeleteInvoice = async (invoiceId: string) => {
    const ok = window.confirm("Are you sure you want to delete this invoice?");
    if (!ok) return;

    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error((data as { error?: string }).error ?? "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setActionLoadingId(null);
    }
  };

  const onResubmit = async (invoiceId: string) => {
    const ok = window.confirm("Resubmit this invoice for manager approval?");
    if (!ok) return;
    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: "pending_manager" }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onMoveToLineManager = async (invoiceId: string) => {
    const ok = window.confirm("Move this invoice back to Pending Dept EP for re-review?");
    if (!ok) return;
    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: "pending_manager" }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(getApiErrorMessage(data));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onMoveToArchived = async (invoiceId: string) => {
    const ok = window.confirm("Move this invoice to Archived?");
    if (!ok) return;
    setActionLoadingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: "archived" }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(getApiErrorMessage(data));
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const onReplaceFile = async (invoiceId: string, file: File) => {
    setActionLoadingId(invoiceId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/invoices/${invoiceId}/replace-file`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(getApiErrorMessage(data));
      }
    } catch (err) {
      toast.error(toUserFriendlyError(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  const onAddFile = useCallback(async (invoiceId: string, file: File) => {
    setActionLoadingId(invoiceId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/invoices/${invoiceId}/add-file`, { method: "POST", body: fd });
      if (res.ok && expandedRowId === invoiceId) {
        const flRes = await fetch(`/api/invoices/${invoiceId}/files`);
        if (flRes.ok) setFilesData(await flRes.json());
        toast.success("File added");
      } else if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(getApiErrorMessage(data));
      }
    } catch (err) {
      toast.error(toUserFriendlyError(err));
    } finally {
      setActionLoadingId(null);
    }
  }, [expandedRowId]);

  const onToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onToggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const onBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch("/api/invoices/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(getApiErrorMessage(data));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBulkDownloading(false);
    }
  }, [selectedIds]);

  const onDownloadAllFiles = useCallback(async (id: string) => {
    setSingleDownloading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/download-files`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(getApiErrorMessage(data));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${id}-files.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setSingleDownloading(false);
    }
  }, []);

  const [bankFormLoading, setBankFormLoading] = useState(false);
  const onGenerateBankTransferForm = useCallback(async (id: string) => {
    setBankFormLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}/bank-transfer-form`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error((data as { error?: string })?.error ?? "Failed to generate form");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? `bank-transfer-form-${id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Bank transfer form downloaded and added to invoice files");
      window.location.reload();
    } catch {
      toast.error("Failed to generate bank transfer form");
    } finally {
      setBankFormLoading(false);
    }
  }, []);

  // Column visibility (order follows DEFAULT_VISIBLE_COLUMNS = ready_for_payment layout)
  const toggleColumn = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : DEFAULT_VISIBLE_COLUMNS.filter((k) => prev.includes(k) || k === key);
      localStorage.setItem("invoice_visible_columns", JSON.stringify(next));
      return next;
    });
  }, []);

  // Row expand - load timeline, files & notes
  const [filesData, setFilesData] = useState<{ storage_path: string; file_name: string }[]>([]);
  const initialExpandDoneRef = useRef(false);
  useEffect(() => {
    if (!initialExpandedId || initialExpandDoneRef.current) return;
    const hasRow = effectiveInvoices.some((inv) => inv.id === initialExpandedId);
    if (!hasRow) return;
    initialExpandDoneRef.current = true;
    setDetailLoading(true);
    setTimelineData([]);
    setFilesData([]);
    setNotesData([]);
    Promise.all([
      fetch(`/api/invoices/${initialExpandedId}/timeline`),
      fetch(`/api/invoices/${initialExpandedId}/files`),
      fetch(`/api/invoices/${initialExpandedId}/notes`),
    ]).then(([tlRes, flRes, ntRes]) => {
      if (tlRes.ok) tlRes.json().then(setTimelineData);
      if (flRes.ok) flRes.json().then(setFilesData);
      if (ntRes.ok) ntRes.json().then(setNotesData);
    }).finally(() => setDetailLoading(false));
  }, [initialExpandedId, effectiveInvoices]);
  const toggleExpandRow = useCallback(async (id: string) => {
    if (expandedRowId === id) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(id);
    setDetailLoading(true);
    setTimelineData([]);
    setFilesData([]);
    setNotesData([]);
    try {
      const [tlRes, flRes, ntRes] = await Promise.all([
        fetch(`/api/invoices/${id}/timeline`),
        fetch(`/api/invoices/${id}/files`),
        fetch(`/api/invoices/${id}/notes`),
      ]);
      if (tlRes.ok) setTimelineData(await tlRes.json());
      if (flRes.ok) setFilesData(await flRes.json());
      if (ntRes.ok) setNotesData(await ntRes.json());
    } finally {
      setDetailLoading(false);
    }
  }, [expandedRowId]);

  const addNote = useCallback(async () => {
    if (!expandedRowId || !newNote.trim()) return;
    try {
      const res = await fetch(`/api/invoices/${expandedRowId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotesData((prev) => [...prev, note]);
        setNewNote("");
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(getApiErrorMessage(d));
      }
    } catch {
      toast.error("Failed to add note. Check your connection.");
    }
  }, [expandedRowId, newNote]);

  // Saved filters
  const saveCurrentFilter = useCallback(() => {
    if (!filterName.trim()) return;
    const f: SavedFilter = {
      name: filterName.trim(),
      filters: { search, departmentFilter, programmeFilter, groupFilter: groupFilter || "", missingInfoFilter, anomalyFilter, producerFilter, paymentTypeFilter, managerFilter, tagFilter, dateFrom, dateTo, sortField: sortField || "", sortDir },
    };
    const next = [...savedFilters, f];
    setSavedFilters(next);
    localStorage.setItem("invoice_saved_filters", JSON.stringify(next));
    setFilterName("");
    setShowSaveFilter(false);
  }, [filterName, search, departmentFilter, programmeFilter, groupFilter, missingInfoFilter, anomalyFilter, producerFilter, paymentTypeFilter, managerFilter, tagFilter, dateFrom, dateTo, sortField, sortDir, savedFilters]);

  const applySavedFilter = useCallback((f: SavedFilter) => {
    setSearch(f.filters.search);
    setDepartmentFilter(f.filters.departmentFilter);
    setProgrammeFilter(f.filters.programmeFilter);
    setGroupFilter((f.filters.groupFilter || "") as "" | DisplayRow["group"] | "pending");
    setMissingInfoFilter(f.filters.missingInfoFilter ?? false);
    setAnomalyFilter(f.filters.anomalyFilter ?? false);
    setProducerFilter(f.filters.producerFilter ?? "");
    setPaymentTypeFilter(f.filters.paymentTypeFilter ?? "");
    setManagerFilter(f.filters.managerFilter ?? "");
    setTagFilter(f.filters.tagFilter ?? "");
    setDateFrom(f.filters.dateFrom ?? "");
    setDateTo(f.filters.dateTo ?? "");
    setSortField((f.filters.sortField || "") as typeof sortField);
    setSortDir((f.filters.sortDir || "desc") as typeof sortDir);
    setCurrentPage(0);
  }, []);

  const applyRecentFilter = useCallback((f: SavedFilter["filters"]) => {
    setSearch(f.search ?? "");
    setDepartmentFilter(f.departmentFilter ?? "");
    setProgrammeFilter(f.programmeFilter ?? "");
    setGroupFilter((f.groupFilter ?? "") as "" | DisplayRow["group"] | "pending");
    setMissingInfoFilter(f.missingInfoFilter ?? false);
    setAnomalyFilter(f.anomalyFilter ?? false);
    setProducerFilter(f.producerFilter ?? "");
    setPaymentTypeFilter(f.paymentTypeFilter ?? "");
    setManagerFilter(f.managerFilter ?? "");
    setTagFilter(f.tagFilter ?? "");
    setDateFrom(f.dateFrom ?? "");
    setDateTo(f.dateTo ?? "");
    setSortField((f.sortField ?? "") as typeof sortField);
    setSortDir((f.sortDir ?? "desc") as typeof sortDir);
    setCurrentPage(0);
  }, []);

  const deleteSavedFilter = useCallback((index: number) => {
    const next = savedFilters.filter((_, i) => i !== index);
    setSavedFilters(next);
    localStorage.setItem("invoice_saved_filters", JSON.stringify(next));
  }, [savedFilters]);

  // Bulk actions
  const bulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Approve ${selectedIds.size} invoice(s)?`)) return;
    setActionLoadingId("bulk");
    try {
      const res = await fetch("/api/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_ids: Array.from(selectedIds), to_status: "approved_by_manager", manager_confirmed: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: number; failed?: { id: string; error: string }[] };
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Bulk approve failed");
        return;
      }
      if ((data.failed?.length ?? 0) > 0) {
        toast.error(`${data.success ?? 0} approved. ${data.failed!.length} failed: ${data.failed!.map((f) => f.error).join("; ")}`);
      } else {
        toast.success(`${data.success ?? 0} invoice(s) approved`);
      }
      setSelectedIds(new Set());
      window.location.reload();
    } finally {
      setActionLoadingId(null);
    }
  }, [selectedIds]);

  const bulkReject = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const reason = window.prompt(`Rejection reason for ${selectedIds.size} invoice(s):`);
    if (!reason?.trim()) return;
    setActionLoadingId("bulk");
    try {
      const res = await fetch("/api/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_ids: Array.from(selectedIds), to_status: "rejected", rejection_reason: reason.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: number; failed?: { id: string; error: string }[] };
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Bulk reject failed");
        return;
      }
      if ((data.failed?.length ?? 0) > 0) {
        toast.error(`${data.success ?? 0} rejected. ${data.failed!.length} failed: ${data.failed!.map((f) => f.error).join("; ")}`);
      } else {
        toast.success(`${data.success ?? 0} invoice(s) rejected`);
      }
      setSelectedIds(new Set());
      window.location.reload();
    } finally {
      setActionLoadingId(null);
    }
  }, [selectedIds]);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} invoice(s)? This cannot be undone.`)) return;
    const idsToDelete = currentRole === "submitter"
      ? Array.from(selectedIds).filter(id => {
          const r = rows.find(x => x.id === id);
          return r && r.submitterId === currentUserId && ["submitted", "pending_manager", "rejected"].includes(r.status);
        })
      : Array.from(selectedIds);
    if (idsToDelete.length === 0) {
      toast.error("No invoices selected that you can delete.");
      return;
    }
    for (const id of idsToDelete) {
      await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    }
    setSelectedIds(new Set());
    window.location.reload();
  }, [selectedIds, currentRole, currentUserId, rows]);

  const bulkAssignManager = useCallback(async (managerId: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setShowAssignManagerModal(false);
    setActionLoadingId("bulk");
    try {
      const errors: string[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/invoices/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manager_user_id: managerId || null }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) errors.push(`Invoice ${id}: ${data.error ?? res.statusText}`);
      }
      if (errors.length > 0) {
        toast.error(errors.join("\n"));
        return;
      }
      toast.success(managerId ? `Assigned ${ids.length} invoice(s) to line manager` : `Unassigned ${ids.length} invoice(s)`);
      setSelectedIds(new Set());
      window.location.reload();
    } finally {
      setActionLoadingId(null);
    }
  }, [selectedIds]);

  const bulkMoveToGroup = useCallback(async (groupKey: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setShowMoveModal(false);

    let toStatus: string;
    let payload: Record<string, unknown> = {};

    if (groupKey === "pending_line_manager") {
      toStatus = "pending_manager";
    } else if (groupKey === "rejected") {
      const reason = window.prompt(`Rejection reason for ${ids.length} invoice(s):`);
      if (!reason?.trim()) return;
      toStatus = "rejected";
      payload = { rejection_reason: reason.trim() };
    } else if (groupKey === "ready_for_payment") {
      toStatus = "ready_for_payment";
    } else if (groupKey === "paid_invoices") {
      toStatus = "paid";
      payload = { paid_date: new Date().toISOString().split("T")[0] };
    } else if (groupKey === "no_payment_needed") {
      toStatus = "archived";
    } else {
      return;
    }

    setActionLoadingId("bulk");
    try {
      const res = await fetch("/api/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_ids: ids, to_status: toStatus, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: number; failed?: { id: string; error: string }[] };
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Bulk status change failed");
        return;
      }
      if ((data.failed?.length ?? 0) > 0) {
        toast.error(`${data.success ?? 0} updated. ${data.failed!.length} failed: ${data.failed!.map((f) => f.error).join("; ")}`);
      } else {
        toast.success(`${data.success ?? 0} invoice(s) updated`);
      }
      setSelectedIds(new Set());
      window.location.reload();
    } finally {
      setActionLoadingId(null);
    }
  }, [selectedIds]);

  // Duplicate detection: same guest + amount (+ invoice number when available)
  const duplicates = useMemo(() => {
    const seen = new Map<string, string[]>();
    rows.forEach((r) => {
      if (r.amount === "—" || !r.guest || r.guest === "—") return;
      const inv = (r.invNumber && r.invNumber !== "—") ? r.invNumber.trim().toLowerCase() : "";
      const key = inv ? `${r.guest.toLowerCase().trim()}|${r.amount}|${inv}` : `${r.guest.toLowerCase().trim()}|${r.amount}`;
      const arr = seen.get(key) ?? [];
      arr.push(r.id);
      seen.set(key, arr);
    });
    const dupeIds = new Set<string>();
    seen.forEach((ids) => { if (ids.length > 1) ids.forEach((id) => dupeIds.add(id)); });
    return dupeIds;
  }, [rows]);

  // PDF export
  const exportCustomReport = useCallback(async (data: DisplayRow[]) => {
    const fields = Object.entries(customReportFields).filter(([, v]) => v).map(([k]) => k);
    if (fields.length === 0) return;
    const { getFormatters } = await import("@/lib/export-locale");
    const { formatDate, formatCurrency } = getFormatters(exportLocale);
    const XLSX = await import("xlsx");
    const fieldLabels: Record<string, string> = { guest: "Guest", producer: "Producer", department: "Department", programme: "Programme", amount: "Amount", invoiceDate: "Date", accountName: "Account", invNumber: "INV#", status: "Status", paymentType: "Payment", topic: "Topic", tx1: "TX1", lineManager: "Dept EP", title: "Title" };
    const dateFields = new Set(["invoiceDate", "tx1", "tx2", "tx3"]);
    const rows = data.map((r) => {
      const obj: Record<string, string> = {};
      fields.forEach((f) => {
        if (f === "amount" && r.amountNum != null) {
          obj[fieldLabels[f] ?? f] = formatCurrency(r.amountNum);
        } else if (dateFields.has(f)) {
          const v = (r as Record<string, unknown>)[f];
          obj[fieldLabels[f] ?? f] = formatDate(v as string | Date | null | undefined);
        } else {
          const v = (r as Record<string, unknown>)[f];
          obj[fieldLabels[f] ?? f] = v != null && typeof v !== "object" ? String(v) : "";
        }
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custom Report");
    XLSX.writeFile(wb, `invoice-report-${new Date().toISOString().split("T")[0]}.xlsx`, { bookSST: true });
    setShowCustomReport(false);
  }, [customReportFields, exportLocale]);

  const exportPdf = useCallback(async (data: DisplayRow[]) => {
    const { getFormatters } = await import("@/lib/export-locale");
    const { formatDate, formatCurrency } = getFormatters(exportLocale);
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const { ensurePdfFont } = await import("@/lib/pdf-font");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    await ensurePdfFont(doc);
    doc.setFontSize(14);
    doc.text("Invoice Report", 14, 15);
    doc.setFontSize(8);
    doc.text(`Generated: ${formatDate(new Date())}`, 14, 20);
    autoTable(doc, {
      startY: 25,
      styles: { font: "Roboto", fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      head: [["Guest", "Producer", "Payment", "Department", "Programme", "Amount", "INV#", "Status", "Date"]],
      body: data.map((r) => [
        r.guest,
        r.producer,
        r.paymentType,
        r.department,
        r.programme,
        r.amountNum != null ? formatCurrency(r.amountNum) : r.amount,
        r.invNumber,
        r.status,
        formatDate(r.invoiceDate),
      ]),
    });
    doc.save(`invoices-${new Date().toISOString().split("T")[0]}.pdf`);
  }, [exportLocale]);

  const downloadFile = useCallback(async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }, []);

  const csvEscape = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportToCsv = useCallback((data: DisplayRow[]) => {
    const headers = ["Guest Name", "Title", "Producer", "Payment Type", "Department", "Programme", "Topic", "TX Date 1", "TX Date 2", "TX Date 3", "Invoice Date", "Account Name", "Amount", "Currency", "INV Number", "Sort Code", "Account Number", "IBAN", "SWIFT/BIC", "Bank Name", "Bank Address", "Int Transfer", "Dept EP", "Payment Date", "Status", "Rejection Reason"];
    const rows = data.map((r) => {
      const bankFormFile = r.files.find((f) => f.file_name.includes("-TRTW-") && f.file_name.toLowerCase().endsWith(".docx"));
      const intTransfer = bankFormFile ? bankFormFile.file_name : (r.iban !== "—" && r.swiftBic !== "—" ? "Generate" : "—");
      return [r.guest, r.title, r.producer, r.paymentType, r.department, r.programme, r.topic, r.tx1, r.tx2, r.tx3, r.invoiceDate, r.accountName, r.amount, r.currency, r.invNumber, r.sortCode, r.accountNumber, r.iban, r.swiftBic, r.bankName, r.bankAddress, intTransfer, r.lineManager, r.paymentDate, r.status, r.rejectionReason || ""];
    });
    const csv = [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportToExcel = useCallback(async (data: DisplayRow[]) => {
    const { getFormatters } = await import("@/lib/export-locale");
    const { formatDate, formatCurrency } = getFormatters(exportLocale);
    const XLSX = await import("xlsx");
    const rows = data.map((r) => ({
      "Guest Name": r.guest,
      "Title": r.title,
      "Producer": r.producer,
      "Payment Type": r.paymentType,
      "Department": r.department,
      "Programme": r.programme,
      "Topic": r.topic,
      "TX Date 1": formatDate(r.tx1),
      "TX Date 2": formatDate(r.tx2),
      "TX Date 3": formatDate(r.tx3),
      "Invoice Date": formatDate(r.invoiceDate),
      "Account Name": r.accountName,
      "Amount": r.amountNum != null ? formatCurrency(r.amountNum) : r.amount,
      "Currency": r.currency,
      "INV Number": r.invNumber,
      "Sort Code": r.sortCode,
      "Account Number": r.accountNumber,
      "IBAN": r.iban,
      "SWIFT/BIC": r.swiftBic,
      "Bank Name": r.bankName,
      "Bank Address": r.bankAddress,
      "Int Transfer": (() => {
        const bankFormFile = r.files.find((f) => f.file_name.includes("-TRTW-") && f.file_name.toLowerCase().endsWith(".docx"));
        return bankFormFile ? bankFormFile.file_name : (r.iban !== "—" && r.swiftBic !== "—" ? "Generate" : "—");
      })(),
      "Dept EP": r.lineManager,
      "Payment Date": formatDate(r.paymentDate),
      "Status": r.status,
      "Rejection Reason": r.rejectionReason || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `invoices-${new Date().toISOString().split("T")[0]}.xlsx`, { bookSST: true });
  }, [exportLocale]);

  const saveDraft = useCallback(async (invoiceId: string, draft: EditDraft) => {
    const isInternational = draft.bankType === "international" && draft.iban.trim() && draft.swiftBic.trim();
    const payload: Record<string, unknown> = {
      guest_name: draft.guest,
      title: draft.title,
      producer: draft.producer,
      payment_type: draft.paymentType.replace(/\s+/g, "_"),
      department_id: draft.departmentId || null,
      program_id: draft.programmeId || null,
      topic: draft.topic,
      invoice_date: draft.invoiceDate,
      tx_date_1: draft.tx1,
      tx_date_2: draft.tx2,
      tx_date_3: draft.tx3,
      beneficiary_name: draft.accountName,
      gross_amount: draft.amount,
      invoice_number: draft.invNumber,
      extracted_currency: draft.currency || "GBP",
      manager_user_id: draft.lineManagerId || null,
    };
    if (isInternational) {
      payload.account_number = draft.iban.trim();
      payload.sort_code = draft.swiftBic.trim();
      payload.bank_type = "international";
      payload.iban = draft.iban.trim();
      payload.swift_bic = draft.swiftBic.trim();
      payload.bank_name = draft.bankName.trim() || null;
      payload.bank_address = draft.bankAddress.trim() || null;
    } else {
      payload.account_number = draft.accountNumber;
      payload.sort_code = draft.sortCode;
      payload.bank_type = "uk";
    }
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error ?? "Save failed");
    }
  }, []);

  const onStartEdit = useCallback((row: DisplayRow) => {
    setEditModalRow(row);
  }, []);

  const handleEditModalSave = useCallback(async (draft: EditDraft, file?: File) => {
    if (!editModalRow) return;
    setActionLoadingId(editModalRow.id);
    try {
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const replaceRes = await fetch(`/api/invoices/${editModalRow.id}/replace-file`, { method: "POST", body: fd });
        if (!replaceRes.ok) {
          const data = await replaceRes.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? "File replace failed");
        }
      }
      await saveDraft(editModalRow.id, draft);
      if (editModalRow.status === "rejected") {
        const statusRes = await fetch(`/api/invoices/${editModalRow.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_status: "pending_manager" }),
        });
        if (!statusRes.ok) {
          const data = await statusRes.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? "Resubmit failed");
        }
      }
      setEditModalRow(null);
      window.location.reload();
    } catch (err) {
      toast.error(toUserFriendlyError(err));
    } finally {
      setActionLoadingId(null);
    }
  }, [editModalRow, saveDraft]);

  useEffect(() => {
    let disposed = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (disposed) return;
        const supabase = createClient();
        sub = supabase.channel("guest-rt").on("postgres_changes", { event: "*", schema: "public", table: "invoice_workflows" }, () => {
          if (!disposed) window.location.reload();
        }).subscribe();
      } catch { /* realtime not critical */ }
    })();
    return () => { disposed = true; sub?.unsubscribe(); };
  }, []);

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 max-w-full min-w-0 overflow-x-hidden">
      {actionLoadingId && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div className="h-full w-1/3 bg-blue-500 animate-loading-bar" />
        </div>
      )}
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Guest Invoice Submission</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/invoices/invited-guests"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-100 hover:border-emerald-500/60 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
            Invited Guests
          </Link>
          {currentRole !== "viewer" && (
            <Link
              href="/submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
              New Invoice
            </Link>
          )}
          <button
            onClick={() => setShowDashboard((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all shadow-sm ${
              showDashboard
                ? "bg-violet-600 text-white shadow-violet-500/25 hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400"
                : "bg-sky-600 text-white shadow-sky-500/20 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
            {showDashboard ? "Hide Dashboard" : "Dashboard"}
          </button>
          <div className="relative" ref={columnsAnchorRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowColumnPicker((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>
              Columns
            </button>
            {showColumnPicker && columnPickerPos && typeof document !== "undefined" && createPortal(
              <div
                id="columns-dropdown-portal"
                className="fixed z-[9999] w-56 rounded-xl border-2 border-slate-300 bg-white p-3 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
                style={{ top: columnPickerPos.top, left: columnPickerPos.left }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-slate-400">Toggle Columns</p>
                {ALL_COLUMNS.filter((c) => c.key !== "checkbox").map((c) => (
                  <label key={c.key} className="flex items-center gap-2 py-0.5 text-xs text-gray-700 cursor-pointer hover:text-gray-900 dark:text-slate-200 dark:hover:text-white">
                    <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={() => toggleColumn(c.key)} className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600" onClick={(e) => e.stopPropagation()} />
                    {c.label || c.key}
                  </label>
                ))}
                <button type="button" onClick={(e) => { e.stopPropagation(); setVisibleColumns([...DEFAULT_VISIBLE_COLUMNS]); localStorage.removeItem("invoice_visible_columns"); }} className="mt-2 w-full rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                  Reset All
                </button>
              </div>,
              document.body
            )}
          </div>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
          >
            <option value={10}>10/page</option>
            <option value={25}>25/page</option>
            <option value={50}>50/page</option>
            <option value={100}>100/page</option>
          </select>
        </div>
      </div>

      {/* Dashboard */}
      {showDashboard && (
        <Suspense fallback={<div className="p-4 text-sm text-gray-400">Loading dashboard...</div>}>
          <DashboardSection invoices={rows.map((r) => ({ id: r.id, created_at: r.createdAt, status: r.status, amount: r.amount, department: r.department, programme: r.programme, producer: r.producer, guest: r.guest, paymentType: r.paymentType, group: r.group }))} />
        </Suspense>
      )}

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Saved:</span>
          {savedFilters.map((f, i) => (
            <div key={i} className="inline-flex items-center gap-1 rounded-full bg-[#5034FF]/10 px-2.5 py-1 text-xs font-medium text-[#5034FF] dark:bg-[#5034FF]/20 dark:text-[#a78bfa]">
              <button onClick={() => applySavedFilter(f)} className="hover:text-indigo-900">{f.name}</button>
              <button onClick={() => deleteSavedFilter(i)} className="text-indigo-400 hover:text-red-500">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Click-outside overlay: clears selection when clicking empty space */}
      {selectedIds.size > 0 && (currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter" || currentRole === "viewer") && (
        <div
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setSelectedIds(new Set())}
          aria-hidden
        />
      )}
      {/* Bulk Actions Bar - Admin/Manager/Operations: full actions; Submitter: Delete only; Viewer: Download only */}
      {selectedIds.size > 0 && (currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter" || currentRole === "viewer") && (
        <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-blue-500 bg-blue-50 px-4 py-3 shadow-2xl dark:border-blue-400 dark:bg-blue-950/50" onClick={(e) => e.stopPropagation()}>
          <span className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">{selectedIds.size}</span>
            Guest selected
          </span>
          {rolesCanDelete.includes(currentRole) && (
          <button onClick={() => void bulkDelete()} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Delete
          </button>
          )}
          {(currentRole === "admin" || currentRole === "manager" || currentRole === "operations") && (
            <>
          <button onClick={() => void bulkApprove()} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            {actionLoadingId === "bulk" ? "Approving..." : "Approve Selected"}
          </button>
          <button onClick={() => void bulkReject()} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            {actionLoadingId === "bulk" ? "Rejecting..." : "Reject Selected"}
          </button>
          <button onClick={() => exportToCsv(rows.filter((r) => selectedIds.has(r.id)))} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-950/50">
            CSV
          </button>
          <button onClick={() => void exportToExcel(rows.filter((r) => selectedIds.has(r.id)))} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            Excel
          </button>
          <button onClick={() => setShowMoveModal(true)} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
            Move
          </button>
          <button onClick={() => setShowAssignManagerModal(true)} disabled={actionLoadingId === "bulk"} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Assign Dept EP
          </button>
          {selectedIds.size === 2 && (
            <button onClick={() => setShowCompareModal(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>
              Compare
            </button>
          )}
            </>
          )}
          <button onClick={() => void onBulkDownload()} disabled={bulkDownloading} className="inline-flex items-center gap-1.5 rounded-lg bg-[#5034FF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4030dd] disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            {bulkDownloading ? "Downloading..." : `Download Files (${selectedIds.size})`}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
            ✕ Close
          </button>
        </div>
      )}

      {showMoveModal && (
        <BulkMoveModal
          groups={GUEST_MOVE_GROUPS}
          onSelect={(key) => void bulkMoveToGroup(key)}
          onClose={() => setShowMoveModal(false)}
        />
      )}

      {showCompareModal && (() => {
        const ids = selectedIds.size === 2 ? Array.from(selectedIds) : [compareId1, compareId2];
        const a = rows.find((r) => r.id === ids[0]);
        const b = rows.find((r) => r.id === ids[1]);
        const hasPicks = selectedIds.size === 2 || (compareId1 && compareId2 && compareId1 !== compareId2);
        if (!hasPicks) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCompareModal(false)}>
              <div className="w-full max-w-md rounded-2xl border-2 border-gray-300 bg-white shadow-2xl dark:border-gray-600 dark:bg-slate-800 p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Compare invoices</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select two different invoices to compare.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Invoice 1</label>
                    <select value={compareId1} onChange={(e) => setCompareId1(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-slate-800 dark:text-white">
                      <option value="">Select...</option>
                      {filtered.map((r) => (
                        <option key={r.id} value={r.id}>{r.guest} — {r.invNumber} ({r.amount})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Invoice 2</label>
                    <select value={compareId2} onChange={(e) => setCompareId2(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-slate-800 dark:text-white">
                      <option value="">Select...</option>
                      {filtered.map((r) => (
                        <option key={r.id} value={r.id}>{r.guest} — {r.invNumber} ({r.amount})</option>
                      ))}
                    </select>
                  </div>
                  {compareId1 && compareId2 && compareId1 === compareId2 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Select two different invoices.</p>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setShowCompareModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-slate-700">Cancel</button>
                </div>
              </div>
            </div>
          );
        }
        if (!a || !b) return null;
        const fields: { key: keyof DisplayRow; label: string }[] = [
          { key: "guest", label: "Guest" },
          { key: "title", label: "Title" },
          { key: "producer", label: "Producer" },
          { key: "department", label: "Department" },
          { key: "programme", label: "Programme" },
          { key: "topic", label: "Topic" },
          { key: "tx1", label: "TX Date" },
          { key: "tx2", label: "2. TX Date" },
          { key: "tx3", label: "3. TX Date" },
          { key: "invoiceDate", label: "Invoice Date" },
          { key: "accountName", label: "Account Name" },
          { key: "amount", label: "Amount" },
          { key: "currency", label: "Currency" },
          { key: "invNumber", label: "INV Number" },
          { key: "sortCode", label: "Sort Code" },
          { key: "accountNumber", label: "Account Number" },
          { key: "iban", label: "IBAN" },
          { key: "swiftBic", label: "SWIFT/BIC" },
          { key: "bankName", label: "Bank Name" },
          { key: "bankAddress", label: "Bank Address" },
          { key: "intTransfer", label: "Int Transfer" },
          { key: "lineManager", label: "Dept EP" },
          { key: "paymentType", label: "Payment Type" },
          { key: "status", label: "Status" },
          { key: "paymentDate", label: "Payment Date" },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCompareModal(false)}>
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border-2 border-gray-300 bg-white shadow-2xl dark:border-gray-600 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b-2 border-gray-300 px-4 py-3 dark:border-slate-600">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Compare invoices</h3>
                <button onClick={() => setShowCompareModal(false)} className="rounded-lg px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-slate-700">Close</button>
              </div>
              <div className="overflow-auto max-h-[calc(90vh-60px)] p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-slate-600">
                      <th className="text-left py-2 pr-4 font-semibold text-gray-700 dark:text-gray-300 w-36">Field</th>
                      <th className="text-left py-2 px-2 font-semibold text-sky-700 dark:text-sky-300 min-w-[180px]">{a.guest} ({a.invNumber})</th>
                      <th className="text-left py-2 px-2 font-semibold text-sky-700 dark:text-sky-300 min-w-[180px]">{b.guest} ({b.invNumber})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(({ key, label }) => {
                      const va = String((a as Record<string, unknown>)[key] ?? "—");
                      const vb = String((b as Record<string, unknown>)[key] ?? "—");
                      const diff = va !== vb;
                      return (
                        <tr key={key} className={`border-b border-gray-100 dark:border-slate-700 ${diff ? "bg-amber-50/50 dark:bg-amber-900/20" : ""}`}>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 font-medium">{label}</td>
                          <td className={`py-2 px-2 ${diff ? "text-amber-800 dark:text-amber-200 font-medium" : ""}`}>{va || "—"}</td>
                          <td className={`py-2 px-2 ${diff ? "text-amber-800 dark:text-amber-200 font-medium" : ""}`}>{vb || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => void openPdf(a.id)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500">Open invoice 1</button>
                  <button onClick={() => void openPdf(b.id)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500">Open invoice 2</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showAssignManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAssignManagerModal(false)}>
          <div
            className="w-full max-w-md rounded-2xl border-2 border-gray-300 bg-white shadow-2xl dark:border-gray-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-gray-300 px-4 py-3 dark:border-slate-600">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assign Dept EP</h3>
              <button
                onClick={() => setShowAssignManagerModal(false)}
                className="rounded-lg px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-slate-700"
              >
                Back
              </button>
            </div>
            <div className="p-4">
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                Assign {selectedIds.size} invoice(s) to a line manager (Dept EP).
              </p>
              <select
                id="bulk-manager-select"
                className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select line manager...</option>
                <option value="__unassign__">Unassigned</option>
                {(managerProfilePairs ?? profilePairs).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAssignManagerModal(false)}
                  className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const sel = document.getElementById("bulk-manager-select") as HTMLSelectElement | null;
                    const val = sel?.value?.trim();
                    if (!val) {
                      toast.error("Please select a line manager");
                      return;
                    }
                    const managerId = val === "__unassign__" ? null : val;
                    void bulkAssignManager(managerId);
                  }}
                  disabled={actionLoadingId === "bulk"}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {actionLoadingId === "bulk" ? "Assigning..." : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recently Used Filters */}
      {recentFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent:</span>
          {recentFilters.slice(0, 5).map((f, i) => {
            const parts = [f.search, f.departmentFilter, f.programmeFilter, f.groupFilter];
            if (f.anomalyFilter) parts.push("Anomalies");
            const label = parts.filter(Boolean).slice(0, 3).join(" · ") || "Filters";
            return (
              <button
                key={i}
                onClick={() => applyRecentFilter(f)}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {label || `#${i + 1}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Quick status filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { value: "", label: "All" },
          { value: "pending", label: "My Pending" },
          { value: "ready_for_payment", label: "Ready for Payment" },
          { value: "paid_invoices", label: "Paid" },
          { value: "rejected", label: "Rejected" },
        ] as const).map((pill) => (
          <button
            key={pill.value}
            onClick={() => setGroupFilter(pill.value as "" | DisplayRow["group"] | "pending")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              groupFilter === pill.value
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600"
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className={`rounded-2xl border-2 border-slate-300 bg-slate-100 shadow-lg dark:border-slate-600 dark:bg-slate-800 overflow-hidden ${selectedIds.size > 0 ? "relative z-40" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 p-4 overflow-x-auto md:overflow-visible min-w-0">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices (full-text)..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-[#5034FF] focus:ring-2 focus:ring-[#5034FF]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
            {searchLoading && (
              <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400 cursor-pointer">
            <input type="checkbox" checked={missingInfoFilter} onChange={(e) => setMissingInfoFilter(e.target.checked)} className="rounded border-amber-500 text-amber-600" />
            Missing info
          </label>
          <label className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400 cursor-pointer" title="Unusual amount, future date, or very old date">
            <input type="checkbox" checked={anomalyFilter} onChange={(e) => setAnomalyFilter(e.target.checked)} className="rounded border-amber-500 text-amber-600" />
            Anomalies only
          </label>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value as "" | DisplayRow["group"] | "pending")} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Status</option>
            {groupsForFilter.map((g) => (<option key={g} value={g}>{sectionTitle(g)}</option>))}
          </select>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Department</option>
            {Array.from(new Set(rows.map((r) => r.department))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <select value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Programme</option>
            {Array.from(new Set(rows.map((r) => r.programme))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <select value={producerFilter} onChange={(e) => setProducerFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Producer</option>
            {Array.from(new Set(rows.map((r) => r.producer))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <select value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Payment</option>
            <option value="paid_guest">Paid</option>
            <option value="unpaid_guest">Unpaid</option>
          </select>
          <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Dept EP</option>
            {Array.from(new Set(rows.map((r) => r.lineManager))).filter((v) => v !== "—").sort().map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Tags</option>
            {Array.from(new Set(rows.flatMap((r) => r.tags))).sort().map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="From" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="To" />
          <select value={sortField} onChange={(e) => setSortField(e.target.value as typeof sortField)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option value="">Sort</option>
            <option value="guest">Guest</option>
            <option value="producer">Producer</option>
            <option value="programme">Programme</option>
            <option value="invoiceDate">Date</option>
            <option value="amount">Amount</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
          {(currentRole === "admin" || currentRole === "operations" || currentRole === "finance") && (
            <button
              onClick={() => { setShowImportModal(true); setImportResult(null); setImportFile(null); }}
              className="inline-flex items-center gap-1 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors shadow-sm shadow-indigo-500/25"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
              Import Excel
            </button>
          )}
          <ExportLocaleSelector />
          <button
            onClick={() => void exportToExcel(filtered)}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors shadow-sm shadow-emerald-500/25"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
            Export Excel
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={() => void onBulkDownload()}
              disabled={bulkDownloading}
              className="inline-flex items-center gap-1 rounded-xl bg-[#5034FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#4030dd] disabled:opacity-50 transition-colors shadow-sm shadow-[#5034FF]/25"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3"/></svg>
              {bulkDownloading ? "Downloading..." : `Download Files (${selectedIds.size})`}
            </button>
          )}
          <button
            onClick={() => void exportPdf(filtered)}
            className="inline-flex items-center gap-1 rounded-xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 transition-colors shadow-sm shadow-rose-500/25"
          >
            PDF
          </button>
          <button
            onClick={() => setShowCustomReport(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 transition-colors shadow-sm shadow-violet-500/25"
          >
            Custom Report
          </button>
          <button
            onClick={() => { setCompareId1(""); setCompareId2(""); setShowCompareModal(true); }}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors shadow-sm shadow-indigo-500/25"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>
            Compare
          </button>
          {showSaveFilter ? (
            <div className="flex items-center gap-1">
              <input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Filter name" className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm w-28" onKeyDown={(e) => { if (e.key === "Enter") saveCurrentFilter(); }} />
              <button onClick={saveCurrentFilter} disabled={!filterName.trim()} className="rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">Save</button>
              <button onClick={() => setShowSaveFilter(false)} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowSaveFilter(true)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50" title="Save current filter">
              ★
            </button>
          )}
          {(search || departmentFilter || programmeFilter || groupFilter || missingInfoFilter || anomalyFilter || producerFilter || paymentTypeFilter || managerFilter || tagFilter || dateFrom || dateTo || sortField) && (
            <button
              onClick={() => {
                setSearch(""); setDepartmentFilter(""); setProgrammeFilter(""); setGroupFilter("");
                setMissingInfoFilter(false); setAnomalyFilter(false); setProducerFilter(""); setPaymentTypeFilter(""); setManagerFilter(""); setTagFilter("");
                setDateFrom(""); setDateTo(""); setSortField("");
                clearFilterState();
              }}
              className="rounded-lg bg-gray-100 px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200"
            >
              Clear filters
            </button>
          )}
        </div>
        {(search || departmentFilter || programmeFilter || groupFilter || missingInfoFilter || anomalyFilter || producerFilter || paymentTypeFilter || managerFilter || tagFilter || dateFrom || dateTo || sortField) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-3 py-2">
            <span className="text-xs text-gray-500 mr-1">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                &quot;{search}&quot;
                <button onClick={() => setSearch("")} className="ml-0.5 hover:text-blue-900">✕</button>
              </span>
            )}
            {missingInfoFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Missing info
                <button onClick={() => setMissingInfoFilter(false)} className="ml-0.5 hover:text-amber-900">✕</button>
              </span>
            )}
            {anomalyFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Anomalies only
                <button onClick={() => setAnomalyFilter(false)} className="ml-0.5 hover:text-amber-900">✕</button>
              </span>
            )}
            {groupFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                {sectionTitle(groupFilter)}
                <button onClick={() => setGroupFilter("")} className="ml-0.5 hover:text-purple-900">✕</button>
              </span>
            )}
            {departmentFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                {departmentFilter}
                <button onClick={() => setDepartmentFilter("")} className="ml-0.5 hover:text-green-900">✕</button>
              </span>
            )}
            {programmeFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                {programmeFilter}
                <button onClick={() => setProgrammeFilter("")} className="ml-0.5 hover:text-orange-900">✕</button>
              </span>
            )}
            {producerFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2 py-0.5 text-xs text-pink-700">
                {producerFilter}
                <button onClick={() => setProducerFilter("")} className="ml-0.5 hover:text-pink-900">✕</button>
              </span>
            )}
            {paymentTypeFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
                {paymentTypeFilter === "paid_guest" ? "Paid" : "Unpaid"}
                <button onClick={() => setPaymentTypeFilter("")} className="ml-0.5 hover:text-teal-900">✕</button>
              </span>
            )}
            {managerFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                {managerFilter}
                <button onClick={() => setManagerFilter("")} className="ml-0.5 hover:text-indigo-900">✕</button>
              </span>
            )}
            {tagFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                Tag: {tagFilter}
                <button onClick={() => setTagFilter("")} className="ml-0.5 hover:text-teal-900">✕</button>
              </span>
            )}
            {dateFrom && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                From: {dateFrom}
                <button onClick={() => setDateFrom("")} className="ml-0.5 hover:text-amber-900">✕</button>
              </span>
            )}
            {dateTo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                To: {dateTo}
                <button onClick={() => setDateTo("")} className="ml-0.5 hover:text-amber-900">✕</button>
              </span>
            )}
            {sortField && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                Sort: {sortField} {sortDir === "asc" ? "↑" : "↓"}
                <button onClick={() => setSortField("")} className="ml-0.5 hover:text-gray-900">✕</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearch(""); setDepartmentFilter(""); setProgrammeFilter(""); setGroupFilter("");
                setMissingInfoFilter(false); setProducerFilter(""); setPaymentTypeFilter(""); setManagerFilter(""); setTagFilter("");
                setDateFrom(""); setDateTo(""); setSortField("");
              }}
              className="ml-auto rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className={selectedIds.size > 0 ? "relative z-40" : ""}>
      {filtered.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          title="No invoices match your filters"
          description="Try adjusting your search or filter criteria to see more results."
          action={
            <button
              onClick={() => {
                setSearch("");
                setDepartmentFilter("");
                setProgrammeFilter("");
                setGroupFilter("");
                setMissingInfoFilter(false);
                setAnomalyFilter(false);
                setProducerFilter("");
                setPaymentTypeFilter("");
                setManagerFilter("");
                setTagFilter("");
                setDateFrom("");
                setDateTo("");
                setSortField("");
                clearFilterState();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Clear filters
            </button>
          }
        />
      ) : groups.map((g) => {
        const data = filtered.filter((r) => r.group === g);
        return (
          <section key={g} className="space-y-2">
            <h2 className={`text-base font-bold flex items-center gap-2 ${sectionColor(g)}`}>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current" />
              {sectionTitle(g)} <span className="font-medium text-slate-600 dark:text-slate-400">({data.length})</span>
            </h2>
            <div className="md:hidden">
              <InvoiceMobileCards
                rows={data}
                currentRole={currentRole}
                currentUserId={currentUserId}
                isOperationsRoomMember={isOperationsRoomMember}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
                onToggleAll={onToggleAll}
                canBulkSelect={currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter" || currentRole === "viewer"}
                onManagerApprove={onManagerApprove}
              onRejectInvoice={onRejectInvoice}
              onResubmit={onResubmit}
              onMarkPaid={onMarkPaid}
              onDeleteInvoice={onDeleteInvoice}
              onStartEdit={onStartEdit}
              rejectInlineShakeId={rejectInlineShakeId}
                openPdf={openPdf}
                actionLoadingId={actionLoadingId}
                expandedRowId={expandedRowId}
                onToggleExpand={(id) => void toggleExpandRow(id)}
                timelineData={timelineData}
                filesData={filesData}
                notesData={notesData}
                newNote={newNote}
                onNewNoteChange={setNewNote}
                onAddNote={() => void addNote()}
                detailLoading={detailLoading}
                showPreview={(id, path) => void openPdf(id, path)}
                onDownloadFile={onDownloadFile}
                onAddFile={onAddFile}
                departmentPairs={departmentPairs}
                programPairs={programPairs}
                profilePairs={profilePairs}
                rolesCanDelete={rolesCanDelete}
              />
            </div>
            <div className="hidden md:block">
            <InvoiceTable
              rows={data}
              currentRole={currentRole}
              currentUserId={currentUserId}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onToggleAll={onToggleAll}
              onManagerApprove={onManagerApprove}
              onRejectInvoice={onRejectInvoice}
              onResubmit={onResubmit}
              onMarkPaid={onMarkPaid}
              onDeleteInvoice={onDeleteInvoice}
              onMoveToLineManager={onMoveToLineManager}
              onMoveToArchived={onMoveToArchived}
              onReplaceFile={onReplaceFile}
              onAddFile={onAddFile}
              openPdf={openPdf}
              openPdfInNewTab={openPdfInNewTab}
              onDownloadFile={onDownloadFile}
              onDownloadAllFiles={onDownloadAllFiles}
              onDownloadAllFilesLoading={singleDownloading}
              onGenerateBankTransferForm={onGenerateBankTransferForm}
              onGenerateBankTransferFormLoading={bankFormLoading}
              onStartEdit={onStartEdit}
              actionLoadingId={actionLoadingId}
              visibleColumns={(currentRole === "admin" || currentRole === "manager" || currentRole === "operations" || currentRole === "submitter" || currentRole === "viewer") ? visibleColumns : visibleColumns.filter((c) => c !== "checkbox")}
              expandedRowId={expandedRowId}
              onToggleExpand={(id) => void toggleExpandRow(id)}
              timelineData={timelineData}
              filesData={filesData}
              notesData={notesData}
              newNote={newNote}
              onNewNoteChange={setNewNote}
              onAddNote={() => void addNote()}
              detailLoading={detailLoading}
              duplicates={duplicates}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              departmentPairs={departmentPairs}
              programPairs={programPairs}
              profilePairs={profilePairs}
              managerProfilePairs={managerProfilePairs}
              producerColorsMap={producerColorsMap}
              onSaveTag={saveTag}
              onRemoveTag={removeTag}
              rejectInlineShakeId={rejectInlineShakeId}
              rolesCanDelete={rolesCanDelete}
            />
            </div>
          </section>
        );
      })}
      </div>

      {/* Mobile detail sheet - Timeline, Files, Notes */}
      {expandedRowId && (
        <div
          className="md:hidden fixed inset-0 z-40 flex flex-col bg-white dark:bg-slate-900"
          aria-modal
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Invoice Details</h3>
            <button
              onClick={() => toggleExpandRow(expandedRowId)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-700 dark:text-gray-400 dark:hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {detailLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-500 dark:text-gray-400">
                <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75"/></svg>
                <span>Loading...</span>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Timeline</h4>
                  {timelineData.length === 0 ? (
                    <p className="text-xs text-gray-400">No events yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {timelineData.map((ev) => {
                        const changes = (ev.payload as Record<string, unknown>)?.changes as Record<string, { from: string; to: string }> | undefined;
                        const hasChanges = changes && Object.keys(changes).length > 0;
                        const deptMap = Object.fromEntries(departmentPairs);
                        const progMap = Object.fromEntries(programPairs);
                        const profMap = Object.fromEntries(profilePairs);
                        const resolveName = (field: string, val: string) => {
                          if (!val || val === "—" || val === "Unassigned") return val;
                          if (field === "department_id") return deptMap[val] ?? val;
                          if (field === "program_id") return progMap[val] ?? val;
                          if (field === "manager") return profMap[val] ?? val;
                          return val;
                        };
                        const eventIcon = ev.event_type === "invoice_updated" ? "bg-amber-400" : ev.event_type === "invoice_extracted" ? "bg-cyan-400" : ev.event_type.includes("reject") ? "bg-red-400" : ev.event_type.includes("approv") ? "bg-green-400" : ev.event_type.includes("paid") ? "bg-purple-400" : "bg-blue-400";
                        return (
                          <div key={ev.id} className="flex items-start gap-2 text-xs">
                            <div className={`mt-0.5 h-2 w-2 rounded-full ${eventIcon} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{ev.actor_name}</span>
                              <span className="text-gray-500"> — {ev.event_type.replace(/_/g, " ")}</span>
                              {ev.from_status && ev.to_status && (
                                <span className="text-gray-400"> ({ev.from_status} → {ev.to_status})</span>
                              )}
                              {ev.payload && typeof (ev.payload as Record<string, string>).rejection_reason === "string" && (
                                <span className="text-red-600"> — {(ev.payload as Record<string, string>).rejection_reason}</span>
                              )}
                              {hasChanges && (
                                <div className="mt-1 space-y-0.5 rounded bg-gray-50 border border-gray-200 px-2 py-1.5 dark:bg-gray-800 dark:border-gray-700">
                                  {Object.entries(changes!).map(([field, { from, to }]) => (
                                    <div key={field} className="flex items-center gap-1 text-[11px]">
                                      <span className="font-medium text-gray-600 dark:text-gray-400 capitalize">{field.replace(/_/g, " ")}:</span>
                                      <span className="text-red-500 line-through">{resolveName(field, from) || "—"}</span>
                                      <span className="text-gray-400">→</span>
                                      <span className="text-green-600 font-medium">{resolveName(field, to) || "—"}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-gray-400 mt-0.5">{new Date(ev.created_at).toLocaleString("en-GB")}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Files</h4>
                  {filesData.length === 0 ? (
                    <p className="text-xs text-gray-400">No files.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {filesData.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => void openPdf(expandedRowId, f.storage_path)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50"
                        >
                          <svg className="h-4 w-4 flex-shrink-0 text-sky-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2zm8-14l4 4h-4V4z"/></svg>
                          <span className="truncate max-w-[180px]">{f.file_name}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => void onDownloadAllFiles(expandedRowId)}
                        disabled={singleDownloading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-800/50 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                        {singleDownloading ? "Downloading..." : "Download all"}
                      </button>
                    </div>
                  )}
                  {onAddFile && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                      Add file
                      <input type="file" className="hidden" accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAddFile(expandedRowId, f); e.target.value = ""; }} />
                    </label>
                  )}
                  {onGenerateBankTransferForm && expandedRowId && (() => {
                    const r = rows.find((x) => x.id === expandedRowId);
                    const isInternational = r && r.iban !== "—" && r.swiftBic !== "—";
                    return isInternational ? (
                      <button
                        onClick={() => void onGenerateBankTransferForm(expandedRowId)}
                        disabled={bankFormLoading}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-800/50 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        {bankFormLoading ? "Generating..." : "Bank transfer form"}
                      </button>
                    ) : null;
                  })()}
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Notes</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                    {notesData.length === 0 ? (
                      <p className="text-xs text-gray-400">No notes yet.</p>
                    ) : (
                      notesData.map((n) => (
                        <div key={n.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{n.author_name}</span>
                            <span className="text-gray-400">{new Date(n.created_at).toLocaleString("en-GB")}</span>
                          </div>
                          <p className="mt-1 text-gray-600 dark:text-gray-400">{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      onKeyDown={(e) => { if (e.key === "Enter") void addNote(); }}
                    />
                    <button
                      onClick={() => void addNote()}
                      disabled={!newNote.trim()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !importing && setShowImportModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Import Guest Invoices</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Import paid and no payment needed invoices from Excel. Invoice files can be added manually later via the Edit button.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Row 1: title, Row 2: section (Paid Invoices / No Payment Needed), Row 3: headers, Row 4+: data.
            </p>
            <button
              type="button"
              onClick={async () => {
                const XLSX = await import("xlsx");
                const headers = ["Guest Name", "Subitems", "Title", "Producer", "Department", "Programme Name", "Topic", "Invoice Date", "TX Date", "2. TX Date", "3. TX Date", "Invoice File", "Account Name", "Amount", "INV Number", "Sort Code", "Account Number", "Dept EP", "Payment Date"];
                const data = [
                  ["Guest Invoice Submission", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
                  ["Paid Invoices", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
                  headers,
                  ["Example Guest", "", "Title", "Producer", "Programmes", "Bigger Than Football", "Topic", "2025-01-15", "2025-01-15", "", "", "", "Account Name", "1000", "INV-001", "600923", "12345678", "", "2025-01-31"],
                  ["No Payment Needed", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
                  headers,
                  ["Example Unpaid", "", "Title", "Producer", "Programmes", "Bigger Than Football", "Topic", "2025-01-15", "2025-01-15", "", "", "", "", "0", "INV-002", "", "", "", ""],
                ];
                const ws = XLSX.utils.aoa_to_sheet(data);
                ws["!cols"] = [
                  { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 12 },
                  { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 10 },
                  { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
                ];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "guest invoice submission");
                XLSX.writeFile(wb, "guest-invoices-import-template.xlsx");
              }}
              className="mt-2 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Download template
            </button>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Excel file (.xlsx, .xls)</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); }}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            {importResult && (
              <div className={`mt-4 rounded-lg border p-3 text-sm ${importResult.errors?.length ? "border-amber-300 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20" : "border-emerald-300 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-900/20"}`}>
                <p className="font-medium text-emerald-800 dark:text-emerald-200">{importResult.created} invoice(s) imported.</p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-amber-800 dark:text-amber-200">
                    {importResult.errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                    {importResult.errors.length > 10 && <li>...and {importResult.errors.length - 10} more</li>}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => !importing && setShowImportModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                {importResult ? "Close" : "Cancel"}
              </button>
              <button
                onClick={async () => {
                  if (!importFile || importing) return;
                  setImporting(true);
                  setImportResult(null);
                  try {
                    const fd = new FormData();
                    fd.append("file", importFile);
                    const res = await fetch("/api/invoices/import-excel", { method: "POST", body: fd });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setImportResult({ created: data.created ?? 0, errors: data.errors });
                      if ((data.created ?? 0) > 0) {
                        toast.success(`${data.created} invoice(s) imported`);
                        setTimeout(() => window.location.reload(), 1500);
                      }
                    } else {
                      toast.error(getApiErrorMessage(data as { error?: string } | null));
                    }
                  } catch {
                    toast.error("Import failed");
                  } finally {
                    setImporting(false);
                  }
                }}
                disabled={!importFile || importing}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalRow && (
        <EditGuestInvoiceModal
          row={editModalRow}
          departmentPairs={departmentPairs}
          programPairs={programPairs}
          profilePairs={profilePairs}
          managerProfilePairs={managerProfilePairs}
          onSave={handleEditModalSave}
          onClose={() => setEditModalRow(null)}
          saving={actionLoadingId === editModalRow.id}
          onReplaceFile={onReplaceFile}
          openPdf={openPdf}
        />
      )}

      {rejectModalId && (() => {
        const rejectRow = rowsWithAnomalies.find((r) => r.id === rejectModalId);
        const suggestedReason =
          rejectRow?.missingFields?.length
            ? `Please provide: ${rejectRow.missingFields.join(", ")}.`
            : rejectRow?.hasMissingInfo
              ? "Please provide the missing information before resubmitting."
              : null;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Reject invoice">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 dark:border dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Reject Invoice</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Please enter the reason for rejection:</p>
            {suggestedReason && (
              <button
                type="button"
                onClick={() => setRejectReason(suggestedReason)}
                className="mt-2 w-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-sm text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50"
              >
                Use suggestion: &quot;{suggestedReason}&quot;
              </button>
            )}
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              autoFocus
              aria-label="Rejection reason"
              placeholder="Rejection reason..."
              className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setRejectModalId(null); setRejectReason(""); }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                aria-label="Cancel rejection"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmReject()}
                disabled={!rejectReason.trim() || actionLoadingId === rejectModalId}
                className={`rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 ${rejectButtonShaking ? "animate-shake-reject" : ""}`}
              >
                {actionLoadingId === rejectModalId ? "Rejecting..." : "✗ Reject"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {(previewUrl || previewHtml || previewLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={closePreview}
        >
          <div
            className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 truncate dark:text-white">{previewName || (previewLoading ? "Loading..." : "")}</h3>
              <div className="flex items-center gap-2">
                {previewDownloadUrl && (
                  <button
                    onClick={() => void downloadFile(previewDownloadUrl, previewName || "invoice")}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors shadow-sm"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    Download
                  </button>
                )}
                <button
                  onClick={closePreview}
                  aria-label="Close preview"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex items-center justify-center">
              {previewLoading && !previewUrl && !previewHtml && (
                <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
                  <svg className="h-12 w-12 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" /></svg>
                  <span className="text-sm">Loading file...</span>
                </div>
              )}
              {previewUrl && !previewLoading && <iframe src={previewUrl} className="h-full w-full border-0" title="File preview" />}
              {previewHtml && !previewLoading && <div className="h-full w-full overflow-auto p-6 prose prose-sm max-w-none dark:prose-invert [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold dark:[&_td]:border-gray-600 dark:[&_th]:border-gray-600 dark:[&_th]:bg-gray-800" dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }} />}
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {compareIds.length === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCompareIds([])}>
          <div className="relative flex h-[85vh] w-[95vw] max-w-6xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Compare Invoices</h3>
              <button onClick={() => setCompareIds([])} className="rounded-lg px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">✕ Close</button>
            </div>
            <div className="flex flex-1 overflow-auto">
              {compareIds.map((id) => {
                const row = rows.find((r) => r.id === id);
                if (!row) return null;
                const entries = [
                  ["Guest", row.guest], ["Producer", row.producer], ["Department", row.department], ["Programme", row.programme],
                  ["Amount", row.amount], ["INV#", row.invNumber], ["Status", row.status], ["Date", row.invoiceDate],
                  ["Account", row.accountName], ["Payment", row.paymentType], ["Topic", row.topic],
                ];
                return (
                  <div key={id} className="flex-1 min-w-0 border-r last:border-r-0 border-gray-200 dark:border-gray-700 p-4 overflow-auto">
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-3 truncate">{row.invNumber}</h4>
                    <table className="w-full text-sm">
                      <tbody>
                        {entries.map(([k, v]) => (
                          <tr key={k} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-1.5 text-gray-500 dark:text-gray-400 w-24">{k}</td>
                            <td className="py-1.5 text-gray-900 dark:text-white break-words">{v || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Report Modal */}
      {showCustomReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCustomReport(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Custom Report – Select Fields</h3>
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {[
                { key: "guest", label: "Guest Name" },
                { key: "producer", label: "Producer" },
                { key: "department", label: "Department" },
                { key: "programme", label: "Programme" },
                { key: "amount", label: "Amount" },
                { key: "invoiceDate", label: "Invoice Date" },
                { key: "accountName", label: "Account Name" },
                { key: "invNumber", label: "INV Number" },
                { key: "status", label: "Status" },
                { key: "paymentType", label: "Payment Type" },
                { key: "topic", label: "Topic" },
                { key: "title", label: "Title" },
                { key: "tx1", label: "TX Date" },
                { key: "lineManager", label: "Dept EP" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customReportFields[key] ?? false}
                    onChange={(e) => setCustomReportFields((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowCustomReport(false)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
              <button onClick={() => void exportCustomReport(filtered)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Export Excel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
