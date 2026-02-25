/**
 * AI-powered payslip extraction for Salary Processing System.
 * Extracts fields from payslip PDFs (TRT WORLD UK format).
 *
 * Key rules:
 * - Use "Total Gross Pay" not "Gross for Tax"
 * - Distinguish Employee Pension (Ee) vs Employer Pension (Er)
 * - Ignore Year-To-Date figures
 * - Employer Total Cost = Total Gross Pay + Employer Pension + (Employer NI if present)
 */

import OpenAI from "openai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSortCode } from "@/lib/validation";

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

const EXCEL_HEADER_ALIASES: Record<string, string[]> = {
  employee_name: ["employee name", "name", "employee", "full name", "person", "staff name", "calisan", "isim", "ad soyad", "emp name"],
  net_pay: ["net pay", "net", "final net pay", "take home", "netpay", "net maas", "net odeme", "net amount"],
  total_gross_pay: ["total gross pay", "gross pay", "gross", "total gross", "gross salary", "grosspay", "brut", "brut maas", "gross amount"],
  paye_tax: ["paye tax", "paye", "tax", "income tax", "vergi"],
  employee_ni: ["employee ni", "ni", "national insurance", "employee national insurance", "sigorta", "ee ni"],
  employee_pension: ["employee pension", "ee pension", "pension", "employee's pension", "emekli", "ee pension"],
  employer_pension: ["employer pension", "er pension", "employer's pension", "employer pension"],
  employer_ni: ["employer ni", "employer national insurance", "er ni"],
  process_date: ["process date", "date", "payment date", "tarih", "islem tarihi", "pay date", "paid date"],
  payment_month: ["payment month", "month", "pay month", "period"],
  bank_account_number: ["account number", "account no", "account", "bank account", "hesap", "iban", "hesap no", "acc no", "acc number", "bank acc"],
  sort_code: ["sort code", "sort/branch code", "sortcode", "sube kodu", "sort"],
  ni_number: ["ni number", "ni no", "national insurance number"],
  employer_total_cost: ["total cost", "employer total cost", "cost", "total"],
};

/** Convert Excel serial date (e.g. 46053) to YYYY-MM-DD */
function excelSerialToDateString(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400 * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? "").toString().toLowerCase().trim();
    for (const a of aliases) {
      if (h.includes(a) || a.includes(h)) return i;
    }
  }
  return -1;
}

function tryParseSheetWithHeader(data: string[][], headerRowIndex: number): ExtractedSalaryFields | null {
  const headerRow = data[headerRowIndex] ?? [];
  const headers = headerRow.map((h) => String(h ?? "").trim());

  const colMap: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(EXCEL_HEADER_ALIASES)) {
    const idx = findColumnIndex(headers, aliases);
    if (idx >= 0) colMap[key] = idx;
  }

  const hasName = colMap.employee_name >= 0;
  const hasAnyData = Object.keys(colMap).length > 0;
  if (!hasName || !hasAnyData) return null;

  const result: ExtractedSalaryFields = {
    employee_name: null,
    ni_number: null,
    net_pay: null,
    total_gross_pay: null,
    paye_tax: null,
    employee_ni: null,
    employee_pension: null,
    employer_pension: null,
    employer_ni: null,
    employer_total_cost: null,
    process_date: null,
    tax_period: null,
    payment_month: null,
    payment_year: null,
    bank_account_number: null,
    sort_code: null,
  };

  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r] ?? [];
    const getVal = (key: string): string | null => {
      const idx = colMap[key];
      if (idx == null || idx < 0) return null;
      const v = row[idx];
      return v != null && String(v).trim() !== "" ? String(v).trim() : null;
    };
    const getRaw = (key: string): unknown => {
      const idx = colMap[key];
      if (idx == null || idx < 0) return null;
      return row[idx];
    };

    const empName = getVal("employee_name");
    if (!empName) continue;

    result.employee_name = empName;
    result.ni_number = getVal("ni_number");
    result.net_pay = parseNumberLike(getVal("net_pay"));
    result.total_gross_pay = parseNumberLike(getVal("total_gross_pay"));
    result.paye_tax = parseNumberLike(getVal("paye_tax"));
    result.employee_ni = parseNumberLike(getVal("employee_ni"));
    result.employee_pension = parseNumberLike(getVal("employee_pension"));
    result.employer_pension = parseNumberLike(getVal("employer_pension"));
    result.employer_ni = parseNumberLike(getVal("employer_ni"));
    result.employer_total_cost = parseNumberLike(getVal("employer_total_cost"));
    const dateRaw = getRaw("process_date");
    const dateVal =
      typeof dateRaw === "number"
        ? excelSerialToDateString(dateRaw)
        : getVal("process_date");
    result.process_date = dateVal;
    const monthVal = getVal("payment_month");
    result.payment_month = monthVal || (dateVal ? monthNameFromDate(dateVal) : null);
    result.payment_year = dateVal ? yearFromDate(dateVal) : null;
    if (!result.payment_year && monthVal) {
      const m = new Date(`${monthVal} 1`);
      if (!Number.isNaN(m.getTime())) result.payment_year = m.getFullYear();
    }
    result.bank_account_number = getVal("bank_account_number");
    const sc = getVal("sort_code");
    result.sort_code = sc ? (normalizeSortCode(sc) ?? sc) : null;
    return result;
  }

  return result.employee_name ? result : null;
}

