/**
 * Process pending booking form emails (called by cron 30s after form creation).
 * Claims pending records, loads PDF from storage, sends emails.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingFormEmailA, sendBookingFormEmailB } from "./email-sender";
import { updateAuditRecord } from "./audit-logger";
import { generateBookingFormPdf } from "./pdf-generator";
import type { BookingFormData, ApprovalContext } from "./types";

const BUCKET = "invoices";

async function loadBookingFormData(
  supabase: SupabaseClient,
  invoiceId: string,
  approverName: string,
  approvedAt: Date
): Promise<BookingFormData | null> {
  const { data: inv } = await supabase
    .from("invoices")
    .select(`
      id, department_id,
      freelancer_invoice_fields(contractor_name, company_name, service_description, service_days_count, service_days, service_rate_per_day, service_month, additional_cost, additional_cost_reason, booked_by, department_2)
    `)
    .eq("id", invoiceId)
    .eq("invoice_type", "freelancer")
    .single();

  if (!inv) return null;

  const flRaw = (inv as Record<string, unknown>).freelancer_invoice_fields;
  const fl = Array.isArray(flRaw) ? flRaw[0] : flRaw;
  const flObj = fl as Record<string, unknown> | null;
  if (!flObj) return null;

  const contractorName = (flObj.contractor_name as string) ?? "—";
  const companyRaw = (flObj.company_name as string) ?? "—";
  const companyName = !companyRaw || /trt/i.test(companyRaw) ? "—" : companyRaw;
  const displayName =
    companyName !== "—"
      ? `${companyName} ${contractorName !== "—" ? contractorName : ""}`.trim()
      : contractorName;

  const serviceDays = Number(flObj.service_days_count) || 0;
  const rate = Number(flObj.service_rate_per_day) || 0;
  const additionalCost = Number(flObj.additional_cost) || 0;
  const totalAmount = serviceDays * rate + additionalCost;

  let deptName = "—";
  if (inv.department_id) {
    const { data: dept } = await supabase
      .from("departments")
      .select("name")
      .eq("id", inv.department_id)
      .single();
    deptName = dept?.name ?? "—";
  }

  let serviceMonth = (flObj.service_month as string) ?? "—";
  if (serviceMonth !== "—" && !/\d{4}/.test(serviceMonth)) {
    serviceMonth = `${serviceMonth} ${approvedAt.getFullYear()}`;
  }

  const approvalDate = approvedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return {
    name: displayName,
    serviceDescription: (flObj.service_description as string) ?? "—",
    amount: totalAmount,
    department: deptName,
    department2: (flObj.department_2 as string) ?? "—",
    numberOfDays: serviceDays,
    month: serviceMonth,
    days: (flObj.service_days as string) ?? "—",
    serviceRatePerDay: rate,
    additionalCost,
    additionalCostReason: (flObj.additional_cost_reason as string) ?? "",
    approverName,
    bookedBy: (flObj.booked_by as string) ?? "—",
    approvalDate,
  };
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
}

export async function processPendingBookingFormEmails(): Promise<{ processed: number; errors: string[] }> {
  const supabase = createAdminClient();
  const errors: string[] = [];
  let processed = 0;

  // Claim pending records (created 30+ seconds ago)
  const { data: pending, error: fetchError } = await supabase
    .from("booking_form_email_audit")
    .select("id, invoice_id, approver_user_id, approved_at, idempotency_key")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 30_000).toISOString())
    .limit(20);

  if (fetchError) {
    errors.push(fetchError.message);
    return { processed: 0, errors };
  }

  if (!pending?.length) return { processed: 0, errors: [] };

  for (const row of pending) {
    const { id: auditId, invoice_id, approver_user_id, approved_at, idempotency_key } = row;
    const approvedAt = new Date(approved_at);

    // Claim: set status to processing (avoids double processing)
    const { data: claimed, error: claimError } = await supabase
      .from("booking_form_email_audit")
      .update({ status: "processing" })
      .eq("id", auditId)
      .eq("status", "pending")
      .select("id");

    if (claimError || !claimed?.length) continue; // Another process claimed it or error

    const approverProfile = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", approver_user_id)
      .single();
    const approverUser = (await supabase.auth.admin.getUserById(approver_user_id)).data?.user;

    const formData = await loadBookingFormData(
      supabase,
      invoice_id,
      approverProfile.data?.full_name ?? "Approver",
      approvedAt
    );

    if (!formData) {
      await updateAuditRecord(supabase, auditId, {
        status: "failed",
        errors: "Could not load form data",
      });
      errors.push(`Invoice ${invoice_id}: load failed`);
      continue;
    }

    // Load PDF from storage
    const filename = `BookingForm_${sanitizeFilenamePart(formData.name)}_${sanitizeFilenamePart(formData.month)}.pdf`;
    const storagePath = `booking-forms/${invoice_id}/${filename}`;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (downloadError || !fileData) {
      await updateAuditRecord(supabase, auditId, {
        status: "failed",
        errors: `PDF not found: ${downloadError?.message ?? "unknown"}`,
      });
      errors.push(`Invoice ${invoice_id}: PDF download failed`);
      continue;
    }

    const pdfBuffer = await fileData.arrayBuffer();
    const ctx: ApprovalContext = {
      invoiceId: invoice_id,
      approverUserId: approver_user_id,
      approverName: formData.approverName,
      approverEmail: approverUser?.email ?? "",
      approvedAt,
    };

    const resultA = await sendBookingFormEmailA(formData, ctx, pdfBuffer, idempotency_key);
    const emailASentAt = resultA.success ? new Date() : null;
    const errA = !resultA.success ? String(resultA.error) : "";

    const resultB = await sendBookingFormEmailB(formData, ctx, pdfBuffer, idempotency_key);
    const emailBSentAt = resultB.success ? new Date() : null;
    const errB = !resultB.success ? String(resultB.error) : "";

    const allOk = resultA.success && resultB.success;
    const errMsgs = [errA, errB].filter(Boolean);
    if (!allOk) errors.push(`Invoice ${invoice_id}: ${errMsgs.join("; ")}`);

    await updateAuditRecord(supabase, auditId, {
      emailASentAt,
      emailBSentAt,
      status: allOk ? "completed" : "failed",
      errors: allOk ? null : errMsgs.join("; "),
    });

    processed++;
  }

  return { processed, errors };
}

/**
 * Send booking form emails immediately for an invoice (manual trigger).
 * Generates PDF from current data and sends to Line Manager + London Operations.
 */
