/**
 * Company & contact settings from app_settings.
 * Used by bank transfer form, emails, invoices, invitations.
 * Editable in Setup → Company & contacts.
 */

export type CompanySettings = {
  company_name: string;
  company_address: string;
  signature_name: string;
  studio_address: string;
  email_operations: string;
  email_finance: string;
  email_bank_transfer: string;
  bank_account_gbp: string;
  bank_account_eur: string;
  bank_account_usd: string;
  app_name: string;
  invitation_subject_prefix: string;
  invitation_body_intro: string;
  invitation_broadcast_channel: string;
  invitation_studio_intro: string;
  booking_form_title: string;
  booking_form_footer: string;
  ics_prodid: string;
  ics_summary_prefix: string;
  ics_description_broadcast: string;
  invoice_pdf_payee_address: string;
};

const DEFAULTS: CompanySettings = {
  company_name: "TRT WORLD (UK)",
  company_address: "200 Grays Inn Road, London, WC1X 8XZ",
  signature_name: "Hasan ESEN",
  studio_address: "TRT World London Studios 200 Gray's Inn Rd, London WC1X 8XZ",
  email_operations: "london.operations@trtworld.com",
  email_finance: "london.finance@trtworld.com",
  email_bank_transfer: "london.finance@trtworld.com",
  bank_account_gbp: "0611-405810-001",
  bank_account_eur: "0611-405810-009",
  bank_account_usd: "0611-405810-002",
  app_name: "TRT UK Operations Platform",
  invitation_subject_prefix: "TRT World – Invitation to the program:",
  invitation_body_intro: "I am writing to invite you to participate in <strong>{program}</strong>, which will be broadcast on {channel} and will focus on {topic}.",
  invitation_broadcast_channel: "TRT World",
  invitation_studio_intro: "The recording will take place in our studio. The address is:",
  booking_form_title: "TRT WORLD LONDON — FREELANCE SERVICES BOOKING FORM",
  booking_form_footer: "This booking form confirms the scope of services, delivery dates and fees as agreed between the Client and the Service Provider under the contract for services.",
  ics_prodid: "-//TRT World//Guest Invitation//EN",
  ics_summary_prefix: "TRT World:",
  ics_description_broadcast: "Broadcast on TRT World",
  invoice_pdf_payee_address: "TRT WORLD UK\n200 Grays Inn Road\nHolborn, London\nWC1X 8XZ",
};

const KEYS = [
  "company_name",
  "company_address",
  "signature_name",
  "studio_address",
  "email_operations",
  "email_finance",
  "email_bank_transfer",
  "bank_account_gbp",
  "bank_account_eur",
  "bank_account_usd",
  "app_name",
  "invitation_subject_prefix",
  "invitation_body_intro",
  "invitation_broadcast_channel",
  "invitation_studio_intro",
  "booking_form_title",
  "booking_form_footer",
  "ics_prodid",
  "ics_summary_prefix",
  "ics_description_broadcast",
  "invoice_pdf_payee_address",
] as const;

function unwrapJsonb(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

export function parseCompanySettings(rows: { key: string; value: unknown }[] | null): CompanySettings {
  const map = new Map<string, string>();
  for (const r of rows ?? []) {
    map.set(r.key, unwrapJsonb(r.value));
  }
  const out = { ...DEFAULTS };
  for (const k of KEYS) {
    const v = map.get(k);
    if (v?.trim()) (out as Record<string, string>)[k] = v.trim();
  }
  return out;
}

export function getBankAccountByCurrency(
  settings: CompanySettings,
  currency: "USD" | "EUR" | "GBP"
): string {
  const key = `bank_account_${currency.toLowerCase()}` as keyof CompanySettings;
  const v = (settings as Record<string, string>)[key];
  return (v?.trim() || "") || DEFAULTS[key];
}

/** Parse payee address (newline-separated) into lines for PDF. */
export function getPayeeAddressLines(settings: CompanySettings): string[] {
  const raw = settings.invoice_pdf_payee_address?.trim();
  if (!raw) return [];
  return raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Server-side: fetch company settings from DB. Use in API routes. */
export async function getCompanySettingsAsync(): Promise<CompanySettings> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", KEYS);
  return parseCompanySettings(data ?? []);
}