function parseExcelStructured(buffer: Buffer): ExtractedSalaryFields | null {
  const all = parseExcelBulk(buffer);
  return all.length > 0 ? all[0]! : null;
}

/** Parse all rows from Excel (Salaries_Paid format). Returns one ExtractedSalaryFields per data row. */
export function parseExcelBulk(buffer: Buffer): ExtractedSalaryFields[] {
  const results: ExtractedSalaryFields[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
      if (!data.length) continue;

      for (let headerRowIdx = 0; headerRowIdx <= Math.min(3, data.length - 1); headerRowIdx++) {
        const headerRow = data[headerRowIdx] ?? [];
        const headers = headerRow.map((h) => String(h ?? "").trim());
        const colMap: Record<string, number> = {};
        for (const [key, aliases] of Object.entries(EXCEL_HEADER_ALIASES)) {
          const idx = findColumnIndex(headers, aliases);
          if (idx >= 0) colMap[key] = idx;
        }
        if (colMap.employee_name == null || colMap.employee_name < 0) continue;

        for (let r = headerRowIdx + 1; r < data.length; r++) {
          const row = data[r] ?? [];
          const getVal = (key: string): string | null => {
            const idx = colMap[key];
            if (idx == null || idx < 0) return null;
            const v = row[idx];
            return v != null && String(v).trim() !== "" ? String(v).trim() : null;
          };
          const getRaw = (key: string): unknown => {
            const idx = colMap[key];
            if (idx == null || idx < 0) return null;
            return row[idx];
          };

          const empName = getVal("employee_name");
          if (!empName) continue;

          const dateRaw = getRaw("process_date");
          const dateVal =
            typeof dateRaw === "number" ? excelSerialToDateString(dateRaw) : getVal("process_date");
          const monthVal = getVal("payment_month");

          results.push({
            employee_name: empName,
            ni_number: getVal("ni_number"),
            net_pay: parseNumberLike(getVal("net_pay")),
            total_gross_pay: parseNumberLike(getVal("total_gross_pay")),
            paye_tax: parseNumberLike(getVal("paye_tax")),
            employee_ni: parseNumberLike(getVal("employee_ni")),
            employee_pension: parseNumberLike(getVal("employee_pension")),
            employer_pension: parseNumberLike(getVal("employer_pension")),
            employer_ni: parseNumberLike(getVal("employer_ni")),
            employer_total_cost: parseNumberLike(getVal("employer_total_cost")),
            process_date: dateVal,
            tax_period: null,
            payment_month: monthVal || (dateVal ? monthNameFromDate(dateVal) : null),
            payment_year: dateVal ? yearFromDate(dateVal) : null,
            bank_account_number: getVal("bank_account_number"),
            sort_code: (() => {
              const sc = getVal("sort_code");
              return sc ? (normalizeSortCode(sc) ?? sc) : null;
            })(),
          });
          if (!results[results.length - 1]!.payment_year && monthVal) {
            const m = new Date(`${monthVal} 1`);
            if (!Number.isNaN(m.getTime())) (results[results.length - 1] as ExtractedSalaryFields).payment_year = m.getFullYear();
          }
        }
        if (results.length > 0) return results;
      }
    }
  } catch {
    // ignore
  }
  return results;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseNumberLike(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = String(input).replace(/[, ]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export type ExtractedSalaryFields = {
  employee_name: string | null;
  ni_number: string | null;
  net_pay: number | null;
  total_gross_pay: number | null;
  paye_tax: number | null;
  employee_ni: number | null;
  employee_pension: number | null;
  employer_pension: number | null;
  employer_ni: number | null;
  employer_total_cost: number | null;
  process_date: string | null;
  tax_period: string | null;
  payment_month: string | null;
  payment_year: number | null;
  bank_account_number: string | null;
  sort_code: string | null;
};

function monthNameFromDate(dateStr: string | null): string | null {
  if (!dateStr?.trim()) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[d.getMonth()] ?? null;
}

function yearFromDate(dateStr: string | null): number | null {
  if (!dateStr?.trim()) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

/** Compute Employer Total Cost = Total Gross Pay + Employer Pension + Employer NI (if present) */
export function computeEmployerTotalCost(
  totalGrossPay: number | null,
  employerPension: number | null,
  employerNi: number | null
): number | null {
  const gross = totalGrossPay ?? 0;
  const erPension = employerPension ?? 0;
  const erNi = employerNi ?? 0;
  if (gross <= 0) return null;
  return gross + erPension + erNi;
}

/** Generate reference: "{Month Name} Salary Payment" */
export function generateSalaryReference(processDate: string | null): string {
  const month = monthNameFromDate(processDate);
  if (!month) return "Salary Payment";
  return `${month} Salary Payment`;
}

const PAYSLIP_FIELD_PROMPTS: Record<string, string> = {
  employee_name: `Extract ONLY the employee's full name from this payslip. Look for "Employee Name", "Name", or similar. Format like "Mr. BARNABY CHARLES EDWARD MILLER". Return the full name exactly as shown. NEVER use company name, department, or address.`,
  ni_number: `Extract ONLY the National Insurance (NI) number from this UK payslip. Format like AB123456C. Digits and letters only.`,
  net_pay: `Extract ONLY the Final Net Pay / Net Pay amount from this payslip. This is the amount the employee receives after all deductions. Use the figure labeled "Net Pay" or "Final Net Pay". Numeric value only, no currency. IGNORE Year-To-Date (YTD) figures.`,
  total_gross_pay: `Extract ONLY the "Total Gross Pay" from this payslip. NOT "Gross for Tax" or "Gross for NI". Use the line explicitly labeled "Total Gross Pay". Numeric only. IGNORE YTD.`,
  paye_tax: `Extract ONLY the PAYE Tax amount from the Deductions section. Look for "PAYE Tax" or "Tax". Numeric only. IGNORE YTD.`,
  employee_ni: `Extract ONLY the Employee National Insurance (NI) from the Deductions section. Look for "National Insurance", "Employee NI", "NI" (employee portion). NOT employer NI. Numeric only. IGNORE YTD.`,
  employee_pension: `Extract ONLY the Employee Pension from the Deductions section. Look for "Ee Pension", "Employee Pension", "Employee's Pension". NOT employer pension. Numeric only. IGNORE YTD.`,
  employer_pension: `Extract ONLY the Employer Pension from the Employer Costs section. Look for "Er Pension", "Employer Pension", "Employer's Pension". Numeric only. IGNORE YTD.`,
  employer_ni: `Extract the Employer NI (Employer National Insurance) from the Employer Costs section if it exists. If not present, return null. Numeric only. IGNORE YTD.`,
  employer_total_cost: `Extract the Employer Total Cost / Total Cost from this payslip. This is Total Gross Pay + Employer Pension + Employer NI. Look for "Employer Total Cost", "Total Cost", "Cost to Company" or similar. Numeric only. IGNORE YTD.`,
  process_date: `Extract ONLY the Process Date from this payslip. Format as YYYY-MM-DD. Look for "Process Date" or similar.`,
  tax_period: `Extract the Tax Period if shown (e.g. "01", "02", or "Month 1"). Return as string or null if not found.`,
  bank_account_number: `Extract ONLY the bank account number (Account Number) from this payslip if shown. Typically 8 digits for UK.`,
  sort_code: `Extract ONLY the UK Sort Code from this payslip if shown. 6 digits, optionally with hyphens.`,
};

const CERTAIN_SUFFIX = ` Return JSON: {"value": "..." or number, "certain": true/false}. Set "certain": true ONLY when you clearly see the value. Set "certain": false if unsure or not found.`;

async function extractSingleField(
  fieldKey: string,
  docText: string,
  client: OpenAI
): Promise<{ value: string | number | null; certain: boolean }> {
  const basePrompt = PAYSLIP_FIELD_PROMPTS[fieldKey];
  if (!basePrompt) return { value: null, certain: false };
  const prompt = basePrompt + CERTAIN_SUFFIX;
  try {
    const model = process.env.EXTRACTION_MODEL || "gpt-4o";
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: `${prompt}\n\nDOCUMENT:\n${docText}` }],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return { value: null, certain: false };
    const obj = JSON.parse(raw) as { value?: string | number | null; certain?: boolean };
    const v = obj?.value;
    const certain = obj?.certain !== false;
    if (v == null || v === "") return { value: null, certain: false };
    if (typeof v === "number") return { value: v, certain };
    return { value: String(v).trim() || null, certain };
  } catch {
    return { value: null, certain: false };
  }
}

async function fetchFileBuffer(storagePath: string): Promise<Buffer> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("invoices").download(storagePath);
  if (error || !data) throw new Error("Failed to fetch file");
  return Buffer.from(await data.arrayBuffer());
}

function simpleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const sa = a.toLowerCase();
  const sb = b.toLowerCase();
  if (sa === sb) return 1;
  const wordsA = sa.split(/\s+/).filter((w) => w.length > 1);
  const wordsB = new Set(sb.split(/\s+/));
  let matches = 0;
  for (let i = 0; i < wordsA.length; i++) {
    if (wordsB.has(wordsA[i])) matches++;
  }
  return wordsA.length + wordsB.size > 0 ? (2 * matches) / (wordsA.length + wordsB.size) : 0;
}

function matchEmployeeByName(
  extractedName: string,
  employees: { id: string; full_name: string | null; bank_account_number?: string | null; sort_code?: string | null; ni_number?: string | null }[]
): (typeof employees)[number] | null {
  const extractedNorm = extractedName.replace(/\b(Mr|Mrs|Ms|Dr)\.?\s*/gi, "").trim().toLowerCase();
  let matched: (typeof employees)[number] | null = null;
  for (const emp of employees) {
    const dbNorm = (emp.full_name ?? "").trim().toLowerCase();
    if (dbNorm === extractedNorm || extractedNorm.includes(dbNorm) || dbNorm.includes(extractedNorm)) {
      return emp;
    }
    const sim = simpleSimilarity(extractedNorm, dbNorm);
    if (sim >= 0.5 && (!matched || sim > simpleSimilarity(extractedNorm, (matched.full_name ?? "").toLowerCase()))) {
      matched = emp;
    }
  }
  return matched;
}

