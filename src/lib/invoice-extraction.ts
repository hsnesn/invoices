import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import stringSimilarity from "string-similarity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuditEvent } from "@/lib/audit";
import { normalizeSortCode, amountsConsistent } from "@/lib/validation";

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "doc", "xlsx", "xls"] as const;
type SupportedExt = (typeof SUPPORTED_EXTENSIONS)[number];

function getFileExtension(path: string): SupportedExt | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext && (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) return ext as SupportedExt;
  return null;
}

async function extractTextFromBuffer(buffer: Buffer, ext: SupportedExt): Promise<string> {
  switch (ext) {
    case "pdf": {
      const data = await pdfParse(buffer);
      return (data.text ?? "").slice(0, 20000);
    }
    case "docx":
    case "doc": {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value ?? "").slice(0, 20000);
    }
    case "xlsx":
    case "xls": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const lines: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        lines.push(`--- ${sheetName} ---`, csv);
      }
      return lines.join("\n").slice(0, 20000);
    }
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function looksLikeDate(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const v = s.trim();
  return /^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}$/.test(v) || /^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{1,4}$/.test(v) || /^\d{6,8}$/.test(v);
}

function looksLikeName(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  return /[A-Za-z]{2,}/.test(s.trim());
}

function looksLikeLocation(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const v = s.trim();
  if (/^(london|uk|united\s*kingdom|england|manchester|birmingham|leeds|glasgow|edinburgh|coventry|enfield)(\s+(uk|uk\.?))?$/i.test(v)) return true;
  if (/^[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}$/i.test(v)) return true; // UK postcode
  if (/^(road|street|avenue|drive|lane|place|way)\s*$/i.test(v)) return true;
  return false;
}

function looksLikePersonName(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const v = s.trim();
  if (/\b(ltd|inc|llc|co\.?|limited|plc)\b/i.test(v)) return false; // has company suffix
  const words = v.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Z][a-z]+$/.test(w) || /^[A-Z]{2,}$/.test(w)); // each word capitalized
}

