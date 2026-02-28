import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  runSalaryExtraction,
  parseExcelBulk,
  computeEmployerTotalCost,
  generateSalaryReference,
} from "@/lib/salary-extraction";
import { normalizeSortCode } from "@/lib/validation";

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

type EmployeeForMatch = {
  id: string;
  full_name: string | null;
  bank_account_number?: string | null;
  sort_code?: string | null;
  ni_number?: string | null;
};

function matchEmployee(
  extractedName: string,
  employees: EmployeeForMatch[]
): EmployeeForMatch | null {
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

const BUCKET = "invoices";
const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function safeFileStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "payslip";
}

/** POST /api/salaries/upload - Upload payslip or Salaries_Paid Excel (bulk) */
export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }

    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const filesRaw = formData.getAll("file");
    const files = (Array.isArray(filesRaw) ? filesRaw : [filesRaw])
      .filter((f): f is File => f instanceof File);
    const employee_id = formData.get("employee_id") as string | null;

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files selected. Supported: PDF, DOCX, DOC, XLSX, XLS" },
        { status: 400 }
      );
    }

    const allCreated: unknown[] = [];
    const supabase = createAdminClient();
    const { data: allEmployees } = await supabase
      .from("employees")
      .select("id, full_name, bank_account_number, sort_code, email_address, ni_number");

    for (const file of files) {
      const fileExt = file.name?.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXT.includes(fileExt)) continue;
      if (file.size > MAX_FILE_SIZE) continue;

      const buffer = Buffer.from(await file.arrayBuffer());
      const isExcel = fileExt === "xlsx" || fileExt === "xls";
      const excelRows = isExcel ? parseExcelBulk(buffer) : [];

      if (isExcel && excelRows.length > 1) {
        const stem = safeFileStem(file.name);
        const firstId = crypto.randomUUID();
        const storagePath = `salaries/${session.user.id}/${firstId}-${stem}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) continue;

        const bulkRows: Record<string, unknown>[] = [];
        const employeeUpdates: { id: string; updates: Record<string, unknown> }[] = [];
        for (const row of excelRows) {
          const matched = matchEmployee(row.employee_name ?? "", allEmployees ?? []);
          const empId = matched?.id ?? null;
          const bankAccount = row.bank_account_number ?? matched?.bank_account_number ?? null;
          const sortCode = row.sort_code
            ? (normalizeSortCode(row.sort_code) ?? row.sort_code)
            : matched?.sort_code ?? null;
          const employerTotalCost =
            row.employer_total_cost ??
            computeEmployerTotalCost(row.total_gross_pay, row.employer_pension, row.employer_ni);
          const reference = generateSalaryReference(row.process_date);
          const needsReview = !row.net_pay || row.net_pay <= 0 || !row.employee_name?.trim();
          bulkRows.push({
            id: crypto.randomUUID(),
            employee_id: empId,
            employee_name: row.employee_name ?? "Unknown",
            ni_number: matched?.ni_number ?? null,
            bank_account_number: bankAccount,
            sort_code: sortCode,
            net_pay: row.net_pay,
            total_gross_pay: row.total_gross_pay,
            employer_total_cost: employerTotalCost,
            payment_month: row.payment_month,
            payment_year: row.payment_year,
            process_date: row.process_date,
            reference: reference,
            payslip_storage_path: storagePath,
            status: needsReview ? "needs_review" : "pending",
          });
          if (matched && (bankAccount || sortCode)) {
            const upd: Record<string, unknown> = {};
            if (bankAccount && !matched.bank_account_number) upd.bank_account_number = bankAccount;
            if (sortCode && !matched.sort_code) upd.sort_code = sortCode;
            if (Object.keys(upd).length > 0) employeeUpdates.push({ id: matched.id, updates: upd });
          }
        }
        if (bulkRows.length > 0) {
          const { data: inserted, error: insertErr } = await supabase
            .from("salaries")
            .insert(bulkRows)
            .select("*, employees(full_name, email_address, bank_account_number, sort_code)");
          if (insertErr) {
            console.error("Bulk insert error:", insertErr);
          } else {
            allCreated.push(...(inserted ?? []));
          }
        }
        for (const eu of employeeUpdates) {
          await supabase.from("employees").update({ ...eu.updates, updated_at: new Date().toISOString() }).eq("id", eu.id);
        }
        continue;
      }

      const salaryId = crypto.randomUUID();
      const stem = safeFileStem(file.name);
      const storagePath = `salaries/${session.user.id}/${salaryId}-${stem}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) continue;

      let employeeName = "Unknown";
      let bankAccount: string | null = null;
      let sortCode: string | null = null;
      let niNumber: string | null = null;

      if (employee_id) {
        const { data: emp } = await supabase
          .from("employees")
          .select("full_name, bank_account_number, sort_code, ni_number")
          .eq("id", employee_id)
          .single();
        if (emp) {
          employeeName = emp.full_name ?? "Unknown";
          bankAccount = emp.bank_account_number ?? null;
          sortCode = emp.sort_code ?? null;
          niNumber = emp.ni_number ?? null;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from("salaries")
        .insert({
          id: salaryId,
          employee_id: employee_id || null,
          employee_name: employeeName,
          ni_number: niNumber,
          bank_account_number: bankAccount,
          sort_code: sortCode,
          payslip_storage_path: storagePath,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        continue;
      }

      try {
        await runSalaryExtraction(salaryId, storagePath, session.user.id);
      } catch (extractErr) {
        console.error("Salary extraction failed:", extractErr);
      }

      const { data: afterExtract } = await supabase
        .from("salaries")
        .select("employee_name, bank_account_number, sort_code")
        .eq("id", salaryId)
        .single();

      if (afterExtract?.employee_name) {
        const matched = matchEmployee(afterExtract.employee_name, allEmployees ?? []);
        const extractedBank = afterExtract.bank_account_number ?? null;
        const extractedSort = afterExtract.sort_code ?? null;

        if (matched) {
          const salaryBank = extractedBank ?? matched.bank_account_number;
          const salarySort = extractedSort ?? matched.sort_code;
          await supabase
            .from("salaries")
            .update({
              employee_id: matched.id,
              bank_account_number: salaryBank ?? undefined,
              sort_code: salarySort ?? undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", salaryId);

          const empUpdates: Record<string, unknown> = {};
          if (extractedBank && !matched.bank_account_number) empUpdates.bank_account_number = extractedBank;
          if (extractedSort && !matched.sort_code) empUpdates.sort_code = extractedSort;
          if (Object.keys(empUpdates).length > 0) {
            await supabase.from("employees").update({ ...empUpdates, updated_at: new Date().toISOString() }).eq("id", matched.id);
          }
        } else if (!employee_id) {
          await supabase
            .from("salaries")
            .update({
              bank_account_number: extractedBank ?? undefined,
              sort_code: extractedSort ?? undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", salaryId);
        }
      }

      const { data: updated } = await supabase
        .from("salaries")
        .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
        .eq("id", salaryId)
        .single();

      allCreated.push(updated ?? inserted);
    }

    const multi = files.length > 1 || allCreated.length > 1;
    return NextResponse.json({
      success: true,
      bulk: multi,
      count: allCreated.length,
      salaries: allCreated,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
