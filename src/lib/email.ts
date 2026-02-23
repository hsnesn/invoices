import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Invoice System <noreply@example.com>";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Invoice Approval Workflow";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/* ------------------------------------------------------------------ */
/* Branded email wrapper                                               */
/* ------------------------------------------------------------------ */

function wrap(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:24px 32px;text-align:center">
<h1 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">${APP_NAME}</h1>
</div>
<div style="padding:28px 32px">
<h2 style="margin:0 0 16px;font-size:17px;color:#1e293b;font-weight:600">${title}</h2>
${body}
</div>
<div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
<p style="margin:0;font-size:11px;color:#94a3b8">${APP_NAME} &middot; <a href="${APP_URL}" style="color:#64748b;text-decoration:none">${APP_URL.replace("https://", "")}</a></p>
</div></div></body></html>`;
}

function btn(url: string, label: string, color = "#2563eb") {
  return `<div style="text-align:center;margin:24px 0"><a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 36px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 2px 8px ${color}40">${label}</a></div>`;
}

function badge(text: string, bg: string, fg: string) {
  return `<span style="display:inline-block;background:${bg};color:${fg};padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600">${text}</span>`;
}

/* ------------------------------------------------------------------ */
/* Core send function                                                  */
/* ------------------------------------------------------------------ */

export async function sendEmail(params: { to: string | string[]; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set - skipping email");
    return { success: false, error: "Email not configured" };
  }
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const resend = getResend();
  if (!resend) return { success: false, error: "Email not configured" };
  const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to, subject: params.subject, html: params.html });
  if (error) { console.error("Resend error:", error); return { success: false, error }; }
  return { success: true, data };
}

/* ------------------------------------------------------------------ */
/* Invoice submitted                                                   */
/* ------------------------------------------------------------------ */

export async function sendSubmissionEmail(params: {
  submitterEmail: string; managerEmails: string[]; invoiceId: string; invoiceNumber?: string;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "New invoice";
  return sendEmail({
    to: [params.submitterEmail, ...params.managerEmails],
    subject: `${invLabel} — Submitted for review`,
    html: wrap("Invoice Submitted", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A new invoice has been submitted and is awaiting manager review.</p>
      ${params.invoiceNumber ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Pending Manager", "#fef3c7", "#92400e")}</p>
      ${btn(link, "View Invoice")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">You received this because you are involved in this invoice's approval process.</p>
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Manager approved                                                    */
/* ------------------------------------------------------------------ */

export async function sendManagerApprovedEmail(params: {
  submitterEmail: string; adminEmails: string[]; invoiceId: string; invoiceNumber?: string; managerName?: string;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Your invoice";
  return sendEmail({
    to: [params.submitterEmail, ...params.adminEmails],
    subject: `${invLabel} — Approved by manager`,
    html: wrap("Invoice Approved", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Great news! The invoice has been approved by the line manager${params.managerName ? ` (<strong>${params.managerName}</strong>)` : ""} and is now pending admin review.</p>
      ${params.invoiceNumber ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Approved by Manager", "#d1fae5", "#065f46")}</p>
      ${btn(link, "View Invoice", "#059669")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Manager rejected                                                    */
/* ------------------------------------------------------------------ */

export async function sendManagerRejectedEmail(params: {
  submitterEmail: string; invoiceId: string; reason: string; invoiceNumber?: string; managerName?: string;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Your invoice";
  return sendEmail({
    to: params.submitterEmail,
    subject: `${invLabel} — Rejected`,
    html: wrap("Invoice Rejected", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your invoice has been rejected${params.managerName ? ` by <strong>${params.managerName}</strong>` : ""}.</p>
      ${params.invoiceNumber ? `<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      <div style="margin:16px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:13px;color:#7f1d1d"><strong>Reason:</strong> ${params.reason}</p>
      </div>
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Rejected", "#fecaca", "#991b1b")}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#334155">You can make corrections and resubmit the invoice.</p>
      ${btn(link, "View & Resubmit", "#dc2626")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Ready for payment                                                   */
/* ------------------------------------------------------------------ */

export async function sendReadyForPaymentEmail(params: {
  submitterEmail: string; financeEmails: string[]; invoiceId: string; invoiceNumber?: string;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  return sendEmail({
    to: [params.submitterEmail, ...params.financeEmails],
    subject: `${invLabel} — Ready for payment`,
    html: wrap("Ready for Payment", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been fully approved and is now ready for payment processing.</p>
      ${params.invoiceNumber ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Ready for Payment", "#dbeafe", "#1e40af")}</p>
      ${btn(link, "Process Payment", "#2563eb")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Paid                                                                */
/* ------------------------------------------------------------------ */

export async function sendPaidEmail(params: {
  submitterEmail: string; adminEmails: string[]; invoiceId: string; paymentReference?: string; invoiceNumber?: string;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  return sendEmail({
    to: [params.submitterEmail, ...params.adminEmails],
    subject: `${invLabel} — Payment completed`,
    html: wrap("Payment Completed", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been paid successfully.</p>
      ${params.invoiceNumber ? `<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${params.paymentReference ? `<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Payment Ref:</strong> ${params.paymentReference}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Paid", "#d1fae5", "#065f46")}</p>
      ${btn(link, "View Invoice", "#059669")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Resubmitted (after rejection fix)                                   */
/* ------------------------------------------------------------------ */

export async function sendResubmittedEmail(params: {
  managerEmails: string[]; invoiceId: string; invoiceNumber?: string; submitterName?: string;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  return sendEmail({
    to: params.managerEmails,
    subject: `${invLabel} — Resubmitted after correction`,
    html: wrap("Invoice Resubmitted", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A previously rejected invoice has been corrected and resubmitted${params.submitterName ? ` by <strong>${params.submitterName}</strong>` : ""} for your review.</p>
      ${params.invoiceNumber ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Pending Manager", "#fef3c7", "#92400e")}</p>
      ${btn(link, "Review Invoice", "#f59e0b")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Admin approved (ready for payment)                                  */
/* ------------------------------------------------------------------ */

export async function sendAdminApprovedEmail(params: {
  submitterEmail: string; financeEmails: string[]; invoiceId: string; invoiceNumber?: string; adminName?: string;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  return sendEmail({
    to: [params.submitterEmail, ...params.financeEmails],
    subject: `${invLabel} — Admin approved, ready for payment`,
    html: wrap("Admin Approved", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been approved by admin${params.adminName ? ` (<strong>${params.adminName}</strong>)` : ""} and is now ready for payment.</p>
      ${params.invoiceNumber ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Ready for Payment", "#dbeafe", "#1e40af")}</p>
      ${btn(link, "Process Payment", "#2563eb")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Password reset                                                      */
/* ------------------------------------------------------------------ */

export async function sendPasswordResetEmail(params: { email: string; resetLink: string }) {
  return sendEmail({
    to: params.email,
    subject: `Password Reset — ${APP_NAME}`,
    html: wrap("Reset Your Password", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">We received a request to reset your password. Click the button below to set a new password.</p>
      ${btn(params.resetLink, "Reset Password", "#6366f1")}
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}
