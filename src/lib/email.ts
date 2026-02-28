import { Resend } from "resend";
import { getLogoUrl } from "@/lib/get-logo-url";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "TRT UK Operations Platform";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${APP_NAME} <noreply@example.com>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/* ------------------------------------------------------------------ */
/* Branded email wrapper                                               */
/* ------------------------------------------------------------------ */

const DEFAULT_LOGO_URL = `${APP_URL}/logo.png`;

async function wrapWithLogo(title: string, body: string): Promise<string> {
  const logoUrl = await getLogoUrl("logo_email");
  return wrap(title, body, logoUrl);
}

function wrap(title: string, body: string, logoUrl: string = DEFAULT_LOGO_URL) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<div style="padding:16px 32px;text-align:center;border-bottom:1px solid #e2e8f0"><img src="${logoUrl}" alt="TRT" width="64" height="auto" style="max-width:64px;height:auto;display:inline-block" /></div>
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

/** Salary payment confirmation: no TRT UK Operations Platform header/footer, TRT World UK Finance Team at bottom */
function wrapSalaryPayment(body: string, logoUrl: string = DEFAULT_LOGO_URL) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<div style="padding:16px 32px;text-align:center;border-bottom:1px solid #e2e8f0"><img src="${logoUrl}" alt="TRT" width="64" height="auto" style="max-width:64px;height:auto;display:inline-block" /></div>
<div style="padding:28px 32px">
<h2 style="margin:0 0 16px;font-size:17px;color:#1e293b;font-weight:600">Salary Payment Confirmation</h2>
${body}
</div>
<div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1e293b">TRT World UK Finance Team</p>
<p style="margin:0;font-size:12px;color:#64748b;line-height:1.5">If you think there is an error, please contact <a href="mailto:london.finance@trtworld.com" style="color:#2563eb;text-decoration:none">london.finance@trtworld.com</a> immediately.</p>
</div></div></body></html>`;
}

function btn(url: string, label: string, color = "#2563eb") {
  return `<div style="text-align:center;margin:24px 0"><a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 36px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 2px 8px ${color}40">${label}</a></div>`;
}

function badge(text: string, bg: string, fg: string) {
  return `<span style="display:inline-block;background:${bg};color:${fg};padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600">${text}</span>`;
}

/** For Guest invoices: subject prefix with guest name. */
function subjectWithGuest(guestName: string | undefined, baseSubject: string): string {
  if (guestName?.trim()) return `${guestName.trim()} — ${baseSubject}`;
  return baseSubject;
}

/** Guest invoice details for email body and subject. */
export type GuestEmailDetails = {
  producer: string;
  guest: string;
  title: string;
  department: string;
  programme: string;
  topic: string;
  txDate: string;
  invoiceNumber: string;
  amount: string;
};

/** Freelancer invoice details for email body and subject. */
export type FreelancerEmailDetails = {
  companyOrPerson: string; // Company name if valid, else contractor name
  monthYear: string; // e.g. "February 2024"
  invoiceType: string;
  invoiceNumber: string;
  department: string;
  contractor: string;
  company: string;
  serviceDescription: string;
  month: string;
  daysCount: number | null;
  ratePerDay: number | null;
  additionalCost: number | null;
  totalAmount: string;
  beneficiary: string;
  accountNumber: string;
  sortCode: string;
};

/** For Freelancer invoices: subject = Company/Person — Month Year — Invoice — status. */
function subjectForFreelancer(details: FreelancerEmailDetails, statusSuffix: string): string {
  const name = details.companyOrPerson?.trim() || "Invoice";
  const my = details.monthYear?.trim() || "";
  const parts = [name];
  if (my) parts.push(my);
  parts.push("Invoice", statusSuffix);
  return parts.join(" — ");
}

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v).trim();
}
function fmtNum(v: unknown): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "—";
}

