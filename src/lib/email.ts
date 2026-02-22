import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Invoice System <noreply@example.com>";
const APP_NAME = "Invoice Approval Workflow";

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set - skipping email");
    return { success: false, error: "Email not configured" };
  }
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    console.error("Resend error:", error);
    return { success: false, error };
  }
  return { success: true, data };
}

export async function sendSubmissionEmail(params: {
  submitterEmail: string;
  managerEmails: string[];
  invoiceId: string;
  invoiceNumber?: string;
}) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invoices/${params.invoiceId}`;
  return sendEmail({
    to: [params.submitterEmail, ...params.managerEmails],
    subject: `[${APP_NAME}] New invoice submitted`,
    html: `
      <p>A new invoice${params.invoiceNumber ? ` (#${params.invoiceNumber})` : ""} has been submitted.</p>
      <p><a href="${link}">View invoice</a></p>
    `,
  });
}

export async function sendManagerApprovedEmail(params: {
  submitterEmail: string;
  adminEmails: string[];
  invoiceId: string;
  invoiceNumber?: string;
}) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invoices/${params.invoiceId}`;
  return sendEmail({
    to: [params.submitterEmail, ...params.adminEmails],
    subject: `[${APP_NAME}] Invoice approved by manager`,
    html: `
      <p>An invoice${params.invoiceNumber ? ` (#${params.invoiceNumber})` : ""} has been approved by the manager and is pending admin review.</p>
      <p><a href="${link}">View invoice</a></p>
    `,
  });
}

export async function sendManagerRejectedEmail(params: {
  submitterEmail: string;
  invoiceId: string;
  reason: string;
  invoiceNumber?: string;
}) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/submit?rejected=${params.invoiceId}`;
  return sendEmail({
    to: params.submitterEmail,
    subject: `[${APP_NAME}] Invoice rejected`,
    html: `
      <p>Your invoice${params.invoiceNumber ? ` (#${params.invoiceNumber})` : ""} has been rejected.</p>
      <p><strong>Reason:</strong> ${params.reason}</p>
      <p><a href="${link}">Resubmit invoice</a></p>
    `,
  });
}

export async function sendReadyForPaymentEmail(params: {
  submitterEmail: string;
  financeEmails: string[];
  invoiceId: string;
  invoiceNumber?: string;
}) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invoices/${params.invoiceId}`;
  return sendEmail({
    to: [params.submitterEmail, ...params.financeEmails],
    subject: `[${APP_NAME}] Invoice ready for payment`,
    html: `
      <p>An invoice${params.invoiceNumber ? ` (#${params.invoiceNumber})` : ""} has been marked ready for payment.</p>
      <p><a href="${link}">View invoice</a></p>
    `,
  });
}

export async function sendPaidEmail(params: {
  submitterEmail: string;
  adminEmails: string[];
  invoiceId: string;
  paymentReference?: string;
  invoiceNumber?: string;
}) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invoices/${params.invoiceId}`;
  return sendEmail({
    to: [params.submitterEmail, ...params.adminEmails],
    subject: `[${APP_NAME}] Invoice paid`,
    html: `
      <p>Invoice${params.invoiceNumber ? ` #${params.invoiceNumber}` : ""} has been marked as paid${params.paymentReference ? ` (ref: ${params.paymentReference})` : ""}.</p>
      <p><a href="${link}">View invoice</a></p>
    `,
  });
}