export async function sendBookingFormEmailsForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: wf } = await supabase
    .from("invoice_workflows")
    .select("manager_user_id")
    .eq("invoice_id", invoiceId)
    .single();

  if (!wf) return { ok: false, error: "Workflow not found" };

  const approverUserId = (wf.manager_user_id as string) || "";
  const approvedAt = new Date();

  const approverProfile = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", approverUserId)
    .single();
  const approverUser = (await supabase.auth.admin.getUserById(approverUserId)).data?.user;

  const formData = await loadBookingFormData(
    supabase,
    invoiceId,
    approverProfile.data?.full_name ?? "Approver",
    approvedAt
  );

  if (!formData) return { ok: false, error: "Could not load form data" };

  const pdfBuffer = generateBookingFormPdf(formData);
  const idempotencyKey = `manual_${invoiceId}_${Date.now()}`;
  const ctx: ApprovalContext = {
    invoiceId,
    approverUserId,
    approverName: formData.approverName,
    approverEmail: approverUser?.email ?? "",
    approvedAt,
  };

  const resultA = await sendBookingFormEmailA(formData, ctx, pdfBuffer, idempotencyKey);
  const resultB = await sendBookingFormEmailB(formData, ctx, pdfBuffer, idempotencyKey);

  if (!resultA.success) return { ok: false, error: `Email A: ${String(resultA.error)}` };
  if (!resultB.success) return { ok: false, error: `Email B: ${String(resultB.error)}` };

  // Mark audit as completed so cron doesn't resend
  const { data: audit } = await supabase
    .from("booking_form_email_audit")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (audit) {
    await updateAuditRecord(supabase, audit.id, {
      emailASentAt: new Date(),
      emailBSentAt: new Date(),
      status: "completed",
    });
  }

  return { ok: true };
}