/** Build HTML table of guest invoice details (all in English). */
function buildGuestDetailsHtml(d: GuestEmailDetails): string {
  const rows = [
    ["Producer", d.producer],
    ["Guest", d.guest],
    ["Title", d.title],
    ["Department", d.department],
    ["Programme", d.programme],
    ["Topic", d.topic],
    ["TX Date", d.txDate],
    ["INV Number", d.invoiceNumber],
    ["Amount", d.amount],
  ];
  const trs = rows.map(([label, val]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#475569;width:40%">${label}</td><td style="padding:6px 12px;color:#1e293b">${fmt(val)}</td></tr>`).join("");
  return `<div style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
<table style="width:100%;border-collapse:collapse;font-size:13px">${trs}</table>
</div>`;
}

/** Build HTML table of freelancer invoice details (all in English). */
function buildFreelancerDetailsHtml(d: FreelancerEmailDetails): string {
  const rows = [
    ["Invoice Type", d.invoiceType],
    ["Invoice Number", d.invoiceNumber],
    ["Department", d.department],
    ["Contractor", d.contractor],
    ["Company", d.company],
    ["Service Description", d.serviceDescription],
    ["Month", d.month],
    ["Days Count", fmtNum(d.daysCount)],
    ["Rate per Day", d.ratePerDay != null ? `£${d.ratePerDay}` : "—"],
    ["Additional Cost", d.additionalCost != null ? `£${d.additionalCost}` : "—"],
    ["Total Amount", d.totalAmount],
    ["Beneficiary", d.beneficiary],
    ["Account Number", d.accountNumber],
    ["Sort Code", d.sortCode],
  ];
  const trs = rows.map(([label, val]) => `<tr><td style="padding:6px 12px;font-weight:600;color:#475569;width:40%">${label}</td><td style="padding:6px 12px;color:#1e293b">${fmt(val)}</td></tr>`).join("");
  return `<div style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
<table style="width:100%;border-collapse:collapse;font-size:13px">${trs}</table>
</div>`;
}

/* ------------------------------------------------------------------ */
/* Core send function                                                  */
/* ------------------------------------------------------------------ */
/* MFA OTP                                                             */
/* ------------------------------------------------------------------ */

export async function sendMfaOtpEmail(to: string, code: string): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "Email not configured" };
  }
  const html = await wrapWithLogo(
    "Verification Code",
    `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">Your verification code is:</p>
<p style="margin:0 0 24px;font-size:28px;font-weight:700;color:#1e293b;letter-spacing:4px;font-family:monospace">${code}</p>
<p style="margin:0;font-size:13px;color:#94a3b8">This code expires in 10 minutes. If you did not request this, please contact your administrator.</p>`
  );
  const res = await sendEmail({ to, subject: `${APP_NAME} Verification Code`, html });
  return res.success ? { success: true } : { success: false, error: typeof res.error === "string" ? res.error : "Failed to send" };
}

/* ------------------------------------------------------------------ */
/* Login lockout notifications                                            */
/* ------------------------------------------------------------------ */

export async function sendLoginLockoutEmailToUser(email: string): Promise<{ success: boolean }> {
  const html = await wrapWithLogo(
    "Account Locked",
    `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">Your account has been temporarily locked after 3 failed login attempts.</p>
<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">You can try again in 30 minutes. If you did not attempt to log in, please contact your administrator immediately.</p>`
  );
  const res = await sendEmail({ to: email, subject: `${APP_NAME} – Account Locked`, html });
  return { success: res.success };
}

export async function sendLoginLockoutEmailToAdmin(userEmail: string): Promise<{ success: boolean }> {
  const adminEmail = process.env.ADMIN_LOCKOUT_EMAIL ?? "london.finance@trtworld.com";
  const html = await wrapWithLogo(
    "Login Lockout Alert",
    `<p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6">The account <strong>${userEmail}</strong> has been locked after 3 failed login attempts.</p>
<p style="margin:0;font-size:13px;color:#94a3b8">Lockout duration: 30 minutes. The user has been notified by email.</p>`
  );
  const res = await sendEmail({ to: adminEmail, subject: `${APP_NAME} – Login Lockout: ${userEmail}`, html });
  return { success: res.success };
}

/* ------------------------------------------------------------------ */

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string | string[];
  bcc?: string | string[];
  fromName?: string;
  fromEmail?: string;
  attachments?: { filename: string; content: Buffer | string }[];
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set - skipping email");
    return { success: false, error: "Email not configured" };
  }
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const resend = getResend();
  if (!resend) return { success: false, error: "Email not configured" };

  let from = FROM_EMAIL;
  const configMatch = FROM_EMAIL.match(/<([^>]+)>/);
  const configEmail = configMatch ? configMatch[1] : FROM_EMAIL;
  const configDomain = configEmail.split("@")[1]?.toLowerCase();

  if (params.fromEmail?.trim() && params.fromEmail.includes("@")) {
    const reqDomain = params.fromEmail.trim().split("@")[1]?.toLowerCase();
    if (reqDomain === configDomain) {
      const displayName = params.fromName?.trim() || params.fromEmail.trim();
      from = `${displayName} <${params.fromEmail.trim()}>`;
    } else if (params.fromName?.trim()) {
      from = `${params.fromName.trim()} <${configEmail}>`;
    }
  } else if (params.fromName?.trim()) {
    from = `${params.fromName.trim()} <${configEmail}>`;
  }

  const sendParams: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    replyTo?: string | string[];
    bcc?: string | string[];
    attachments?: { filename: string; content: Buffer }[];
  } = {
    from,
    to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
    bcc: params.bcc,
  };
  if (params.attachments?.length) {
    sendParams.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content, "utf-8"),
    }));
  }
  const { data, error } = await resend.emails.send(sendParams);
  if (error) { console.error("Resend error:", error); return { success: false, error }; }
  return { success: true, data };
}

