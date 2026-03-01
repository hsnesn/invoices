import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSubmissionEmail } from "@/lib/email";
import { parseGuestNameFromServiceDesc } from "@/lib/guest-utils";
import { buildGuestEmailDetails } from "@/lib/guest-email-details";
import { isEmailStageEnabled, isRecipientEnabled, getFilteredEmailsForUserIds } from "@/lib/email-settings";
import { createAuditEvent } from "@/lib/audit";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";
import { pickManagerForGuestInvoice } from "@/lib/manager-assignment";
import { runGuestContactSearch } from "@/lib/guest-contact-search";

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

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request);
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
    const safeDepartmentId = department_id && UUID_RE.test(department_id) ? department_id : null;
    const safeProgramId = program_id && UUID_RE.test(program_id) ? program_id : null;

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
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
    };
    const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg"];
    const fileExtFromName = file?.name?.split(".").pop()?.toLowerCase() ?? "";

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (!file || (!ALLOWED_MIME[file.type] && !ALLOWED_EXT.includes(fileExtFromName))) {
      return NextResponse.json(
        { error: "Invalid or missing file. Supported: PDF, DOCX, DOC, XLSX, XLS, JPEG" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const managerUserId = await pickManagerForGuestInvoice(
      supabaseAdmin,
      safeDepartmentId,
      safeProgramId
    );

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

    const seedInvNumber = file.name.replace(/\.[^.]+$/, "");
    const { error: txError } = await supabaseAdmin.rpc("create_invoice_with_workflow", {
      p_id: invoiceId,
      p_submitter: session.user.id,
      p_dept: safeDepartmentId,
      p_prog: safeProgramId,
      p_desc: service_description || null,
      p_date_from: service_date_from || "",
      p_date_to: service_date_to || "",
      p_currency: currency,
      p_path: storagePath,
      p_type: "guest",
      p_manager: managerUserId,
      p_filename: seedInvNumber,
      p_currency_extracted: currency,
    });

    if (txError) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Invoice creation failed: " + txError.message },
        { status: 500 }
      );
    }

    // Server-side extraction trigger: runs right after upload.
    try {
      await runInvoiceExtraction(invoiceId, session.user.id);
    } catch {
      // Keep upload successful even if extraction fails.
    }

    // Auto-trigger AI web search for guest contact (fire-and-forget)
    const guestName =
      (await supabaseAdmin.from("invoice_extracted_fields").select("beneficiary_name").eq("invoice_id", invoiceId).single()).data?.beneficiary_name?.trim() ||
      parseGuestNameFromServiceDesc(service_description);
    if (guestName && guestName.length >= 2) {
      runGuestContactSearch(guestName).catch(() => {});
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
      const sendSubmitter = await isRecipientEnabled("submission", "submitter");
      const submitterEmails = sendSubmitter ? await getFilteredEmailsForUserIds([session.user.id]) : [];
      const submitterEmail = submitterEmails[0];
      if (submitterEmail) {
        const guestName = parseGuestNameFromServiceDesc(service_description);
        const invoiceNumber = seedInvNumber;
        const deptName = safeDepartmentId
          ? ((await supabaseAdmin.from("departments").select("name").eq("id", safeDepartmentId).single()).data?.name ?? "—")
          : "—";
        const progName = safeProgramId
          ? ((await supabaseAdmin.from("programs").select("name").eq("id", safeProgramId).single()).data?.name ?? "—")
          : "—";
        const guestDetails = buildGuestEmailDetails(
          service_description,
          deptName,
          progName,
          { invoice_number: invoiceNumber || null, gross_amount: null }
        );
        await sendSubmissionEmail({
          submitterEmail,
          managerEmails: [],
          invoiceId,
          invoiceNumber: invoiceNumber || undefined,
          guestName,
          guestDetails,
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
