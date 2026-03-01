/**
 * Generate filled Word (docx) bank transfer forms for international payments.
 * Uses Türkiye İş Bankası London Branch template.
 * Template: src/templates/turkiye-is-bankasi-transfer-template.docx
 */
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import path from "path";
import fs from "fs";

const DEFAULT_SIGNATURE = "Hasan ESEN";
const DEFAULT_ORDERING = { name: "TRT WORLD (UK)", address: "200 Grays Inn Road, London, WC1X 8XZ" };
const DEFAULT_ACCOUNTS: Record<"USD" | "EUR" | "GBP", string> = {
  USD: "0611-405810-002",
  EUR: "0611-405810-009",
  GBP: "0611-405810-001",
};

export type BankTransferFormData = {
  date: string;
  sender_account_number: string;
  beneficiary_name: string;
  iban: string;
  swift_bic: string;
  bank_name: string;
  bank_address: string;
  beneficiary_address: string;
  amount: string;
  currency: "USD" | "EUR" | "GBP";
  message: string;
  bank_sort_code: string;
  /** When INCOMPLETE, show warning at top. Empty when READY. */
  warning_line: string;
  /** Template placeholders (v2 layout) */
  charges?: string;
  daytime_phone?: string;
  /** Legacy / compatibility */
  intermediaryBankName?: string;
  intermediarySwift?: string;
  /** Overrides from Setup (optional). When not set, uses built-in defaults. */
  _companyName?: string;
  _companyAddress?: string;
  _signatureName?: string;
  _senderAccount?: string;
};

const TEMPLATE_PATH = path.join(process.cwd(), "src", "templates", "turkiye-is-bankasi-transfer-template.docx");

function loadTemplateBuffer(): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `Bank transfer template not found: ${TEMPLATE_PATH}. Add turkiye-is-bankasi-transfer-template.docx to src/templates/`
    );
  }
  return fs.readFileSync(TEMPLATE_PATH);
}

/**
 * Fill the bank transfer form with invoice data.
 * Placeholders: date, sender_account_number, beneficiary_name, iban, swift_bic,
 * bank_name, bank_address, beneficiary_address, amount, currency, message,
 * bank_sort_code, warning_line.
 * Returns the filled docx as a Buffer.
 */
export function generateBankTransferForm(data: BankTransferFormData): Buffer {
  const templateBuffer = loadTemplateBuffer();
  const zip = new PizZip(templateBuffer);
  const companyName = data._companyName?.trim() || DEFAULT_ORDERING.name;
  const companyAddress = data._companyAddress?.trim() || DEFAULT_ORDERING.address;
  const signature = data._signatureName?.trim() || DEFAULT_SIGNATURE;
  const senderAccount = data._senderAccount ?? data.sender_account_number;

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render({
    date: data.date,
    sender_account_number: senderAccount,
    ordering_customer_name: companyName,
    ordering_customer_address: companyAddress,
    ordering_customer_account: senderAccount,
    beneficiary_name: data.beneficiary_name,
    beneficiary_address: data.beneficiary_address || "",
    iban: data.iban,
    swift_bic: data.swift_bic,
    bank_name: data.bank_name || "",
    bank_address: data.bank_address || "",
    amount: data.amount,
    currency: data.currency,
    message: data.message || "",
    bank_sort_code: data.bank_sort_code || "",
    warning_line: data.warning_line || "",
    charges: data.charges ?? "",
    daytime_phone: data.daytime_phone ?? "",
    intermediary_bank_name: data.intermediaryBankName || "",
    intermediary_swift: data.intermediarySwift || "",
    signature,
  });

  return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));
}

/** For backwards compatibility. Prefer passing account via data._senderAccount from company settings. */
export const ACCOUNT_BY_CURRENCY = DEFAULT_ACCOUNTS;
