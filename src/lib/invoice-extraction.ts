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
    /(?:beneficiary|payee|account\s*name|name)\s*[:\-]?\s*([A-Za-z0-9 '&.,-]{2,120})/i,
  ]);
  const currency =
    full.match(/\b(GBP|EUR|USD|TRY)\b/i)?.[1]?.toUpperCase() ??
    (full.includes("£") ? "GBP" : null);
  const grossRaw =
    lineValue([
      /(?:grand\s*total|total\s*amount|total|amount\s*due|gross)\s*[:\-]?\s*[£$€]?\s*([0-9][0-9,]*(?:\.\d{2})?)/i,
      /(?:balance\s*due)\s*[:\-]?\s*[£$€]?\s*([0-9][0-9,]*(?:\.\d{2})?)/i,
      /[£$€]\s*([0-9][0-9,]*(?:\.\d{2})?)/,
    ]) ?? null;
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

  const extractionPrompt = `Extract invoice fields from this document with high accuracy.
Return a JSON object with exactly these keys:
beneficiary_name, account_number, sort_code, invoice_number, invoice_date, net_amount, vat_amount, gross_amount, currency.

CRITICAL RULES - extract exactly as shown in the document:
- invoice_number: Copy the exact invoice/reference number as printed (letters, numbers, slashes, hyphens). Do not invent or modify.
- sort_code: UK format only - exactly 6 digits, no spaces or dashes (e.g. 123456). Extract from "Sort Code" or equivalent field.
- account_number: Exactly as shown - typically 8 digits for UK, no spaces. Extract from "Account Number" or equivalent.
- beneficiary_name: The payee/beneficiary name - the person or company TO RECEIVE payment. NOT the payer. Extract exactly as written.

STRICT EXCLUSIONS - NEVER include in any field:
- Do NOT include "TRT", "TRT World", "TRTWORLD", "TRT WORLD" or any variant in beneficiary_name, invoice_number, or any extracted field.
- These are internal/organizational references, not invoice data. Omit them entirely or use null.
- If the document only shows such references for beneficiary, use null for beneficiary_name.

Other rules:
- Use null when unknown or ambiguous
- invoice_date: YYYY-MM-DD format if available
- amounts: numeric only, no currency symbols
- Be precise: double-check numbers match the document exactly`;

  const isPdf = ext === "pdf";

  try {
    if (!openai) throw new Error("OPENAI_API_KEY missing");

    if (isPdf) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: extractionPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${fileBuffer.toString("base64")}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("No extraction result");
      parsed = JSON.parse(raw) as typeof parsed;
    } else {
      if (!text.trim()) throw new Error("Document text extraction returned empty content");
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
    }
  } catch (err) {
    try {
      if (!text.trim()) throw new Error("Document text extraction returned empty content");
      if (openai) {
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
      } else {
        parsed = regexParsed;
      }
      extractionError = null;
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

  if (parsed.beneficiary_name) parsed.beneficiary_name = stripInternalRefs(parsed.beneficiary_name) ?? undefined;
  if (parsed.invoice_number) parsed.invoice_number = stripInternalRefs(parsed.invoice_number) ?? undefined;

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

  await createAuditEvent({
    invoice_id: invoiceId,
    actor_user_id: actorUserId,
    event_type: "invoice_extracted",
    payload: { needs_review: needsReview, changes: Object.keys(extractionChanges).length > 0 ? extractionChanges : undefined },
  });

  return { needs_review: needsReview, warning: extractionError ?? undefined };
}
