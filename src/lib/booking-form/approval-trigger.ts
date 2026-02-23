/**
 * Approval trigger: runs when Line Manager approves a freelancer invoice.
 * 1. Generate Booking Form PDF
 * 2. Send Email A to approver (with PDF)
 * 3. Send Email B to london.operations@trtworld.com (with PDF)
 * 4. Log both sends with idempotency
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateBookingFormPdf } from "./pdf-generator";
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
  const companyName = (flObj.company_name as string) ?? "—";
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

  const approvalDate = approvedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
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

/**
 * Trigger the Booking Form email workflow when a freelancer invoice is approved by Line Manager.
 * Idempotent: same invoice_id + approved_at will not send duplicates.
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
  const idempotencyKey = buildIdempotencyKey(params.invoiceId, params.approvedAt);

  const existing = await checkIdempotency(supabase, idempotencyKey);
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

  const createResult = await createAuditRecord(supabase, {
    invoiceId: params.invoiceId,
    approverUserId: params.approverUserId,
    approvedAt: params.approvedAt,
    idempotencyKey,
  });

  if ("error" in createResult) {
    if (createResult.error === "duplicate") return { ok: true, skipped: true };
    return { ok: false, error: createResult.error };
  }

  const auditId = createResult.id;
  const ctx: ApprovalContext = {
    invoiceId: params.invoiceId,
    approverUserId: params.approverUserId,
    approverName: params.approverName,
    approverEmail: params.approverEmail,
    approvedAt: params.approvedAt,
  };

  const errors: string[] = [];

  try {
    const pdfBuffer = generateBookingFormPdf(formData);

    const resultA = await sendBookingFormEmailA(formData, ctx, pdfBuffer, idempotencyKey);
    const emailASentAt = resultA.success ? new Date() : null;
    if (!resultA.success) {
      errors.push(`Email A: ${String(resultA.error)}`);
    }

    const resultB = await sendBookingFormEmailB(formData, ctx, pdfBuffer, idempotencyKey);
    const emailBSentAt = resultB.success ? new Date() : null;
    if (!resultB.success) {
      errors.push(`Email B: ${String(resultB.error)}`);
    }

    const status = errors.length === 0 ? "completed" : "failed";
    await updateAuditRecord(supabase, auditId, {
      emailASentAt,
      emailBSentAt,
      status,
      errors: errors.length ? errors.join("; ") : null,
    });

    if (errors.length > 0) {
      return { ok: false, error: errors.join("; ") };
    }
    return { ok: true };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await updateAuditRecord(supabase, auditId, {
      status: "failed",
      errors: errMsg,
    });
    return { ok: false, error: errMsg };
  }
}