const BENEFICIARY_LABEL_PATTERNS = [
  /^(appearance|invoice|payment|submission|transaction|due|service|delivery|effective)\s+date$/i,
  /^date\s+(of|for)\b/i,
  /^(invoice|payment|reference)\s+(number|no|#)$/i,
  /^sort\s*code$/i,
  /^account\s*(number|no)?$/i,
  /^account\s+holder\s+name$/i,
  /^name\s+on\s+account$/i,
  /^beneficiary$/i,
  /^payee$/i,
  /^amount$/i,
  /^total$/i,
  /^vat$/i,
  /^net$/i,
  /^gross$/i,
  /^currency$/i,
  /^description$/i,
  /^notes?$/i,
  /^remarks?$/i,
  /\s+date$/i,
  /\s+number$/i,
  /\s+code$/i,
];

function looksLikeFieldLabel(s: string | null | undefined): boolean {
  if (!s?.trim()) return false;
  const v = s.trim();
  if (v.length < 3 || v.length > 50) return false;
  return BENEFICIARY_LABEL_PATTERNS.some((p) => p.test(v));
}

function stripAddressFromName(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const v = s.trim();
  const first = v.split(/[,;\n]/)[0]?.trim();
  if (!first || first.length > 100) return v;
  return first;
}

function stripInternalRefs(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const v = s.trim().replace(/\bTRT\s*World\b/gi, "").replace(/\bTRTWORLD\b/gi, "").replace(/\bTRT\s*WORLD\b/gi, "").replace(/\bTRT\b/g, "").trim();
  return v.length > 0 ? v : null;
}

function parseNumberLike(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[, ]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function regexExtractFromText(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const full = lines.join("\n");
  const lineValue = (patterns: RegExp[]): string | null => {
    for (const p of patterns) {
      const m = full.match(p);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return null;
  };

  const invoiceNumber =
    lineValue([
      /(?:invoice\s*(?:number|no|#)\s*[:\-.]?\s*)([A-Z0-9\-\/]+)/i,
      /(?:inv(?:oice)?\s*#\s*[:\-.]?\s*)([A-Z0-9\-\/]+)/i,
      /(?:reference|ref)\s*[:\-.]?\s*([A-Z0-9\-\/]{4,})/i,
    ]) ?? null;
  const sortCodeRaw =
    lineValue([
      /(?:sort\s*\/\s*branch\s*code|sort\s*code)\s*[:\-]?\s*(\d{6})/i,
      /(?:sort\s*code)\s*[:\-.]?\s*(\d{2}[- ]?\d{2}[- ]?\d{2})/i,
    ]) ?? null;
  const accountNumber =
    lineValue([
      /(?:account\s*(?:number|no|#)?)\s*[:\-.]?\s*([0-9 ]{6,20})/i,
      /(?:account\s*no\s*[:\-]\s*)(\d{8})\b/i,
      /(?:bank\s+detail|account\s+no|account\s+holder)[\s\S]*?(\d{8})\b/i,
    ])?.replace(/\s+/g, "") ?? null;
  const beneficiaryFromLabel = lineValue([
    /(?:beneficiary|payee|account\s*(?:name|holder)|name\s+on\s+account)\s*[:\-]?\s*([A-Za-z0-9 '&.,-]{2,120})/i,
  ]);
  const companyFromLabel = lineValue([
    /(?:company\s+name|business\s+name|trading\s+as)\s*[:\-]?\s*([A-Za-z0-9 '&.,-]{2,120})/i,
    /(?:bank\s+name)[:\-]?\s*[^:]+-\s*([A-Za-z0-9 '&.,-]+(?:Ltd|Inc|LLC)\.?)/i,
  ]);
  const companyFromDomain = full.match(/([a-z0-9]+)(?:\.co\.uk|\.com|\.net|\.org)/i)?.[1];
  const companyFromDomainName = companyFromDomain ? companyFromDomain.charAt(0).toUpperCase() + companyFromDomain.slice(1).toLowerCase() : null;
  const currency =
    full.match(/\b(GBP|EUR|USD|TRY)\b/i)?.[1]?.toUpperCase() ??
    (full.includes("£") ? "GBP" : null);
  const grossPatterns = [
    /(?:grand\s*total|total\s*amount|amount\s*due|balance\s*due|invoice\s*total|total\s*payable|amount\s*payable|payment\s*due|final\s*(?:total|amount)|amount\s*to\s*pay|invoice\s*value|total\s*due)\s*[:\-]?\s*[£$€]?\s*([0-9][0-9,]*(?:\.\d{2})?)/i,
    /(?:^|\s)(?:total|gross|sum)\s*[:\-]?\s*[£$€]?\s*([0-9][0-9,]*(?:\.\d{2})?)/i,
    /(?:balance\s*due|amount\s*due)\s*[:\-]?\s*([0-9][0-9,]*(?:\.\d{2})?)/i,
  ];
  let grossRaw = lineValue(grossPatterns);
  if (!grossRaw) {
    const amountRegex = /[£$€]\s*([0-9][0-9,]*(?:\.[0-9]{2})?)|([0-9][0-9,]*(?:\.[0-9]{2})?)\s*[£$€]?/g;
    const allAmounts: number[] = [];
    let m;
    while ((m = amountRegex.exec(full)) !== null) {
      const s = (m[1] || m[2])?.replace(/,/g, "");
      const n = s ? parseNumberLike(s) : null;
      if (n != null && n > 0 && n < 10000000) allAmounts.push(n);
    }
    grossRaw = allAmounts.length > 0 ? String(Math.max(...allAmounts)) : null;
  }
  if (!grossRaw) grossRaw = lineValue([/[£$€]\s*([0-9][0-9,]*(?:\.\d{2})?)/]);
  const netRaw =
    lineValue([/(?:net|subtotal|sub\s*total)\s*[:\-]?\s*[£$€]?\s*([0-9][0-9,]*(?:\.\d{2})?)/i]) ?? null;
  const vatRaw =
    lineValue([/(?:vat|tax)\s*[:\-]?\s*[£$€]?\s*([0-9][0-9,]*(?:\.\d{2})?)/i]) ?? null;
  const date =
    full.match(/\b(20\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2})\b/)?.[1]?.replace(/[/.]/g, "-") ??
    null;
  const dueDate =
    lineValue([
      /(?:due\s*date|payment\s*due|date\s*due)\s*[:\-.]?\s*(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/i,
      /(?:due|payable\s*by)\s*[:\-.]?\s*(\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}|\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2})/i,
    ])?.replace(/[/.]/g, "-") ?? null;

  let beneficiary: string | null = beneficiaryFromLabel ?? null;
  for (const line of lines) {
    if (beneficiary) break;
    if (/invoice|vat|tax|subtotal|total|amount|sort|account|date/i.test(line)) continue;
    if (looksLikeLocation(line)) continue;
    if (/^(ltd|inc|llc)\.?$/i.test(line)) continue; // skip suffix-only lines
    if (/^[A-Za-z][A-Za-z0-9 '&.,-]{2,80}$/.test(line)) {
      beneficiary = line;
      break;
    }
  }
  if (!beneficiary && companyFromDomainName) beneficiary = companyFromDomainName;

  let rawCompany = companyFromLabel && /[A-Za-z]{2,}/.test(companyFromLabel) && !/^\d+$/.test(companyFromLabel.replace(/\s/g, "")) && !looksLikeLocation(companyFromLabel) ? companyFromLabel : null;
  if (!rawCompany && companyFromDomainName) rawCompany = companyFromDomainName;

  // Contact info: phone and email from document
  let phone =
    lineValue([
      /(?:phone|tel|mobile|mob|telephone)\s*[:\-.]?\s*([+\d\s\-()]{10,25})/i,
      /(\+44\s*\d{2,4}\s*\d{3,4}\s*\d{3,4})/,
      /(0\d{2,4}\s*\d{3,4}\s*\d{3,4})/,
    ])?.replace(/\s+/g, " ").trim() ?? null;
  // Exclude 8-digit numbers (likely account numbers, not phones)
  if (phone && /^\d{8}$/.test(phone.replace(/\D/g, ""))) phone = null;
  const email =
    lineValue([
      /(?:email|e-?mail)\s*[:\-.]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    ]) ?? null;

  let dueDateNorm: string | null = null;
  if (dueDate) {
    const m = dueDate.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (m) dueDateNorm = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) dueDateNorm = dueDate;
  }

  return {
    beneficiary_name: stripInternalRefs(beneficiary),
    company_name: stripInternalRefs(rawCompany),
    account_number: accountNumber,
    sort_code: sortCodeRaw ? normalizeSortCode(sortCodeRaw) ?? sortCodeRaw : null,
    invoice_number: stripInternalRefs(invoiceNumber),
    invoice_date: date,
    due_date: dueDateNorm || dueDate,
    net_amount: parseNumberLike(netRaw),
    vat_amount: parseNumberLike(vatRaw),
    gross_amount: parseNumberLike(grossRaw),
    currency,
    guest_phone: phone && phone.length >= 10 ? phone : null,
    guest_email: email && !/trt|trtworld/i.test(email) ? email : null,
  };
}

async function fetchFileBuffer(storagePath: string): Promise<Buffer> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("invoices").download(storagePath);
  if (error || !data) throw new Error("Failed to fetch file");
  return Buffer.from(await data.arrayBuffer());
}

function normalizeForMatch(s: string | null | undefined): string {
  if (!s?.trim()) return "";
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

type ContractorTemplate = {
  name: string;
  name_aliases?: string[] | null;
  account_number?: string | null;
  sort_code?: string | null;
  beneficiary_name?: string | null;
  company_name?: string | null;
};

const SIMILARITY_THRESHOLD = 0.72;

function findMatchingTemplate(
  templates: ContractorTemplate[],
  namesToMatch: (string | null | undefined)[],
  documentText?: string
): ContractorTemplate | null {
  const normalized = namesToMatch.filter(Boolean).map((n) => normalizeForMatch(n!));
  const docNorm = documentText ? normalizeForMatch(documentText) : "";
  for (const t of templates) {
    const templateNames = [t.name, ...(t.name_aliases ?? [])].filter(Boolean);
    for (const tn of templateNames) {
      const tnNorm = normalizeForMatch(tn);
      if (!tnNorm || tnNorm.length < 3) continue;
      for (const n of normalized) {
        if (n && (n.includes(tnNorm) || tnNorm.includes(n))) return t;
      }
      if (docNorm && docNorm.includes(tnNorm)) return t;
    }
  }
  return null;
}

function findMatchingTemplateBySimilarity(
  templates: ContractorTemplate[],
  documentText: string
): ContractorTemplate | null {
  const lines = documentText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const candidates: string[] = [];
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8 && /[A-Za-z]{2,}/.test(line) && line.length <= 80) {
      candidates.push(line);
    }
  }
  const full = documentText;
  const labelRegex = /(?:beneficiary|payee|account\s*holder|name\s+on\s+account|company\s+name|contractor)\s*[:\-]?\s*([A-Za-z0-9 '&.,-]{2,80})/gi;
  let labelM;
  while ((labelM = labelRegex.exec(full)) !== null) {
    const val = labelM[1]?.trim();
    if (val && val.length >= 4) candidates.push(val);
  }
  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter((c) => {
    const k = normalizeForMatch(c);
    if (seen.has(k) || k.length < 4) return false;
    seen.add(k);
    return true;
  });

  let bestTemplate: ContractorTemplate | null = null;
  let bestScore = SIMILARITY_THRESHOLD;

  for (const t of templates) {
    const templateNames = [t.name, ...(t.name_aliases ?? [])].filter(Boolean);
    for (const tn of templateNames) {
      if (!tn || tn.length < 3) continue;
      const tnNorm = normalizeForMatch(tn);
      for (const c of uniqueCandidates) {
        const cNorm = normalizeForMatch(c);
        const sim = stringSimilarity.compareTwoStrings(tnNorm, cNorm);
        if (sim > bestScore) {
          bestScore = sim;
          bestTemplate = t;
        }
        const partialRatio =
          Math.min(tnNorm.length, cNorm.length) / Math.max(tnNorm.length, cNorm.length);
        if ((cNorm.includes(tnNorm) || tnNorm.includes(cNorm)) && partialRatio >= 0.7 && partialRatio > bestScore) {
          bestScore = partialRatio;
          bestTemplate = t;
        }
      }
    }
  }
  return bestTemplate;
}

export async function runInvoiceExtraction(invoiceId: string, actorUserId: string | null) {
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("storage_path, invoice_type")
    .eq("id", invoiceId)
    .single();

  if (!invoice?.storage_path) {
    throw new Error("No file attached");
  }

  const ext = getFileExtension(invoice.storage_path);
  if (!ext) {
    throw new Error("Unsupported file type");
  }

  const fileBuffer = await fetchFileBuffer(invoice.storage_path);
  const openai = getOpenAIClient();
  const text = await extractTextFromBuffer(fileBuffer, ext);
  const regexParsed = regexExtractFromText(text);

  let parsed: {
    beneficiary_name?: string | null;
    company_name?: string | null;
    account_number?: string | null;
    sort_code?: string | null;
    invoice_number?: string | null;
    invoice_date?: string | null;
    due_date?: string | null;
    net_amount?: number | null;
    vat_amount?: number | null;
    gross_amount?: number | null;
    currency?: string | null;
  } = {};
  let extractionError: string | null = null;

  const hasText = text.trim().length > 30;

  const CERTAIN_SUFFIX = ` Return JSON: {"value": "..." or number, "certain": true/false}. Set "certain": true ONLY when you clearly see the value in the document and are confident. Set "certain": false or omit if unsure.`;

  const FIELD_PROMPTS: Record<string, string> = {
    beneficiary_name: `Extract ONLY the beneficiary/account holder name from this invoice. Person or company who receives payment. Look for "Account holder name", "Payee name", "Beneficiary", "Name on account". NO address. NEVER use date, invoice number, or amount. NEVER include "TRT" or "TRT World".` + CERTAIN_SUFFIX,
    company_name: `Extract ONLY the company/business NAME (e.g. "FluentWorld Ltd", "Byproductions"). Look for the company name in the header, domain, or "Bank Name" line. NEVER use: "Account Holder" name (that is a person), "Company Reg. No.", "London UK", or any city/country. Company name = business/legal entity, NOT a person's name.` + CERTAIN_SUFFIX,
    account_number: `Extract ONLY the bank account number. Look for "Account No", "Account No :", "Account Number" - the 8-digit number where payment is sent (often near "Account Holder" or "Sort Code"). UK accounts: typically 8 digits. NEVER use phone numbers, Company Reg. No., or VAT No. Digits only.` + CERTAIN_SUFFIX,
    sort_code: `Extract ONLY the UK sort code from the bank details. Look for "Sort Code", "Sort/Branch Code". Exactly 6 digits. NEVER use Company Reg. No. or other numbers.` + CERTAIN_SUFFIX,
    invoice_number: `Extract ONLY the invoice number. Look for "Invoice No." or "Invoice Number" - often format like INV-123. NEVER use "Company Reg. No.", "Registration No.", "VAT No." - those are different. Copy exactly: letters, numbers, slashes, hyphens.` + CERTAIN_SUFFIX,
    invoice_date: `Extract ONLY the invoice date. Return YYYY-MM-DD format.` + CERTAIN_SUFFIX,
    due_date: `Extract ONLY the payment due date or "due by" date from this invoice. Return YYYY-MM-DD format.` + CERTAIN_SUFFIX,
    gross_amount: `Extract ONLY the final total amount to pay. Look for "Grand Total", "Total", "Amount Due", "Total Payable". NOT subtotals. Numeric only, no currency symbols.` + CERTAIN_SUFFIX,
    currency: `Extract ONLY the currency code. Return GBP, EUR, USD, or TRY. If £ appears, return GBP.` + CERTAIN_SUFFIX,
    guest_phone: `Extract ONLY the guest/contact phone number from this invoice. Look for "Phone", "Tel", "Mobile", "Contact" - the number where the invoice sender can be reached. UK format: +44 or 0xx. NEVER use bank account number, sort code, or VAT number.` + CERTAIN_SUFFIX,
    guest_email: `Extract ONLY the guest/contact email address from this invoice. Look for "Email", "E-mail", "Contact" - the email where the invoice sender can be reached. Format: name@domain.com. NEVER use TRT World or internal emails.` + CERTAIN_SUFFIX,
  };

  const AI_ONLY_FIELDS = ["gross_amount", "invoice_number", "invoice_date", "due_date", "currency", "guest_phone", "guest_email"];

  async function extractSingleField(
    fieldKey: string,
    docText: string,
    client: OpenAI
  ): Promise<{ value: string | number | null; certain: boolean }> {
    const prompt = FIELD_PROMPTS[fieldKey];
    if (!prompt) return { value: null, certain: false };
    try {
      const extractionModel = process.env.EXTRACTION_MODEL || "gpt-4o";
      const completion = await client.chat.completions.create({
        model: extractionModel,
        messages: [{ role: "user", content: `${prompt}\n\nDOCUMENT:\n${docText}` }],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw) return { value: null, certain: false };
      const obj = JSON.parse(raw) as { value?: string | number | null; certain?: boolean };
      const v = obj?.value;
      const certain = obj?.certain !== false; // use value unless explicitly uncertain
      if (v == null || v === "") return { value: null, certain: false };
      if (typeof v === "number") return { value: v, certain };
      return { value: String(v).trim() || null, certain };
    } catch {
      return { value: null, certain: false };
    }
  }

  function applyFieldResult(key: string, result: { value: string | number | null; certain: boolean }) {
    if (result.value == null || result.value === "") return;
    if (result.certain === false) return; // skip only when explicitly uncertain
    const val = result.value;
    if (key === "company_name" && typeof val === "string" && (/^\d+$/.test(val.replace(/\s/g, "")) || looksLikeLocation(val))) return; // reject numbers or locations
    if (key === "gross_amount") {
      (parsed as Record<string, unknown>)[key] = typeof val === "number" ? val : parseNumberLike(String(val));
    } else {
      (parsed as Record<string, unknown>)[key] = val;
    }
  }

  const { data: templates } = await supabase.from("contractor_templates").select("name, name_aliases, account_number, sort_code, beneficiary_name, company_name");
  let contractorFromDb: string | null = null;
  if ((invoice as { invoice_type?: string })?.invoice_type === "freelancer") {
    const { data: fl } = await supabase.from("freelancer_invoice_fields").select("contractor_name").eq("invoice_id", invoiceId).single();
    contractorFromDb = (fl as { contractor_name?: string } | null)?.contractor_name ?? null;
  }

  let templateMatched: ContractorTemplate | null = null;
  if (templates?.length) {
    const tmpls = templates as ContractorTemplate[];
    templateMatched = findMatchingTemplateBySimilarity(tmpls, text) ?? findMatchingTemplate(tmpls, [contractorFromDb], text);
  }

  if (templateMatched) {
    if (templateMatched.account_number) parsed.account_number = templateMatched.account_number;
    if (templateMatched.sort_code) parsed.sort_code = templateMatched.sort_code;
    if (templateMatched.beneficiary_name) parsed.beneficiary_name = templateMatched.beneficiary_name;
    if (templateMatched.company_name) parsed.company_name = templateMatched.company_name;
  }

  // Use regex results first to reduce AI calls (faster upload)
  const regexHas = (k: string) => {
    const v = (regexParsed as Record<string, unknown>)[k];
    if (k === "gross_amount") return typeof v === "number" && v > 0;
    if (k === "invoice_number") return typeof v === "string" && v.trim().length >= 3;
    if (k === "invoice_date") return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test((v as string).trim());
    if (k === "due_date") return typeof v === "string" && (v as string).trim().length >= 8;
    if (k === "currency") return typeof v === "string" && ["GBP", "EUR", "USD", "TRY"].includes((v as string).toUpperCase());
    return v != null && String(v).trim() !== "";
  };
  const fieldsFromRegex = templateMatched ? AI_ONLY_FIELDS : Object.keys(FIELD_PROMPTS);
  for (const k of fieldsFromRegex) {
    if (regexHas(k)) {
      const v = (regexParsed as Record<string, unknown>)[k];
      (parsed as Record<string, unknown>)[k] = v;
    }
  }
  // Always merge contact info from regex (for guest contacts list)
  const rp = regexParsed as Record<string, unknown>;
  if (rp.guest_phone) (parsed as Record<string, unknown>).guest_phone = rp.guest_phone;
  if (rp.guest_email) (parsed as Record<string, unknown>).guest_email = rp.guest_email;

  try {
    if (!openai) throw new Error("OPENAI_API_KEY missing");

    if (hasText) {
      const fieldsToExtract = (templateMatched ? AI_ONLY_FIELDS : Object.keys(FIELD_PROMPTS)).filter(
        (k) => !regexHas(k)
      );
      if (fieldsToExtract.length === 0) {
        // Regex got everything, skip AI
      } else {
      const results = await Promise.all(
        fieldsToExtract.map(async (key) => ({ key, result: await extractSingleField(key, text, openai!) }))
      );
      for (const { key, result } of results) {
        applyFieldResult(key, result);
      }
      if (!templateMatched) {
        const namesToMatch = [parsed.beneficiary_name, parsed.company_name, contractorFromDb];
        const fallbackMatch = templates?.length ? findMatchingTemplate(templates as ContractorTemplate[], namesToMatch, text) : null;
        if (fallbackMatch) {
          if (fallbackMatch.account_number) parsed.account_number = fallbackMatch.account_number;
          if (fallbackMatch.sort_code) parsed.sort_code = fallbackMatch.sort_code;
          if (fallbackMatch.beneficiary_name) parsed.beneficiary_name = fallbackMatch.beneficiary_name;
          if (fallbackMatch.company_name) parsed.company_name = fallbackMatch.company_name;
        }
      }
      const aiFieldCount = Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] != null).length;
      if (aiFieldCount < 2) {
        parsed = { ...regexParsed, ...parsed };
      }
      }
    } else {
      extractionError = "Document has no extractable text. Text-based PDFs only (no scanned images).";
      parsed = regexParsed;
    }
  } catch (err) {
    try {
      if (openai && text.trim().length > 20) {
        const fieldsToExtract = templateMatched ? AI_ONLY_FIELDS : Object.keys(FIELD_PROMPTS);
        const results = await Promise.all(
          fieldsToExtract.map(async (key) => ({ key, result: await extractSingleField(key, text, openai!) }))
        );
        for (const { key, result } of results) {
          applyFieldResult(key, result);
        }
        if (!templateMatched && templates?.length) {
          const namesToMatch = [parsed.beneficiary_name, parsed.company_name, contractorFromDb];
          const fallbackMatch = findMatchingTemplate(templates as ContractorTemplate[], namesToMatch, text);
          if (fallbackMatch) {
            if (fallbackMatch.account_number) parsed.account_number = fallbackMatch.account_number;
            if (fallbackMatch.sort_code) parsed.sort_code = fallbackMatch.sort_code;
            if (fallbackMatch.beneficiary_name) parsed.beneficiary_name = fallbackMatch.beneficiary_name;
            if (fallbackMatch.company_name) parsed.company_name = fallbackMatch.company_name;
          }
        }
        const aiFieldCount = Object.keys(parsed).filter((k) => parsed[k as keyof typeof parsed] != null).length;
        if (aiFieldCount < 2) parsed = { ...regexParsed, ...parsed };
        extractionError = null;
      } else {
        parsed = regexParsed;
      }
    } catch (fallbackErr) {
      extractionError =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : err instanceof Error
          ? err.message
          : "Extraction failed";
      parsed = regexParsed;
    }
  }

  // Prefer regex invoice_number when it found "Invoice No X" and AI result looks wrong (e.g. "202" from VAT% or filename)
  const regexInv = regexParsed.invoice_number?.trim();
  const aiInv = parsed.invoice_number?.trim();
  if (regexInv) {
    const regexLooksValid = regexInv.length >= 4 && /^[A-Z0-9\-\/]+$/i.test(regexInv);
    const aiLooksSuspicious =
      !aiInv ||
      aiInv.length <= 3 ||
      /^\d{2,3}$/.test(aiInv) || // e.g. "202" from VAT 20%
      /^[a-z]+-[a-z]+-\d+-/.test(aiInv.toLowerCase()); // filename-like: adam-boulton-202-2026
    if (regexLooksValid && aiLooksSuspicious) {
      parsed.invoice_number = regexInv;
    }
  }

  if (parsed.beneficiary_name) {
    parsed.beneficiary_name = stripInternalRefs(parsed.beneficiary_name) ?? undefined;
    if (parsed.beneficiary_name) parsed.beneficiary_name = stripAddressFromName(parsed.beneficiary_name) ?? undefined;
    if (
      parsed.beneficiary_name &&
      (looksLikeDate(parsed.beneficiary_name) ||
        looksLikeFieldLabel(parsed.beneficiary_name) ||
        looksLikeLocation(parsed.beneficiary_name) ||
        !looksLikeName(parsed.beneficiary_name))
    )
      parsed.beneficiary_name = undefined;
  }
  if (parsed.invoice_number) parsed.invoice_number = stripInternalRefs(parsed.invoice_number) ?? undefined;

  let companyName: string | null = null;
  if (parsed.company_name) {
    const c = stripInternalRefs(parsed.company_name);
    if (c && looksLikeName(c) && !looksLikeDate(c) && !looksLikeFieldLabel(c) && !looksLikeLocation(c)) companyName = c;
  }
  if (!companyName && parsed.beneficiary_name && !looksLikePersonName(parsed.beneficiary_name)) {
    companyName = parsed.beneficiary_name;
  }

  const sortCode = parsed.sort_code ? normalizeSortCode(parsed.sort_code) : null;
  const net = parsed.net_amount ?? 0;
  const vat = parsed.vat_amount ?? 0;
  const gross = parsed.gross_amount ?? 0;
  const amountsOk = gross > 0 && (net === 0 && vat === 0 ? true : amountsConsistent(net, vat, gross));
  const invoiceNumberEmpty = !parsed.invoice_number?.trim();
  const needsReview = Boolean(extractionError) || !amountsOk || invoiceNumberEmpty;

  const { data: oldExtracted } = await supabase
    .from("invoice_extracted_fields")
    .select("beneficiary_name, account_number, sort_code, invoice_number, gross_amount, invoice_date")
    .eq("invoice_id", invoiceId)
    .single();

  const toStr = (v: unknown): string => (v != null && v !== "" ? String(v).trim() : "");
  const extFields: [string, string, (p: typeof parsed) => string | null, (o: typeof oldExtracted) => string][] = [
    ["Account Name", "beneficiary_name", (p) => p.beneficiary_name ?? null, (o) => toStr(o?.beneficiary_name)],
    ["Account Number", "account_number", (p) => p.account_number ?? null, (o) => toStr(o?.account_number)],
    ["Sort Code", "sort_code", (p) => (p.sort_code ? (normalizeSortCode(p.sort_code) ?? p.sort_code) : null), (o) => toStr(o?.sort_code)],
    ["Invoice Number", "invoice_number", (p) => p.invoice_number ?? null, (o) => toStr(o?.invoice_number)],
    ["Amount", "gross_amount", (p) => (p.gross_amount != null ? String(p.gross_amount) : null), (o) => toStr(o?.gross_amount)],
    ["Invoice Date", "invoice_date", (p) => p.invoice_date ?? null, (o) => toStr(o?.invoice_date)],
  ];
  const extractionChanges: Record<string, { from: string; to: string }> = {};
  for (const [label, , getNew, getOld] of extFields) {
    const oldVal = getOld(oldExtracted);
    const newVal = toStr(getNew(parsed));
    if (newVal && oldVal !== newVal) extractionChanges[label] = { from: oldVal || "—", to: newVal };
  }

  const { error: upsertError } = await supabase.from("invoice_extracted_fields").upsert(
    {
      invoice_id: invoiceId,
      beneficiary_name: parsed.beneficiary_name ?? null,
      account_number: parsed.account_number ?? null,
      sort_code: sortCode ?? parsed.sort_code ?? null,
      invoice_number: parsed.invoice_number ?? null,
      invoice_date: parsed.invoice_date ?? null,
      net_amount: parsed.net_amount ?? null,
      vat_amount: parsed.vat_amount ?? null,
      gross_amount: parsed.gross_amount ?? null,
      extracted_currency: parsed.currency ?? null,
      needs_review: needsReview,
      manager_confirmed: false,
      raw_json: {
        ...(parsed as unknown as Record<string, unknown>),
        extraction_error: extractionError,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "invoice_id" }
  );

  if (upsertError) {
    throw new Error("Failed to save extraction: " + upsertError.message);
  }

  const { data: inv } = await supabase.from("invoices").select("invoice_type").eq("id", invoiceId).single();
  if ((inv as { invoice_type?: string } | null)?.invoice_type === "freelancer") {
    let flCompanyName = companyName ?? (parsed.beneficiary_name && !looksLikePersonName(parsed.beneficiary_name) ? parsed.beneficiary_name : null) ?? null;
    if (flCompanyName) {
      flCompanyName = stripInternalRefs(flCompanyName) ?? stripAddressFromName(flCompanyName) ?? null;
      if (flCompanyName && /trt/i.test(flCompanyName)) flCompanyName = null;
    }
    await supabase
      .from("freelancer_invoice_fields")
      .update({ company_name: flCompanyName, updated_at: new Date().toISOString() })
      .eq("invoice_id", invoiceId);
  }

  await createAuditEvent({
    invoice_id: invoiceId,
    actor_user_id: actorUserId,
    event_type: "invoice_extracted",
    payload: { needs_review: needsReview, changes: Object.keys(extractionChanges).length > 0 ? extractionChanges : undefined },
  });

  return { needs_review: needsReview, warning: extractionError ?? undefined };
}
