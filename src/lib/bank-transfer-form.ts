/**
 * Generate filled Word (docx) bank transfer forms for international payments.
 * Uses Türkiye İş Bankası template. Fills beneficiary details and adds "Hasan ESEN" to signature fields.
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
  beneficiaryName: string;
  iban: string;
  currency: "USD" | "EUR" | "GBP";
  bankSortCode: string;
  swiftBic: string;
  bankName: string;
  bankAddress: string;
  amount: string;
  message: string;
  intermediaryBankName?: string;
  intermediarySwift?: string;
};

function getTemplatePath(currency: "USD" | "EUR" | "GBP"): string {
  return `bank-transfer-templates/${currency}.docx`;
}

/**
 * Load template from public folder. In Next.js, public files are served from project root.
 * For server-side we need to read from the filesystem.
 */
function loadTemplateBuffer(currency: "USD" | "EUR" | "GBP"): Buffer {
  const templatePath = path.join(process.cwd(), "public", getTemplatePath(currency));
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Bank transfer template not found: ${templatePath}. Add ${currency}.docx to public/bank-transfer-templates/`);
  }
  return fs.readFileSync(templatePath);
}

/**
 * Fill the bank transfer form with invoice data.
 * Returns the filled docx as a Buffer.
 */
export function generateBankTransferForm(
  data: BankTransferFormData,
  currency: "USD" | "EUR" | "GBP"
): Buffer {
  const templateBuffer = loadTemplateBuffer(currency);
  const zip = new PizZip(templateBuffer);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });

  const accountNumber = ACCOUNT_BY_CURRENCY[currency];
  doc.render({
    date: data.date,
    ordering_customer_name: ORDERING_CUSTOMER_BASE.name,
    ordering_customer_address: ORDERING_CUSTOMER_BASE.address,
    ordering_customer_account: accountNumber,
    beneficiary_name: data.beneficiaryName,
    iban: data.iban,
    currency: data.currency,
    bank_sort_code: data.bankSortCode || "",
    swift_bic: data.swiftBic,
    bank_name: data.bankName || "",
    bank_address: data.bankAddress || "",
    amount: data.amount,
    message: data.message || "",
    intermediary_bank_name: data.intermediaryBankName || "",
    intermediary_swift: data.intermediarySwift || "",
    signature: SIGNATURE_NAME,
  });

  return Buffer.from(doc.getZip().generate({ type: "nodebuffer" }));
}
