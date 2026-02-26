export const ALL_COLUMNS = [
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
  { key: "invNumber", label: "INV Number" },
  { key: "sortCode", label: "Sort Code" },
  { key: "accountNumber", label: "Account Number" },
  { key: "lineManager", label: "Dept EP" },
  { key: "paymentDate", label: "Payment Date" },
  { key: "actions", label: "Actions" },
];

export const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.map((c) => c.key);

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch { /* */ }
  return fallback;
}

export const RECENT_FILTERS_KEY = "invoice_recent_filters";
export const RECENT_MAX = 5;

export function pushRecentFilter(filters: Record<string, unknown>) {
  try {
    const recent = loadFromStorage<Record<string, unknown>[]>(RECENT_FILTERS_KEY, []);
    const key = JSON.stringify(filters);
    const filtered = recent.filter((r) => JSON.stringify(r) !== key);
    const next = [filters, ...filtered].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_FILTERS_KEY, JSON.stringify(next));
  } catch { /* */ }
}

export function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export function parseServiceDescription(desc: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!desc) return result;
  for (const line of desc.split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim().toLowerCase();
      result[key] = line.slice(idx + 1).trim();
    }
  }
  return result;
}

export function fromAliases(meta: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = meta[k];
    if (v) return v;
  }
  return "";
}

export function normalizeInvoiceNumber(num: string | null | undefined): string {
  if (!num) return "";
  return num.replace(/^#+/, "").trim();
}

export function calcGroup(status: string, paymentType: string) {
  if (status === "rejected") return "rejected" as const;
  if (status === "paid") return "paid_invoices" as const;
  if (status === "ready_for_payment") return "ready_for_payment" as const;
  if (paymentType === "no_payment") return "no_payment_needed" as const;
  return "pending_line_manager" as const;
}

export function sectionTitle(group: string): string {
  const map: Record<string, string> = {
    pending_line_manager: "Pending Dept EP",
    rejected: "Rejected",
    ready_for_payment: "Ready for Payment",
    paid_invoices: "Paid Invoices",
    no_payment_needed: "No Payment Needed",
  };
  return map[group] ?? group;
}

export const GUEST_MOVE_GROUPS = [
  { key: "pending_line_manager", label: "Pending Dept EP" },
  { key: "ready_for_payment", label: "Ready for Payment" },
  { key: "paid_invoices", label: "Paid" },
  { key: "no_payment_needed", label: "No Payment Needed" },
  { key: "rejected", label: "Rejected" },
];