export async function runSalaryExtraction(
  salaryId: string,
  storagePath: string,
  actorUserId: string | null
): Promise<{ needs_review: boolean; warning?: string }> {
  const ext = getFileExtension(storagePath);
  if (!ext) throw new Error("Unsupported file type");

  const fileBuffer = await fetchFileBuffer(storagePath);
  const text = await extractTextFromBuffer(fileBuffer, ext);
  const openai = getOpenAIClient();

  let parsed: ExtractedSalaryFields = {
    employee_name: null,
    ni_number: null,
    net_pay: null,
    total_gross_pay: null,
    paye_tax: null,
    employee_ni: null,
    employee_pension: null,
    employer_pension: null,
    employer_ni: null,
    employer_total_cost: null,
    process_date: null,
    tax_period: null,
    payment_month: null,
    payment_year: null,
    bank_account_number: null,
    sort_code: null,
  };

  if (ext === "xlsx" || ext === "xls") {
    const excelData = parseExcelStructured(fileBuffer);
    if (excelData && excelData.employee_name) {
      parsed = { ...parsed, ...excelData };
    }
  }

  let extractionError: string | null = null;
  const hasText = text.trim().length > 30;
  const isPdfOrDoc = ext === "pdf" || ext === "docx" || ext === "doc";

  if (openai && hasText) {
    if (isPdfOrDoc) {
      const nameResult = await extractSingleField("employee_name", text, openai);
      const extractedName = nameResult.value != null && nameResult.value !== "" ? String(nameResult.value).trim() : null;
      if (extractedName) {
        parsed.employee_name = extractedName;
        const supabase = createAdminClient();
        const { data: employees } = await supabase
          .from("employees")
          .select("id, full_name, bank_account_number, sort_code, ni_number");
        const matched = matchEmployeeByName(extractedName, employees ?? []);
        if (matched) {
          parsed.bank_account_number = matched.bank_account_number ?? null;
          parsed.sort_code = matched.sort_code ? (normalizeSortCode(matched.sort_code) ?? matched.sort_code) : null;
          parsed.ni_number = matched.ni_number ?? null;
        }
      }
    }

    const fields = Object.keys(PAYSLIP_FIELD_PROMPTS);
    const results = await Promise.all(
      fields.map(async (key) => ({ key, result: await extractSingleField(key, text, openai) }))
    );
    for (const { key, result } of results) {
      if (result.value == null || result.value === "") continue;
      if (result.certain === false) continue;
      const existing = (parsed as Record<string, unknown>)[key];
      if (existing != null && existing !== "") continue;
      const val = result.value;
      if (typeof val === "number") {
        (parsed as Record<string, unknown>)[key] = val;
      } else {
        (parsed as Record<string, unknown>)[key] = String(val).trim();
      }
    }

    if (!parsed.payment_month && parsed.process_date) {
      parsed.payment_month = monthNameFromDate(parsed.process_date);
    }
    if (!parsed.payment_year && parsed.process_date) {
      parsed.payment_year = yearFromDate(parsed.process_date);
    }
  } else {
    extractionError = hasText ? "OpenAI extraction unavailable" : "Document has no extractable text";
  }

  const employerTotalCost =
    parsed.employer_total_cost ??
    computeEmployerTotalCost(parsed.total_gross_pay, parsed.employer_pension, parsed.employer_ni);

  const reference = generateSalaryReference(parsed.process_date);
  const sortCode = parsed.sort_code ? (normalizeSortCode(parsed.sort_code) ?? parsed.sort_code) : null;

  const needsReview =
    Boolean(extractionError) ||
    parsed.net_pay == null ||
    parsed.net_pay <= 0 ||
    !parsed.employee_name?.trim();

  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from("salaries")
    .update({
      employee_name: parsed.employee_name ?? undefined,
      ni_number: parsed.ni_number ?? undefined,
      net_pay: parsed.net_pay ?? undefined,
      total_gross_pay: parsed.total_gross_pay ?? undefined,
      paye_tax: parsed.paye_tax ?? undefined,
      employee_ni: parsed.employee_ni ?? undefined,
      employee_pension: parsed.employee_pension ?? undefined,
      employer_pension: parsed.employer_pension ?? undefined,
      employer_ni: parsed.employer_ni ?? undefined,
      employer_total_cost: employerTotalCost ?? undefined,
      process_date: parsed.process_date ?? undefined,
      tax_period: parsed.tax_period ?? undefined,
      payment_month: parsed.payment_month ?? undefined,
      payment_year: parsed.payment_year ?? undefined,
      bank_account_number: parsed.bank_account_number ?? undefined,
      sort_code: sortCode ?? parsed.sort_code ?? undefined,
      reference: reference ?? undefined,
      status: needsReview ? "needs_review" : "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", salaryId);

  if (updateError) {
    throw new Error("Failed to save extraction: " + updateError.message);
  }

  await createSalaryAuditEvent({
    salary_id: salaryId,
    actor_user_id: actorUserId,
    event_type: "salary_extracted",
    payload: { needs_review: needsReview, extraction_error: extractionError ?? undefined },
  });

  return { needs_review: needsReview, warning: extractionError ?? undefined };
}

export async function createSalaryAuditEvent(params: {
  salary_id: string;
  actor_user_id: string | null;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  payload?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  await supabase.from("audit_events").insert({
    salary_id: params.salary_id,
    actor_user_id: params.actor_user_id,
    event_type: params.event_type,
    from_status: params.from_status ?? null,
    to_status: params.to_status ?? null,
    payload: params.payload ?? {},
  });
}