export async function sendEmailWithAttachment(params: {
  to: string | string[];
  subject: string;
  html: string;
  attachments: { filename: string; content: Buffer | ArrayBuffer }[];
  idempotencyKey?: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY not set - cannot send");
    return { success: false, error: "Email not configured (RESEND_API_KEY missing)", data: null };
  }
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const resend = getResend();
  if (!resend) return { success: false, error: "Email not configured", data: null };
  const headers: Record<string, string> = {};
  if (params.idempotencyKey) headers["Idempotency-Key"] = params.idempotencyKey;
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
    })),
    headers: Object.keys(headers).length ? headers : undefined,
  });
  if (error) {
    console.error("[Email] Resend API error:", JSON.stringify(error));
    return { success: false, error, data: null };
  }
  return { success: true, data, error: null };
}

/* ------------------------------------------------------------------ */
/* Invoice submitted                                                   */
/* ------------------------------------------------------------------ */

export async function sendSubmissionEmail(params: {
  submitterEmail: string; managerEmails: string[]; invoiceId: string; invoiceNumber?: string; guestName?: string; guestDetails?: GuestEmailDetails; freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "New invoice";
  const baseSubject = `${invLabel} — Submitted for review`;
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, "Submitted for review")
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  const to = [params.submitterEmail, ...params.managerEmails].filter((e): e is string => !!e && e.trim().length > 0);
  if (to.length === 0) return { success: false, error: "No recipients" };
  return sendEmail({
    to,
    subject,
    html: await wrapWithLogo("Invoice Submitted", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A new invoice has been submitted and is waiting for review.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Pending", "#fef3c7", "#92400e")}</p>
      ${btn(link, "View Invoice")}
      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">You received this because you are involved in this invoice's approval process.</p>
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Manager approved                                                    */
/* ------------------------------------------------------------------ */

export async function sendManagerApprovedEmail(params: {
  submitterEmail: string; adminEmails: string[]; operationsRoomEmails?: string[]; invoiceId: string; invoiceNumber?: string; managerName?: string; guestName?: string; guestDetails?: GuestEmailDetails; freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Your invoice";
  const baseSubject = params.managerName ? `${invLabel} — Approved by ${params.managerName}` : `${invLabel} — Approved`;
  const statusSuffix = params.managerName ? `Approved by ${params.managerName}` : "Approved";
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, statusSuffix)
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  const to = [
    params.submitterEmail,
    ...params.adminEmails,
    ...(params.operationsRoomEmails ?? []),
  ].filter((e): e is string => !!e && e.trim().length > 0).filter((e, i, arr) => arr.indexOf(e) === i);
  return sendEmail({
    to,
    subject,
    html: await wrapWithLogo("Invoice Approved", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Great news! The invoice has been approved${params.managerName ? ` by <strong>${params.managerName}</strong>` : ""} and is now pending review.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge(statusSuffix, "#d1fae5", "#065f46")}</p>
      ${btn(link, "View Invoice", "#059669")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Manager rejected                                                    */
/* ------------------------------------------------------------------ */

export async function sendManagerRejectedEmail(params: {
  submitterEmail: string; invoiceId: string; reason: string; invoiceNumber?: string; managerName?: string; guestName?: string; guestDetails?: GuestEmailDetails; freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Your invoice";
  const baseSubject = `${invLabel} — Rejected`;
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, "Rejected")
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  return sendEmail({
    to: params.submitterEmail,
    subject,
    html: await wrapWithLogo("Invoice Rejected", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your invoice has been rejected${params.managerName ? ` by <strong>${params.managerName}</strong>` : ""}.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      <div style="margin:16px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:13px;color:#7f1d1d"><strong>Rejection Reason:</strong> ${params.reason?.trim() || "No reason provided"}</p>
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
  submitterEmail: string; financeEmails: string[]; invoiceId: string; invoiceNumber?: string; guestName?: string; guestDetails?: GuestEmailDetails; freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  const baseSubject = `${invLabel} — Ready for payment`;
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, "Ready for payment")
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  return sendEmail({
    to: [params.submitterEmail, ...params.financeEmails],
    subject,
    html: await wrapWithLogo("Ready for Payment", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been fully approved and is now ready for payment processing.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Ready for Payment", "#dbeafe", "#1e40af")}</p>
      ${btn(link, "Process Payment", "#2563eb")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Paid                                                                */
/* ------------------------------------------------------------------ */

export async function sendPaidEmail(params: {
  submitterEmail: string; adminEmails: string[]; invoiceId: string; paymentReference?: string; invoiceNumber?: string; guestName?: string; guestDetails?: GuestEmailDetails; freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  const baseSubject = `${invLabel} — Payment completed`;
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, "Payment completed")
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  return sendEmail({
    to: [params.submitterEmail, ...params.adminEmails],
    subject,
    html: await wrapWithLogo("Payment Completed", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been paid successfully.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      ${params.paymentReference ? `<p style="margin:0 0 8px;font-size:14px;color:#334155"><strong>Payment Reference:</strong> ${params.paymentReference}</p>` : ""}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Paid", "#d1fae5", "#065f46")}</p>
      ${btn(link, "View Invoice", "#059669")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Manager assigned to invoice                                         */
/* ------------------------------------------------------------------ */

export async function sendManagerAssignedEmail(params: {
  managerEmail: string;
  invoiceId: string;
  invoiceNumber?: string;
  assignedByName?: string;
  guestName?: string;
  guestDetails?: GuestEmailDetails;
  freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  const baseSubject = `${invLabel} — Assigned to you for review`;
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, "Assigned to you for review")
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  return sendEmail({
    to: params.managerEmail,
    subject,
    html: await wrapWithLogo("Invoice Assigned to You", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">You have been assigned${params.assignedByName ? ` by <strong>${params.assignedByName}</strong>` : ""} to review this invoice.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Pending", "#fef3c7", "#92400e")}</p>
      ${btn(link, "Review Invoice", "#f59e0b")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Resubmitted (after rejection fix)                                   */
/* ------------------------------------------------------------------ */

export async function sendResubmittedEmail(params: {
  managerEmails: string[]; invoiceId: string; invoiceNumber?: string; submitterName?: string; guestName?: string; guestDetails?: GuestEmailDetails; freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  const baseSubject = `${invLabel} — Resubmitted after correction`;
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, "Resubmitted after correction")
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  return sendEmail({
    to: params.managerEmails,
    subject,
    html: await wrapWithLogo("Invoice Resubmitted", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A previously rejected invoice has been corrected and resubmitted${params.submitterName ? ` by <strong>${params.submitterName}</strong>` : ""} for your review.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Pending", "#fef3c7", "#92400e")}</p>
      ${btn(link, "Review Invoice", "#f59e0b")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* SLA reminder: invoice pending too long                             */
/* ------------------------------------------------------------------ */

export type PendingInvoiceItem = {
  invoiceId: string;
  invoiceNumber?: string;
  guestOrContractor: string;
  amount: string;
  daysPending: number;
};

export async function sendSlaReminderEmail(params: {
  managerEmail: string;
  managerName?: string;
  slaDays: number;
  items: PendingInvoiceItem[];
}) {
  const link = `${APP_URL}/invoices`;
  const rows = params.items.map(
    (i) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0"><a href="${APP_URL}/invoices/${i.invoiceId}" style="color:#2563eb;text-decoration:none">${i.invoiceNumber ? `#${i.invoiceNumber}` : i.invoiceId.slice(0, 8)}</a></td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i.guestOrContractor}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i.amount}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i.daysPending} days</td></tr>`
  ).join("");
  const table = `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Invoice</th><th style="padding:8px 12px;text-align:left">Guest/Contractor</th><th style="padding:8px 12px;text-align:left">Amount</th><th style="padding:8px 12px;text-align:left">Pending</th></tr></thead><tbody>${rows}</tbody></table>`;
  return sendEmail({
    to: params.managerEmail,
    subject: `${params.items.length} invoice(s) overdue for your approval (${params.slaDays}+ days)`,
    html: await wrapWithLogo("Approval Reminder", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Hi${params.managerName ? ` ${params.managerName}` : ""},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The following invoice(s) have been pending your approval for more than <strong>${params.slaDays} days</strong>. Please review and approve or reject them.</p>
      <div style="margin:16px 0">${table}</div>
      ${btn(link, "View Pending Invoices", "#f59e0b")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Pending digest: daily/weekly summary for managers                  */
/* ------------------------------------------------------------------ */

export async function sendPendingDigestEmail(params: {
  managerEmail: string;
  managerName?: string;
  periodLabel: string;
  items: PendingInvoiceItem[];
}) {
  const link = `${APP_URL}/invoices`;
  const rows = params.items.map(
    (i) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0"><a href="${APP_URL}/invoices/${i.invoiceId}" style="color:#2563eb;text-decoration:none">${i.invoiceNumber ? `#${i.invoiceNumber}` : i.invoiceId.slice(0, 8)}</a></td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i.guestOrContractor}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i.amount}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${i.daysPending}d</td></tr>`
  ).join("");
  const table = `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Invoice</th><th style="padding:8px 12px;text-align:left">Guest/Contractor</th><th style="padding:8px 12px;text-align:left">Amount</th><th style="padding:8px 12px;text-align:left">Pending</th></tr></thead><tbody>${rows}</tbody></table>`;
  return sendEmail({
    to: params.managerEmail,
    subject: `${params.periodLabel}: ${params.items.length} invoice(s) awaiting your approval`,
    html: await wrapWithLogo("Pending Invoices Summary", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Hi${params.managerName ? ` ${params.managerName}` : ""},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Here is your ${params.periodLabel.toLowerCase()} summary of invoices awaiting your approval.</p>
      <div style="margin:16px 0">${table}</div>
      ${btn(link, "Review Invoices", "#2563eb")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Admin approved (ready for payment)                                  */
/* ------------------------------------------------------------------ */

export async function sendAdminApprovedEmail(params: {
  submitterEmail: string; financeEmails: string[]; invoiceId: string; invoiceNumber?: string; adminName?: string; guestName?: string; guestDetails?: GuestEmailDetails; freelancerDetails?: FreelancerEmailDetails;
}) {
  const link = `${APP_URL}/invoices/${params.invoiceId}`;
  const invLabel = params.invoiceNumber ? `#${params.invoiceNumber}` : "Invoice";
  const baseSubject = `${invLabel} — Admin approved, ready for payment`;
  const statusSuffix = "Admin approved, ready for payment";
  const subject = params.freelancerDetails
    ? subjectForFreelancer(params.freelancerDetails, statusSuffix)
    : subjectWithGuest(params.guestName, baseSubject);
  const detailsBlock = params.freelancerDetails
    ? buildFreelancerDetailsHtml(params.freelancerDetails)
    : params.guestDetails
    ? buildGuestDetailsHtml(params.guestDetails)
    : "";
  return sendEmail({
    to: [params.submitterEmail, ...params.financeEmails],
    subject,
    html: await wrapWithLogo("Admin Approved", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The invoice has been approved by admin${params.adminName ? ` (<strong>${params.adminName}</strong>)` : ""} and is now ready for payment.</p>
      ${params.invoiceNumber && !params.freelancerDetails && !params.guestDetails ? `<p style="margin:0 0 12px;font-size:14px;color:#334155"><strong>Invoice:</strong> #${params.invoiceNumber}</p>` : ""}
      ${detailsBlock}
      <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Ready for Payment", "#dbeafe", "#1e40af")}</p>
      ${btn(link, "Process Payment", "#2563eb")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Salary payment confirmation                                         */
/* ------------------------------------------------------------------ */

export type SalaryForEmail = {
  employee_name: string | null;
  net_pay: number | null;
  total_gross_pay: number | null;
  paye_tax: number | null;
  employee_ni: number | null;
  employer_pension: number | null;
  paid_date: string | null;
  reference: string | null;
  payment_month: string | null;
  payment_year: number | null;
};

function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return "—";
  return `£${Number(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function sendSalaryPaymentConfirmationEmail(params: {
  to: string;
  salary: SalaryForEmail;
  payslipBuffer?: Buffer | null;
  payslipFilename?: string;
}): Promise<{ success: boolean; error?: string }> {
  const s = params.salary;
  const month = s.payment_month ?? "Salary";
  const year = s.payment_year ? ` ${s.payment_year}` : "";
  const subject = `${month}${year} Salary Payment Confirmation`;

  const rows = [
    ["Employee", fmt(s.employee_name)],
    ["Net Pay", fmtCurrency(s.net_pay)],
    ["Gross Pay", fmtCurrency(s.total_gross_pay)],
    ["Tax Deducted", fmtCurrency(s.paye_tax)],
    ["NI Deducted", fmtCurrency(s.employee_ni)],
    ["Employer Pension", fmtCurrency(s.employer_pension)],
    ["Payment Date", fmt(s.paid_date)],
    ["Reference", fmt(s.reference)],
  ];
  const tableRows = rows
    .map(
      ([label, val]) =>
        `<tr><td style="padding:6px 12px;font-weight:600;color:#475569;width:40%">${label}</td><td style="padding:6px 12px;color:#1e293b">${val}</td></tr>`
    )
    .join("");
  const detailsBlock = `<div style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
<table style="width:100%;border-collapse:collapse;font-size:13px">${tableRows}</table>
</div>`;

  const logoUrl = await getLogoUrl("logo_email");
  const html = wrapSalaryPayment(
    `
    <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your salary payment has been processed successfully.</p>
    ${detailsBlock}
    <p style="margin:0 0 16px;font-size:14px;color:#334155">Status: ${badge("Paid", "#d1fae5", "#065f46")}</p>
  `,
    logoUrl
  );

  if (params.payslipBuffer && params.payslipBuffer.length > 0) {
    const attachments = [
      {
        filename: params.payslipFilename ?? "payslip.pdf",
        content: params.payslipBuffer,
      },
    ];
    const result = await sendEmailWithAttachment({
      to: params.to,
      subject,
      html,
      attachments,
    });
    return { success: result.success, error: result.error as string | undefined };
  }

  const result = await sendEmail({ to: params.to, subject, html });
  return { success: result.success, error: result.error as string | undefined };
}

/* ------------------------------------------------------------------ */
/* Contractor availability submitted → London Operations               */
/* ------------------------------------------------------------------ */

const LONDON_OPS_EMAIL = "london.operations@trtworld.com";

export async function sendAvailabilityClearedEmail(params: {
  to: string;
  monthLabel: string;
}): Promise<{ success: boolean }> {
  const link = `${APP_URL}/contractor-availability`;
  const res = await sendEmail({
    to: params.to,
    subject: `Availability cancelled — ${params.monthLabel}`,
    html: await wrapWithLogo("Availability Cancelled", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your submitted availability for <strong>${params.monthLabel}</strong> has been cleared by an administrator.</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">If you need to submit your availability again, please do so in My Availability.</p>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8"><a href="${link}" style="color:#2563eb;text-decoration:none">Go to My Availability →</a></p>
    `),
  });
  return { success: res.success };
}

export async function sendContractorAvailabilitySubmittedEmail(params: {
  to: string;
  replyTo: string;
  personName: string;
  personEmail: string;
  role: string;
  monthLabel: string;
  dates: string[];
}) {
  const datesList = params.dates.length > 0
    ? params.dates.map((d) => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })).join(", ")
    : "—";
  const roleLabel = params.role?.trim() ? ` (${params.role})` : "";
  return sendEmail({
    to: params.to,
    replyTo: params.replyTo,
    subject: `Contractor availability: ${params.personName} — ${params.monthLabel}${roleLabel}`,
    html: await wrapWithLogo("Contractor Availability Submitted", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A contractor has submitted their availability for role <strong>${params.role || "—"}</strong>.</p>
      <div style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:8px 12px;font-weight:600;color:#475569;width:30%">Name</td><td style="padding:8px 12px;color:#1e293b">${params.personName}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#475569">Email (reply to)</td><td style="padding:8px 12px;color:#1e293b"><a href="mailto:${params.personEmail}">${params.personEmail}</a></td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#475569">Role</td><td style="padding:8px 12px;color:#1e293b">${params.role || "—"}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#475569">Month</td><td style="padding:8px 12px;color:#1e293b">${params.monthLabel}</td></tr>
          <tr><td style="padding:8px 12px;font-weight:600;color:#475569">Available days</td><td style="padding:8px 12px;color:#1e293b">${datesList}</td></tr>
        </table>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Reply to this email to contact the contractor directly.</p>
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Weekly requirements digest (Friday → next week's list)              */
/* ------------------------------------------------------------------ */

export async function sendWeeklyRequirementsDigestEmail(params: {
  to: string;
  weekLabel: string;
  requirements: { date: string; role: string; count_needed: number }[];
}) {
  const byDate = new Map<string, { role: string; count: number }[]>();
  for (const r of params.requirements) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push({ role: r.role, count: r.count_needed });
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  const rows = sortedDates
    .map(
      (d) =>
        `<tr><td style="padding:8px 12px;color:#1e293b">${new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td><td style="padding:8px 12px;color:#1e293b">${byDate.get(d)!.map((x) => `${x.role}: ${x.count}`).join(", ")}</td></tr>`
    )
    .join("");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const requestUrl = `${appUrl}/request`;
  return sendEmail({
    to: params.to,
    replyTo: LONDON_OPS_EMAIL,
    subject: `Next week's requirements — ${params.weekLabel}`,
    html: await wrapWithLogo("Next Week's Requirements", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Here is the scheduled demand for next week:</p>
      <div style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Date</th><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Roles (count needed)</th></tr>
          ${rows}
        </table>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8"><a href="${requestUrl}" style="color:#2563eb;text-decoration:none">View and manage in My Availability → Request</a></p>
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Contractor assignment confirmed → person gets email                */
/* ------------------------------------------------------------------ */

export async function sendContractorAssignmentsPendingEmail(params: {
  to: string;
  monthLabel: string;
  count: number;
  reviewUrl: string;
  assignments?: { personName: string; date: string; role: string }[];
}) {
  const tableHtml =
    params.assignments && params.assignments.length > 0
      ? `<div style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Date</th><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Person</th><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Role</th></tr>
          ${params.assignments
            .map(
              (a) =>
                `<tr><td style="padding:8px 12px;color:#1e293b">${new Date(a.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td><td style="padding:8px 12px;color:#1e293b">${a.personName}</td><td style="padding:8px 12px;color:#1e293b">${a.role}</td></tr>`
            )
            .join("")}
        </table>
      </div>`
      : "";
  return sendEmail({
    to: params.to,
    replyTo: LONDON_OPS_EMAIL,
    subject: `Contractor assignments pending review — ${params.monthLabel}`,
    html: await wrapWithLogo("Assignments Pending Review", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">AI has suggested <strong>${params.count}</strong> contractor assignments for ${params.monthLabel}.</p>
      ${tableHtml}
      <p style="margin:16px 0 12px;font-size:14px;color:#334155;line-height:1.6">Please review, edit if needed, and approve to send confirmation emails to contractors.</p>
      ${btn(params.reviewUrl, "Review Assignments", "#10b981")}
    `),
  });
}

export async function sendContractorReminderEmail(params: {
  to: string;
  personName: string;
  dateLabel: string;
  role: string;
}) {
  return sendEmail({
    to: params.to,
    replyTo: LONDON_OPS_EMAIL,
    subject: `Reminder: You are booked tomorrow (${params.role}) — ${params.dateLabel}`,
    html: await wrapWithLogo("Schedule Reminder", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Hi${params.personName ? ` ${params.personName}` : ""},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">This is a reminder that you are booked for <strong>${params.dateLabel}</strong> as <strong>${params.role}</strong>.</p>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">If you have any questions, please contact London Operations.</p>
    `),
  });
}

export async function sendContractorAssignmentConfirmedEmail(params: {
  to: string;
  personName: string;
  monthLabel: string;
  datesWithRole: { date: string; role: string }[];
  calendarUrl?: string;
}) {
  const rows =
    params.datesWithRole.length > 0
      ? params.datesWithRole
          .map(
            (d) =>
              `<tr><td style="padding:6px 12px;color:#065f46">${new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })}</td><td style="padding:6px 12px;font-weight:600;color:#065f46">${d.role}</td></tr>`
          )
          .join("")
      : "";
  const tableHtml =
    rows.length > 0
      ? `<div style="margin:16px 0;padding:16px;background:#ecfdf5;border-radius:8px;border-left:4px solid #10b981">
        <table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="padding:6px 12px;text-align:left;font-weight:600;color:#065f46">Date</th><th style="padding:6px 12px;text-align:left;font-weight:600;color:#065f46">Role</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`
      : "";
  const calendarBtn = params.calendarUrl
    ? `<div style="text-align:center;margin:20px 0"><a href="${params.calendarUrl}" style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 2px 8px rgba(16,185,129,0.4)">Add to calendar (.ics)</a></div><p style="margin:0 0 12px;font-size:12px;color:#64748b;text-align:center">Download and add these dates to your calendar app</p>`
    : "";
  return sendEmail({
    to: params.to,
    replyTo: LONDON_OPS_EMAIL,
    subject: `Your schedule is confirmed — ${params.monthLabel}`,
    html: await wrapWithLogo("Schedule Confirmed", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Hi${params.personName ? ` ${params.personName}` : ""},</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your schedule for <strong>${params.monthLabel}</strong> has been confirmed. You are booked for the following days:</p>
      ${tableHtml}
      ${calendarBtn}
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">If you have any questions, please contact London Operations.</p>
    `),
  });
}

/** Copy of booking confirmation summary to London Operations. */
export async function sendContractorAssignmentConfirmedToLondonOps(params: {
  monthLabel: string;
  byPerson: { name: string; email: string; datesWithRole: { date: string; role: string }[] }[];
}) {
  const rows = params.byPerson
    .map(
      (p) =>
        `<tr><td style="padding:8px 12px;color:#1e293b">${p.name}</td><td style="padding:8px 12px;color:#64748b">${p.email}</td><td style="padding:8px 12px;color:#1e293b">${p.datesWithRole.map((d) => `${new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })} (${d.role})`).join(", ")}</td></tr>`
    )
    .join("");
  return sendEmail({
    to: LONDON_OPS_EMAIL,
    subject: `Contractor schedule confirmed — ${params.monthLabel}`,
    html: await wrapWithLogo("Schedule Confirmed (Copy)", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">The following contractor assignments have been confirmed for <strong>${params.monthLabel}</strong>:</p>
      <div style="margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Name</th><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Email</th><th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">Booked days (role)</th></tr>
          ${rows}
        </table>
      </div>
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
    html: await wrapWithLogo("Reset Your Password", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">We received a request to reset your password. Click the button below to set a new password.</p>
      ${btn(params.resetLink, "Reset Password", "#6366f1")}
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Office request: approved, rejected, assigned, completed             */
/* ------------------------------------------------------------------ */

export async function sendOfficeRequestApprovedEmail(params: {
  to: string;
  title: string;
  assigneeName?: string | null;
  link: string;
}) {
  const assigneeNote = params.assigneeName
    ? `<p style="margin:0 0 12px;font-size:14px;color:#475569">Assigned to: <strong>${params.assigneeName}</strong></p>`
    : "";
  return sendEmail({
    to: params.to,
    subject: `Request approved: ${params.title} — ${APP_NAME}`,
    html: await wrapWithLogo("Request Approved", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your office request has been approved.</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">${params.title}</p>
      ${assigneeNote}
      ${btn(params.link, "View Request", "#2563eb")}
    `),
  });
}

export async function sendOfficeRequestRejectedEmail(params: {
  to: string;
  title: string;
  rejectionReason?: string | null;
  link: string;
}) {
  const reasonBlock = params.rejectionReason
    ? `<div style="margin:12px 0;padding:12px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 8px 8px 0"><p style="margin:0;font-size:13px;color:#7f1d1d"><strong>Reason:</strong> ${params.rejectionReason}</p></div>`
    : "";
  return sendEmail({
    to: params.to,
    subject: `Request rejected: ${params.title} — ${APP_NAME}`,
    html: await wrapWithLogo("Request Rejected", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your office request has been rejected.</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">${params.title}</p>
      ${reasonBlock}
      ${btn(params.link, "View Request", "#dc2626")}
    `),
  });
}

export async function sendOfficeRequestAssignedEmail(params: {
  to: string;
  title: string;
  dueDate?: string | null;
  link: string;
}) {
  const dueNote = params.dueDate
    ? `<p style="margin:0 0 12px;font-size:14px;color:#475569">Due date: <strong>${params.dueDate}</strong></p>`
    : "";
  return sendEmail({
    to: params.to,
    subject: `You have been assigned: ${params.title} — ${APP_NAME}`,
    html: await wrapWithLogo("Task Assigned to You", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">You have been assigned to this office request.</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">${params.title}</p>
      ${dueNote}
      ${btn(params.link, "View Request", "#059669")}
    `),
  });
}

export async function sendOfficeRequestCompletedToAdminEmail(params: {
  to: string;
  title: string;
  requesterName: string;
  completedByName: string;
  link: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Request completed: ${params.title} — ${APP_NAME}`,
    html: await wrapWithLogo("Request Completed (Notification)", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">An office request has been completed.</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">${params.title}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#475569">Requester: <strong>${params.requesterName}</strong></p>
      <p style="margin:0 0 12px;font-size:14px;color:#475569">Completed by: <strong>${params.completedByName}</strong></p>
      ${btn(params.link, "View Request", "#10b981")}
    `),
  });
}

export async function sendOfficeRequestCompletedEmail(params: {
  to: string;
  title: string;
  description?: string | null;
  completionNotes?: string | null;
  link: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Request completed: ${params.title} — ${APP_NAME}`,
    html: await wrapWithLogo("Request Completed", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">Your office request has been completed.</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">${params.title}</p>
      ${params.description ? `<p style="margin:0 0 12px;font-size:14px;color:#64748b">${params.description}</p>` : ""}
      ${params.completionNotes ? `<p style="margin:0 0 12px;font-size:14px;color:#475569;background:#f8fafc;padding:12px;border-radius:8px;border-left:4px solid #10b981"><strong>Completion notes:</strong> ${params.completionNotes}</p>` : ""}
      ${btn(params.link, "View Request")}
    `),
  });
}

/* ------------------------------------------------------------------ */
/* Reminder due (office reminders: fire extinguisher, etc.)            */
/* ------------------------------------------------------------------ */

export async function sendReminderDueEmail(params: {
  to: string;
  title: string;
  description?: string | null;
  nextDueDate: string;
  link: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Reminder due: ${params.title} — ${APP_NAME}`,
    html: await wrapWithLogo("Reminder Due", `
      <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.6">A reminder is due today.</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1e293b">${params.title}</p>
      ${params.description ? `<p style="margin:0 0 12px;font-size:14px;color:#64748b">${params.description}</p>` : ""}
      <p style="margin:0 0 12px;font-size:14px;color:#475569"><strong>Due date:</strong> ${params.nextDueDate}</p>
      ${btn(params.link, "View Reminders")}
    `),
  });
}
