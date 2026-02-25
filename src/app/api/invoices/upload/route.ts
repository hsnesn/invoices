import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSubmissionEmail } from "@/lib/email";
import { parseGuestNameFromServiceDesc } from "@/lib/guest-utils";
import { isEmailStageEnabled, getFilteredEmailsForUserIds } from "@/lib/email-settings";
import { createAuditEvent } from "@/lib/audit";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";

const BUCKET = "invoices";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeFileStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "invoice";
}

type ManagerProfile = {
  id: string;
  department_id: string | null;
  program_ids: string[] | null;
};

function pickManager(
  managers: ManagerProfile[],
  departmentId: string | null,
  programId: string | null
): string | null {
  if (!managers.length) return null;
  if (programId) {
    const byProgram = managers.find((m) => Array.isArray(m.program_ids) && m.program_ids.includes(programId));
    if (byProgram) return byProgram.id;
  }
  if (departmentId) {
    const byDepartment = managers.find((m) => m.department_id === departmentId);
    if (byDepartment) return byDepartment.id;
  }
  return managers[0].id;
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request.headers);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }
    const { session } = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const department_id = formData.get("department_id") as string | null;
    const program_id = formData.get("program_id") as string | null;
    const useStrictUuid = process.env.DEV_BYPASS_AUTH !== "true";
    const safeDepartmentId =
      !useStrictUuid && department_id
        ? null
        : department_id && UUID_RE.test(department_id)
        ? department_id
        : null;
    const safeProgramId =
      !useStrictUuid && program_id
        ? null
        : program_id && UUID_RE.test(program_id)
        ? program_id
        : null;

    const service_description = formData.get("service_description") as string | null;
    const service_date_from = formData.get("service_date_from") as string | null;
    const service_date_to = formData.get("service_date_to") as string | null;
    const currency = (formData.get("currency") as string) || "GBP";

    const ALLOWED_MIME: Record<string, string> = {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "application/vnd.ms-excel": "xls",
    };
    const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls"];
    const fileExtFromName = file?.name?.split(".").pop()?.toLowerCase() ?? "";

    if (!file || (!ALLOWED_MIME[file.type] && !ALLOWED_EXT.includes(fileExtFromName))) {
      return NextResponse.json(
        { error: "Invalid or missing file. Supported: PDF, DOCX, DOC, XLSX, XLS" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    let managerUserId: string | null = null;
    if (safeDepartmentId) {
      const { data: dm } = await supabaseAdmin
        .from("department_managers")
        .select("manager_user_id")
        .eq("department_id", safeDepartmentId)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      managerUserId = dm?.manager_user_id ?? null;
    }
    if (!managerUserId && safeProgramId) {
      const { data: managerProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id,department_id,program_ids")
        .eq("role", "manager")
        .eq("is_active", true);
      managerUserId = pickManager(
        (managerProfiles ?? []) as ManagerProfile[],
        safeDepartmentId,
        safeProgramId
      );
    }

    const invoiceId = crypto.randomUUID();
    const ext = file.name.split(".").pop() ?? "pdf";
    const sourceStem = safeFileStem(file.name);
    const storagePath = `${session.user.id}/${invoiceId}-${sourceStem}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const mimeType = file.type || "application/octet-stream";
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      const msg = uploadError.message;
      const hint = msg.includes("fetch") || msg.includes("network")
        ? "Cannot connect to Supabase Storage. Check Supabase URL and bucket (invoices) settings."
        : "";
      return NextResponse.json(
        { error: "Upload failed: " + msg + hint },
        { status: 500 }
      );
    }

    const { error: invError } = await supabaseAdmin.from("invoices").insert({
      id: invoiceId,
      submitter_user_id: session.user.id,
      department_id: safeDepartmentId,
      program_id: safeProgramId,
      service_description: service_description || null,
      service_date_from: service_date_from || null,
      service_date_to: service_date_to || null,
      currency,
      storage_path: storagePath,
      invoice_type: "guest",
    });

    if (invError) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Invoice insert failed: " + invError.message },
        { status: 500 }
      );
    }

    const { error: wfError } = await supabaseAdmin.from("invoice_workflows").insert({
      invoice_id: invoiceId,
      status: "pending_manager",
      manager_user_id: managerUserId,
    });

    if (wfError) {
      await supabaseAdmin.from("invoices").delete().eq("id", invoiceId);
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Workflow insert failed: " + wfError.message },
        { status: 500 }
      );
    }

    // Seed extracted fields so INV Number is always visible from filename.
    await supabaseAdmin.from("invoice_extracted_fields").upsert(
      {
        invoice_id: invoiceId,
        invoice_number: file.name.replace(/\.[^.]+$/, ""),
        extracted_currency: currency,
        needs_review: true,
        manager_confirmed: false,
        raw_json: { source_file_name: file.name },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "invoice_id" }
    );

    // Server-side extraction trigger: runs right after upload.
    try {
      await runInvoiceExtraction(invoiceId, session.user.id);
    } catch {
      // Keep upload successful even if extraction fails.
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_submitted",
      from_status: null,
      to_status: "pending_manager",
      payload: { storage_path: storagePath },
    });

    const enabled = await isEmailStageEnabled("submission");
    if (enabled) {
      const managerEmails: string[] = [];
      if (managerUserId) {
        const filtered = await getFilteredEmailsForUserIds([managerUserId]);
        if (filtered.length > 0) managerEmails.push(filtered[0]);
      }
      const submitterEmails = await getFilteredEmailsForUserIds([session.user.id]);
      const submitterEmail = submitterEmails[0];
      if (submitterEmail || managerEmails.length > 0) {
        const guestName = parseGuestNameFromServiceDesc(service_description);
        const invoiceNumber = file.name.replace(/\.[^.]+$/, "");
        await sendSubmissionEmail({
          submitterEmail: submitterEmail ?? "",
          managerEmails,
          invoiceId,
          invoiceNumber: invoiceNumber || undefined,
          guestName,
        });
      }
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoiceId,
      storage_path: storagePath,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
