import { sendEmailWithAttachment } from "@/lib/email";
import type { BookingFormData, ApprovalContext } from "./types";
import { sanitizeFilenamePart } from "./pdf-generator";

const LONDON_OPS_EMAIL = "london.operations@trtworld.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const fmtCurrency = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function buildDetailsSection(data: BookingFormData): string {
  return `
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;color:#334155">
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Name:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(data.name)}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Service Description:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(data.serviceDescription)}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Department:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(data.department)}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Department 2:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(data.department2)}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Month:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(data.month)}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Days:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(data.days)}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Number of days:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${data.numberOfDays}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Service rate (per day):</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${fmtCurrency(data.serviceRatePerDay)}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Additional Cost:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${data.additionalCost > 0 ? fmtCurrency(data.additionalCost) : "—"}</td></tr>
  <tr><td style="padding:6px 0;border-bottom:1px solid #e2e8f0"><strong>Additional Cost Reason:</strong></td><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(data.additionalCostReason)}</td></tr>
  <tr><td style="padding:6px 0"><strong>Total Amount:</strong></td><td style="padding:6px 0">${fmtCurrency(data.amount)}</td></tr>
</table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapEmail(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#334155;line-height:1.6">
<div style="text-align:center;margin-bottom:20px"><img src="${APP_URL}/logo.png" alt="TRT" width="64" height="auto" style="max-width:64px;height:auto;display:inline-block" /></div>
${body}
<p style="margin-top:24px;font-size:12px;color:#64748b">TRT World London Operations</p>
</body></html>`;
}

/** Email A: To Line Manager (approver) - confirmation */
export async function sendBookingFormEmailA(
  data: BookingFormData,
  ctx: ApprovalContext,
  pdfBuffer: ArrayBuffer,
  idempotencyKey: string
): Promise<{ success: boolean; messageId?: string; error?: unknown }> {
  const to = (ctx.approverEmail || "").trim();
  if (!to) {
    return { success: false, error: "Approver email is empty - cannot send to Line Manager" };
  }
  const subject = `${data.name} – ${data.month}`;
  const details = buildDetailsSection(data);
  const body = `
<p>Dear ${escapeHtml(ctx.approverName)},</p>
<p>This is to confirm that you have approved the freelancer booking form and payment details for <strong>${escapeHtml(data.name)}</strong> for <strong>${escapeHtml(data.month)}</strong>. The approved Booking Form is attached.</p>
<h3 style="margin:16px 0 8px;font-size:15px;color:#1e293b">Booking Form Details</h3>
${details}
<p>Please note that this approval will be recorded as final acceptance for processing and audit purposes.</p>
<p>If you believe this approval was made in error or if any corrections are required, please contact <a href="mailto:${LONDON_OPS_EMAIL}">${LONDON_OPS_EMAIL}</a> immediately. Otherwise, this approval will be treated as final and recorded accordingly.</p>
<p>Kind regards,</p>
<p><strong>Attachment:</strong> Booking Form (PDF)</p>`;

  const filename = `BookingForm_${sanitizeFilenamePart(data.name)}_${sanitizeFilenamePart(data.month)}.pdf`;
  const result = await sendEmailWithAttachment({
    to,
    subject,
    html: wrapEmail(body),
    attachments: [{ filename, content: pdfBuffer }],
    idempotencyKey: `${idempotencyKey}_emailA`,
  });
  return {
    success: result.success,
    messageId: result.data?.id,
    error: result.error,
  };
}

/** Email B: To London Operations - record / filing */
export async function sendBookingFormEmailB(
  data: BookingFormData,
  ctx: ApprovalContext,
  pdfBuffer: ArrayBuffer,
  idempotencyKey: string
): Promise<{ success: boolean; messageId?: string; error?: unknown }> {
  const subject = `${data.name} – ${data.month}`;
  const approvalDateTime = ctx.approvedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const details = buildDetailsSection(data);
  const body = `
<p>Dear Operations Team,</p>
<p>The following freelancer booking form and payment details have been approved.</p>
<p><strong>Approved By:</strong> ${escapeHtml(ctx.approverName)} (${escapeHtml(ctx.approverEmail)})<br>
<strong>Approval Date:</strong> ${escapeHtml(approvalDateTime)}</p>
<h3 style="margin:16px 0 8px;font-size:15px;color:#1e293b">Booking Form Details</h3>
${details}
<p>The approved Booking Form is attached.</p>
<p>Please file/record this approval in the relevant finance and compliance folder for ${escapeHtml(data.month)}.</p>
<p>Kind regards,</p>
<p><strong>Automated Finance Workflow System</strong><br>TRT World London</p>
<p><strong>Attachment:</strong> Booking Form (PDF)</p>`;

  const filename = `BookingForm_${sanitizeFilenamePart(data.name)}_${sanitizeFilenamePart(data.month)}.pdf`;
  const result = await sendEmailWithAttachment({
    to: LONDON_OPS_EMAIL,
    subject,
    html: wrapEmail(body),
    attachments: [{ filename, content: pdfBuffer }],
    idempotencyKey: `${idempotencyKey}_emailB`,
  });
  return {
    success: result.success,
    messageId: result.data?.id,
    error: result.error,
  };
}
