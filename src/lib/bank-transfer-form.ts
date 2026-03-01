/**
 * Generate filled Word (docx) bank transfer forms for international payments.
 * Uses Türkiye İş Bankası London Branch template.
 * Template: src/templates/turkiye-is-bankasi-transfer-template.docx
 */
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import path from "path";
import fs from "fs";

const SIGNATURE_NAME = "Hasan ESEN";

/** TRT ordering customer details. Account number varies by currency. */
const ORDERING_CUSTOMER_BASE = {
  name: "TRT WORLD (UK)",
  address: "200 Grays Inn Road, London, WC1X 8XZ",
};

const ACCOUNT_BY_CURRENCY: Record<"USD" | "EUR" | "GBP", string> = {
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

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  doc.render({
    date: data.date,
    sender_account_number: data.sender_account_number,
    ordering_customer_name: ORDERING_CUSTOMER_BASE.name,
    ordering_customer_address: ORDERING_CUSTOMER_BASE.address,
    ordering_customer_account: data.sender_account_number,
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
    signature: SIGNATURE_NAME,
  });

  return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));
}

export { ACCOUNT_BY_CURRENCY };
