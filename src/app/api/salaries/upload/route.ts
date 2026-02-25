import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { runSalaryExtraction } from "@/lib/salary-extraction";
import stringSimilarity from "string-similarity";

const BUCKET = "invoices";
const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls"];

function safeFileStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "payslip";
}

/** POST /api/salaries/upload - Upload payslip PDF, create salary record, run AI extraction */
export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request.headers);
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
    const file = formData.get("file") as File | null;
    const employee_id = formData.get("employee_id") as string | null;

    const fileExt = file?.name?.split(".").pop()?.toLowerCase() ?? "";
    if (!file || !ALLOWED_EXT.includes(fileExt)) {
      return NextResponse.json(
        { error: "Invalid or missing file. Supported: PDF, DOCX, DOC, XLSX, XLS" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const salaryId = crypto.randomUUID();
    const stem = safeFileStem(file.name);
    const storagePath = `salaries/${session.user.id}/${salaryId}-${stem}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    let employeeName = "Unknown";
    let bankAccount: string | null = null;
    let sortCode: string | null = null;
    let emailAddress: string | null = null;
    let niNumber: string | null = null;

    if (employee_id) {
      const { data: emp } = await supabase
        .from("employees")
        .select("full_name, bank_account_number, sort_code, email_address, ni_number")
        .eq("id", employee_id)
        .single();
      if (emp) {
        employeeName = emp.full_name ?? "Unknown";
        bankAccount = emp.bank_account_number ?? null;
        sortCode = emp.sort_code ?? null;
        emailAddress = emp.email_address ?? null;
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
      return NextResponse.json(
        { error: "Failed to create salary record: " + insertError.message },
        { status: 500 }
      );
    }

    try {
      await runSalaryExtraction(salaryId, storagePath, session.user.id);
    } catch (extractErr) {
      console.error("Salary extraction failed:", extractErr);
    }

    const { data: afterExtract } = await supabase
      .from("salaries")
      .select("employee_name")
      .eq("id", salaryId)
      .single();

    if (afterExtract?.employee_name && !employee_id) {
      const { data: allEmployees } = await supabase
        .from("employees")
        .select("id, full_name, bank_account_number, sort_code, email_address");

      const extractedNorm = afterExtract.employee_name.replace(/\b(Mr|Mrs|Ms|Dr)\.?\s*/gi, "").trim().toLowerCase();
      const empList = allEmployees ?? [];
      let matched: (typeof empList)[number] | null = null;

      for (const emp of empList) {
        const dbNorm = (emp.full_name ?? "").trim().toLowerCase();
        if (dbNorm === extractedNorm || extractedNorm.includes(dbNorm) || dbNorm.includes(extractedNorm)) {
          matched = emp;
          break;
        }
        const sim = stringSimilarity.compareTwoStrings(extractedNorm, dbNorm);
        if (sim >= 0.75 && (!matched || sim > stringSimilarity.compareTwoStrings(extractedNorm, (matched.full_name ?? "").toLowerCase()))) {
          matched = emp;
        }
      }

      if (matched) {
        await supabase
          .from("salaries")
          .update({
            employee_id: matched.id,
            bank_account_number: matched.bank_account_number ?? undefined,
            sort_code: matched.sort_code ?? undefined,
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

    return NextResponse.json({
      success: true,
      salary: updated ?? inserted,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
