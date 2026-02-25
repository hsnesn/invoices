import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
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
      /(?:invoice\s*(?:number|no|#)\s*[:\-]?\s*)([A-Z0-9\-\/]+)/i,
      /(?:inv(?:oice)?\s*#\s*[:\-]?\s*)([A-Z0-9\-\/]+)/i,
      /(?:reference|ref)\s*[:\-]?\s*([A-Z0-9\-\/]{4,})/i,
    ]) ?? null;
  const sortCodeRaw =
    lineValue([
      /(?:sort\s*code)\s*[:\-]?\s*(\d{2}[- ]?\d{2}[- ]?\d{2})/i,
      /\b(\d{2}[- ]?\d{2}[- ]?\d{2})\b/,
    ]) ?? null;
  const accountNumber =
    lineValue([
      /(?:account\s*(?:number|no|#)?)\s*[:\-]?\s*([0-9 ]{6,20})/i,
      /\b(\d{8})\b/,
    ])?.replace(/\s+/g, "") ?? null;
  const beneficiaryFromLabel = lineValue([
    /(?:beneficiary|payee|account\s*name|name\s+on\s+account)\s*[:\-]?\s*([A-Za-z0-9 '&.,-]{2,120})/i,
  ]);
  const companyFromLabel = lineValue([
    /(?:company|business|trading\s+as)\s*(?:name)?\s*[:\-]?\s*([A-Za-z0-9 '&.,-]{2,120})/i,
  ]);
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

  let beneficiary: string | null = beneficiaryFromLabel ?? null;
  for (const line of lines) {
    if (beneficiary) break;
    if (/invoice|vat|tax|subtotal|total|amount|sort|account|date/i.test(line)) continue;
    if (/^[A-Za-z][A-Za-z0-9 '&.,-]{2,80}$/.test(line)) {
      beneficiary = line;
      break;
    }
  }

  return {
    beneficiary_name: stripInternalRefs(beneficiary),
    company_name: stripInternalRefs(companyFromLabel),
    account_number: accountNumber,
    sort_code: sortCodeRaw ? normalizeSortCode(sortCodeRaw) ?? sortCodeRaw : null,
    invoice_number: stripInternalRefs(invoiceNumber),
    invoice_date: date,
    net_amount: parseNumberLike(netRaw),
    vat_amount: parseNumberLike(vatRaw),
    gross_amount: parseNumberLike(grossRaw),
    currency,
  };
}

async function fetchFileBuffer(storagePath: string): Promise<Buffer> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("invoices").download(storagePath);
  if (error || !data) throw new Error("Failed to fetch file");
  return Buffer.from(await data.arrayBuffer());
}

export async function runInvoiceExtraction(invoiceId: string, actorUserId: string | null) {
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("storage_path")
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
    net_amount?: number | null;
    vat_amount?: number | null;
    gross_amount?: number | null;
    currency?: string | null;
  } = {};
  let extractionError: string | null = null;

  const extractionPrompt = `Extract invoice fields from this document. Return a JSON object with exactly these keys (use null for missing fields):
beneficiary_name, company_name, account_number, sort_code, invoice_number, invoice_date, net_amount, vat_amount, gross_amount, currency.

IMPORTANT: Extract ALL fields you can find. Do not return empty - use null only when a field is truly not present. Scan the entire document carefully.

CRITICAL RULES - extract exactly as shown in the document:
- invoice_number: Copy the exact invoice/reference number as printed (letters, numbers, slashes, hyphens). Do not invent or modify.
- sort_code: UK format only - exactly 6 digits, no spaces or dashes (e.g. 123456). Extract from "Sort Code" or equivalent field.
- account_number: Exactly as shown - typically 8 digits for UK, no spaces. Extract from "Account Number" or equivalent.
- beneficiary_name: The VALUE (not the label) next to bank account name fields. Extract ONLY the actual name - NO address.
  * LOOK FOR labels like: "Your full name on bank account", "Account holder name", "Payee name", "Beneficiary", "Name on account", "Account name" - then take the VALUE written next to/under that label.
  * If a company: use the company name. If a person: use the person's full name.
  * NEVER include address: no street, road, avenue, postcode, city, country, building number. Name ONLY.
  * NEVER use a field LABEL as beneficiary. REJECT: "Appearance Date", "Invoice Date", "Payment Date", "Submission Date", or any phrase ending in "Date", "Number", "Code", "Amount".
  * REJECT: dates, numbers, invoice refs. Use null if no valid person/company name found.
- company_name: The company/business name if the payee is a company. Look for "Company name", "Business name", "Trading as", "Ltd", "Inc", "LLC" etc.
  * If the payee is SELF-EMPLOYED (no company): use null for company_name. The person's name goes in beneficiary_name only.
  * If a company exists: extract the exact company name. If both company and person appear, company_name = company, beneficiary_name = person or company (who receives payment).
- gross_amount: The TOTAL amount to pay - CRITICAL, must be found. Look everywhere:
  * Labels: "Grand Total", "Total", "Total Amount", "Amount Due", "Balance Due", "Invoice Total", "Total Payable", "Amount Payable", "Payment Due", "Sum", "Gross", "Net + VAT", "Final Total", "Amount to Pay", "Invoice Value"
  * The total is usually: at the bottom of the document, in a payment/bank details section, the LARGEST amount on the invoice, or in a row labeled "Total"
  * Format: numeric only, e.g. 1250.00 or 1,250.00. Include decimals if present. No currency symbols.
  * If multiple amounts: use the one labeled "Total"/"Grand Total"/"Amount Due", NOT subtotals or line items. If unclear, use the LARGEST amount.
- net_amount: Subtotal before VAT/tax. Labels: "Net", "Subtotal", "Sub total".
- vat_amount: VAT/tax amount. Labels: "VAT", "Tax", "GST".

STRICT EXCLUSIONS - NEVER include in any field:
- Do NOT include "TRT", "TRT World", "TRTWORLD", "TRT WORLD" or any variant in beneficiary_name, invoice_number, or any extracted field.
- These are internal/organizational references, not invoice data. Omit them entirely or use null.
- If the document only shows such references for beneficiary, use null for beneficiary_name.

Other rules:
- Use null when unknown or ambiguous
- invoice_date: YYYY-MM-DD format if available
- amounts: numeric only, no currency symbols (strip £ $ € ,)
- gross_amount is the most important amount - scan the entire document if needed to find the total payable
- Be precise: double-check numbers match the document exactly`;

  const hasText = text.trim().length > 30;

  try {
    if (!openai) throw new Error("OPENAI_API_KEY missing");

    if (hasText) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `${extractionPrompt}\n\nDOCUMENT TEXT:\n${text}`,
          },
        ],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("No extraction result");
      parsed = JSON.parse(raw) as typeof parsed;
    } else if (ext === "pdf" && openai) {
      const apiKey = process.env.OPENAI_API_KEY!;
      const base64Pdf = fileBuffer.toString("base64");
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: extractionPrompt },
                { type: "input_file", filename: "invoice.pdf", file_data: `data:application/pdf;base64,${base64Pdf}` },
              ],
            },
          ],
          text: { format: { type: "json_object" } },
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenAI Responses API error: ${res.status} ${errBody}`);
      }
      const data = (await res.json()) as { output_text?: string };
      const raw = data.output_text;
      if (!raw) throw new Error("No extraction result");
      parsed = JSON.parse(raw) as typeof parsed;
    } else {
      throw new Error("Document has no extractable text. Scanned/image-based PDFs require PDF format.");
    }
  } catch (err) {
    try {
      if (openai && text.trim().length > 20) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: `${extractionPrompt}\n\nDOCUMENT TEXT:\n${text}`,
            },
          ],
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content;
        if (!raw) throw new Error("No extraction result from text fallback");
        parsed = JSON.parse(raw) as typeof parsed;
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

  if (parsed.beneficiary_name) {
    parsed.beneficiary_name = stripInternalRefs(parsed.beneficiary_name) ?? undefined;
    if (parsed.beneficiary_name) parsed.beneficiary_name = stripAddressFromName(parsed.beneficiary_name) ?? undefined;
    if (
      parsed.beneficiary_name &&
      (looksLikeDate(parsed.beneficiary_name) ||
        looksLikeFieldLabel(parsed.beneficiary_name) ||
        !looksLikeName(parsed.beneficiary_name))
    )
      parsed.beneficiary_name = undefined;
  }
  if (parsed.invoice_number) parsed.invoice_number = stripInternalRefs(parsed.invoice_number) ?? undefined;

  let companyName: string | null = null;
  if (parsed.company_name) {
    const c = stripInternalRefs(parsed.company_name);
    if (c && looksLikeName(c) && !looksLikeDate(c) && !looksLikeFieldLabel(c)) companyName = c;
  }
  if (!companyName && parsed.beneficiary_name) {
    companyName = parsed.beneficiary_name;
  }

  const sortCode = parsed.sort_code ? normalizeSortCode(parsed.sort_code) : null;
  const net = parsed.net_amount ?? 0;
  const vat = parsed.vat_amount ?? 0;
  const gross = parsed.gross_amount ?? 0;
  const amountsOk = amountsConsistent(net, vat, gross);
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
    let flCompanyName = companyName ?? parsed.beneficiary_name ?? null;
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
