import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
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

type ManagerProfile = { id: string; department_id: string | null; program_ids: string[] | null };

function pickManager(managers: ManagerProfile[], departmentId: string | null, programId: string | null): string | null {
  if (!managers.length) return null;
  if (programId) {
    const byProgram = managers.find((m) => Array.isArray(m.program_ids) && m.program_ids.includes(programId));
    if (byProgram) return byProgram.id;
  }
  if (departmentId) {
    const byDept = managers.find((m) => m.department_id === departmentId);
    if (byDept) return byDept.id;
  }
  return managers[0].id;
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const department_id = formData.get("department_id") as string | null;
    const program_id = formData.get("program_id") as string | null;
    const currency = (formData.get("currency") as string) || "GBP";

    const safeDeptId = department_id && UUID_RE.test(department_id) ? department_id : null;
    const safeProgId = program_id && UUID_RE.test(program_id) ? program_id : null;

    const contractor_name = formData.get("contractor_name") as string | null;
    const company_name = formData.get("company_name") as string | null;
    const service_description = formData.get("service_description") as string | null;
    const service_days_count = formData.get("service_days_count") as string | null;
    const service_days = formData.get("service_days") as string | null;
    const service_rate_per_day = formData.get("service_rate_per_day") as string | null;
    const service_month = formData.get("service_month") as string | null;
    const additional_cost = formData.get("additional_cost") as string | null;
    const additional_cost_reason = formData.get("additional_cost_reason") as string | null;
    const booked_by = formData.get("booked_by") as string | null;
    const department_2 = formData.get("department_2") as string | null;
    const istanbul_team = formData.get("istanbul_team") as string | null;

    const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls"];
    const fileExtFromName = file?.name?.split(".").pop()?.toLowerCase() ?? "";
    if (!file || !ALLOWED_EXT.includes(fileExtFromName)) {
      return NextResponse.json({ error: "Invalid or missing file. Supported: PDF, DOCX, DOC, XLSX, XLS" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: managerProfiles } = await supabase.from("profiles").select("id,department_id,program_ids").eq("role", "manager").eq("is_active", true);
    const managerUserId = pickManager((managerProfiles ?? []) as ManagerProfile[], safeDeptId, safeProgId);

    const invoiceId = crypto.randomUUID();
    const ext = file.name.split(".").pop() ?? "pdf";
    const sourceStem = safeFileStem(file.name);
    const storagePath = `${session.user.id}/${invoiceId}-${sourceStem}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });

    const descParts = [
      `Contractor: ${contractor_name ?? ""}`,
      `Company Name: ${company_name ?? ""}`,
      `Service Description: ${service_description ?? ""}`,
      `Service Days: ${service_days_count ?? ""}`,
      `Rate/Day: ${service_rate_per_day ?? ""}`,
      `Month: ${service_month ?? ""}`,
    ].join("\n");

    const { error: invError } = await supabase.from("invoices").insert({
      id: invoiceId,
      submitter_user_id: session.user.id,
      department_id: safeDeptId,
      program_id: safeProgId,
      service_description: descParts,
      currency,
      storage_path: storagePath,
      invoice_type: "freelancer",
    });
    if (invError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Invoice insert failed: " + invError.message }, { status: 500 });
    }

    const { error: wfError } = await supabase.from("invoice_workflows").insert({ invoice_id: invoiceId, status: "pending_manager", manager_user_id: managerUserId });
    if (wfError) {
      await supabase.from("invoices").delete().eq("id", invoiceId);
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Workflow insert failed: " + wfError.message }, { status: 500 });
    }

    await supabase.from("invoice_extracted_fields").upsert(
      { invoice_id: invoiceId, invoice_number: file.name.replace(/\.[^.]+$/, ""), extracted_currency: currency, needs_review: true, manager_confirmed: false, raw_json: { source_file_name: file.name }, updated_at: new Date().toISOString() },
      { onConflict: "invoice_id" }
    );

    await supabase.from("freelancer_invoice_fields").insert({
      invoice_id: invoiceId,
      contractor_name: contractor_name || null,
      company_name: company_name || null,
      service_description: service_description || null,
      service_days_count: service_days_count ? parseInt(service_days_count) : null,
      service_days: service_days || null,
      service_rate_per_day: service_rate_per_day ? parseFloat(service_rate_per_day) : null,
      service_month: service_month || null,
      additional_cost: additional_cost ? parseFloat(additional_cost) : null,
      additional_cost_reason: additional_cost_reason || null,
      booked_by: booked_by || null,
      department_2: department_2 || null,
      istanbul_team: istanbul_team || null,
    });

    try {
      await runInvoiceExtraction(invoiceId, session.user.id);

      const { data: extracted } = await supabase
        .from("invoice_extracted_fields")
        .select("beneficiary_name, gross_amount")
        .eq("invoice_id", invoiceId)
        .single();

      if (extracted) {
        const flUpdate: Record<string, unknown> = {};
        if (extracted.beneficiary_name && !company_name) {
          flUpdate.company_name = extracted.beneficiary_name;
        }
        if (Object.keys(flUpdate).length > 0) {
          await supabase.from("freelancer_invoice_fields").update(flUpdate).eq("invoice_id", invoiceId);
        }
      }
    } catch { /* keep upload successful */ }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_submitted",
      from_status: null,
      to_status: "pending_manager",
      payload: { storage_path: storagePath, invoice_type: "freelancer" },
    });

    return NextResponse.json({ success: true, invoice_id: invoiceId });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
