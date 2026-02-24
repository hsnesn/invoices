/**
 * Approval trigger: runs when a manager/admin approves a freelancer invoice.
 * 1. Generate Booking Form PDF
 * 2. Save form to storage (form is "created" first)
 * 3. Send Email A to approver (with PDF)
 * 4. Send Email B to london.operations@trtworld.com (with PDF)
 * 5. Log both sends with idempotency
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBookingFormPdf, sanitizeFilenamePart } from "./pdf-generator";
import { sendBookingFormEmailA, sendBookingFormEmailB } from "./email-sender";
import {
  buildIdempotencyKey,
  checkIdempotency,
  createAuditRecord,
  updateAuditRecord,
} from "./audit-logger";
import type { BookingFormData, ApprovalContext } from "./types";

export type TriggerResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

/**
 * Load freelancer invoice data and build BookingFormData.
 */
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

function isTableNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("booking_form_email_audit") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("not find")
  );
}

/**
 * Trigger the Booking Form email workflow when a freelancer invoice is approved.
 * Idempotent: same invoice_id + approved_at will not send duplicates (when audit table exists).
 */
export async function triggerBookingFormWorkflow(
  supabase: SupabaseClient,
  params: {
    invoiceId: string;
    approverUserId: string;
    approverName: string;
    approverEmail: string;
    approvedAt: Date;
  }
): Promise<TriggerResult> {
  // Skip if booking form was already created for this invoice (first approval only)
  try {
    const { data: existingForInvoice } = await supabase
      .from("booking_form_email_audit")
      .select("id")
      .eq("invoice_id", params.invoiceId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (existingForInvoice) {
      return { ok: true, skipped: true };
    }
  } catch {
    /* table may not exist */
  }

  const idempotencyKey = buildIdempotencyKey(params.invoiceId, params.approvedAt);
  let auditId: string | null = null;
  let useAudit = true;

  let existing: Awaited<ReturnType<typeof checkIdempotency>> = null;
  try {
    existing = await checkIdempotency(supabase, idempotencyKey);
  } catch {
    existing = null;
  }
  if (existing) {
    return { ok: true, skipped: true };
  }

  const formData = await loadBookingFormData(
    supabase,
    params.invoiceId,
    params.approverName,
    params.approvedAt
  );

  if (!formData) {
    return { ok: false, error: "Could not load freelancer invoice data" };
  }

  if (useAudit) {
    const createResult = await createAuditRecord(supabase, {
      invoiceId: params.invoiceId,
      approverUserId: params.approverUserId,
      approvedAt: params.approvedAt,
      idempotencyKey,
    });

    if ("error" in createResult) {
      if (createResult.error === "duplicate") return { ok: true, skipped: true };
      if (isTableNotFoundError(createResult.error)) {
        useAudit = false;
      } else {
        return { ok: false, error: createResult.error };
      }
    } else {
      auditId = createResult.id;
    }
  }

  const ctx: ApprovalContext = {
    invoiceId: params.invoiceId,
    approverUserId: params.approverUserId,
    approverName: params.approverName,
    approverEmail: params.approverEmail,
    approvedAt: params.approvedAt,
  };

  const errors: string[] = [];
  const BUCKET = "invoices";

  try {
    // 1. Generate form (PDF) first
    const pdfBuffer = generateBookingFormPdf(formData);

    // 2. Save form to storage before sending emails
    const filename = `BookingForm_${sanitizeFilenamePart(formData.name)}_${sanitizeFilenamePart(formData.month)}.pdf`;
    const storagePath = `booking-forms/${params.invoiceId}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) {
      console.error("[BookingForm] Storage upload failed:", uploadError);
      errors.push(`Form save: ${uploadError.message}`);
      // Continue to send emails even if storage fails (PDF is in memory)
    }

    // 3. Send emails (after form is created)
    const resultA = await sendBookingFormEmailA(formData, ctx, pdfBuffer, idempotencyKey);
    const emailASentAt = resultA.success ? new Date() : null;
    if (!resultA.success) {
      const errA = String(resultA.error);
      errors.push(`Email A (Line Manager): ${errA}`);
      console.error("[BookingForm] Email A failed:", errA, "| approverEmail:", ctx.approverEmail ? "(set)" : "(empty)");
    }

    const resultB = await sendBookingFormEmailB(formData, ctx, pdfBuffer, idempotencyKey);
    const emailBSentAt = resultB.success ? new Date() : null;
    if (!resultB.success) {
      const errB = String(resultB.error);
      errors.push(`Email B (London Ops): ${errB}`);
      console.error("[BookingForm] Email B failed:", errB);
    }

    if (useAudit && auditId) {
      try {
        await updateAuditRecord(supabase, auditId, {
          emailASentAt,
          emailBSentAt,
          status: errors.length === 0 ? "completed" : "failed",
          errors: errors.length ? errors.join("; ") : null,
        });
      } catch {
        /* audit table may not exist */
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: errors.join("; ") };
    }
    return { ok: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (useAudit && auditId) {
      try {
        await updateAuditRecord(supabase, auditId, {
          status: "failed",
          errors: errMsg,
        });
      } catch {
        /* audit table may not exist */
      }
    }
    return { ok: false, error: errMsg };
  }
}
