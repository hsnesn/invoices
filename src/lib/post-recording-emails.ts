/**
 * Emails sent when producer marks guest as accepted (post-recording).
 */
import { sendEmail, sendEmailWithAttachment } from "./email";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "TRT UK Operations Platform";

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px">
${body}
<p style="margin-top:24px;color:#64748b;font-size:12px">${APP_NAME}</p>
</body></html>`;
}

const PAYMENT_TIMELINE = "Payment is typically made within 10–14 working days after invoice approval.";

/** Guest receives payment: thank for program, request invoice with requirements. */
export async function sendPostRecordingPaidRequestInvoice(params: {
  to: string;
  guestName: string;
  programName: string;
  amount: string;
  currency: string;
  recordingDate: string;
  recordingTopic: string;
  producerName: string;
  submitLink?: string;
}) {
  const submitSection = params.submitLink
    ? `<p><strong>Submit your invoice online:</strong> <a href="${params.submitLink}" style="color:#2563eb;font-weight:600">Click here to upload your invoice</a>. This link is valid for 7 days.</p>
<p>${PAYMENT_TIMELINE}</p>
<p>Alternatively, you can reply to this email with your invoice attached. Your invoice must include:</p>`
    : `<p>To process your payment as quickly as possible, please send us your invoice at your earliest convenience. ${PAYMENT_TIMELINE}</p>
<p>Your invoice must include:</p>`;
  const body = `
<p>Dear ${params.guestName},</p>
<p>Thank you for participating in <strong>${params.programName}</strong>. We truly appreciate your valuable contribution and insights on ${params.recordingTopic}.</p>
<p>As agreed, you will receive ${params.amount} ${params.currency} for your appearance.</p>
${submitSection}
<ul>
  <li>Invoice date</li>
  <li>Invoice number</li>
  <li>Date when the program was recorded (${params.recordingDate})</li>
  <li>Topic of the program (${params.recordingTopic})</li>
  <li>Bank account details: UK – account name, account number, sort code; International – account name, IBAN, SWIFT/BIC</li>
  <li>PayPal address (if you prefer PayPal payment)</li>
</ul>
${params.currency !== "GBP" ? `<div style="margin-top:12px;padding:12px 16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;color:#92400e;font-size:14px">
  <strong>International payment:</strong> Include your IBAN and SWIFT/BIC (not UK sort code). PayPal is often faster for overseas payments.
</div>` : ""}
<p>We look forward to receiving it.</p>
<p>Best regards,<br/>${params.producerName}</p>
`;
  return sendEmail({
    to: params.to,
    subject: `Thank you – ${params.programName} – Invoice requested`,
    html: wrap(body),
  });
}

/** Guest receives payment + producer generated invoice: thank you, invoice attached, payment soon, keep for records. */
export async function sendPostRecordingWithInvoice(params: {
  to: string;
  guestName: string;
  programName: string;
  invoiceNumber: string;
  pdfBuffer: ArrayBuffer | Buffer | Uint8Array;
  producerName: string;
  statusLink?: string;
}) {
  const statusSection = params.statusLink
    ? `<p>You can check the status of your invoice at any time: <a href="${params.statusLink}" style="color:#2563eb;font-weight:600">Check invoice status</a>.</p>`
    : "";
  const body = `
<p>Dear ${params.guestName},</p>
<p>Thank you for participating in <strong>${params.programName}</strong>. We truly appreciate your valuable contribution.</p>
<p>Please find attached the invoice for your payment (Invoice #${params.invoiceNumber}).</p>
${statusSection}
<p>${PAYMENT_TIMELINE} Please keep this invoice for your records.</p>
<p>Best regards,<br/>${params.producerName}</p>
`;
  const buf = params.pdfBuffer instanceof Uint8Array ? Buffer.from(params.pdfBuffer) : params.pdfBuffer;
  return sendEmailWithAttachment({
    to: params.to,
    subject: `Thank you – ${params.programName} – Invoice #${params.invoiceNumber}`,
    html: wrap(body),
    attachments: [
      {
        filename: `Invoice_${params.invoiceNumber}.pdf`,
        content: buf,
      },
    ],
  });
}

/** Send invoice PDF to producer (e.g. when guest generates via link). */
export async function sendInvoiceToProducer(params: {
  to: string;
  producerName: string;
  guestName: string;
  programName: string;
  invoiceNumber: string;
  pdfBuffer: ArrayBuffer | Buffer | Uint8Array;
}) {
  const body = `
<p>Dear ${params.producerName},</p>
<p>Please find attached the invoice for <strong>${params.guestName}</strong> (${params.programName}).</p>
<p>The invoice has been submitted to the system and is pending manager approval.</p>
<p>Best regards,<br/>${APP_NAME}</p>
`;
  const buf = params.pdfBuffer instanceof Uint8Array ? Buffer.from(params.pdfBuffer) : params.pdfBuffer;
  return sendEmailWithAttachment({
    to: params.to,
    subject: `Invoice #${params.invoiceNumber} – ${params.guestName} – ${params.programName}`,
    html: wrap(body),
    attachments: [
      {
        filename: `Invoice_${params.invoiceNumber}.pdf`,
        content: buf,
      },
    ],
  });
}

/** Notify producer that guest requested a new invoice link (used or expired). */
export async function sendGuestRequestedNewLinkEmail(params: {
  to: string;
  producerName: string;
  guestName: string;
  guestEmail: string | null;
  programName: string;
  producerGuestId: string;
}) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resendLink = `${APP_URL}/invoices/invited-guests?resend=${params.producerGuestId}`;
  const body = `
<p>Dear ${params.producerName},</p>
<p><strong>${params.guestName}</strong>${params.guestEmail ? ` (${params.guestEmail})` : ""} has requested a new invoice submission link for <strong>${params.programName}</strong>.</p>
<p>The previous link may have expired or already been used.</p>
<p><a href="${resendLink}" style="color:#2563eb;font-weight:600">Click here to send a new link</a> (you will need to log in).</p>
<p>Best regards,<br/>${APP_NAME}</p>
`;
  return sendEmail({
    to: params.to,
    subject: `New link requested – ${params.guestName} – ${params.programName}`,
    html: wrap(body),
  });
}

/** Notify guest when their invoice has been paid. */
export async function sendGuestPaidEmail(params: {
  to: string;
  guestName: string;
  programName: string;
  invoiceNumber: string;
  paidDate?: string;
  paymentReference?: string;
  statusLink: string;
}) {
  const paidDateStr = params.paidDate
    ? new Date(params.paidDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const body = `
<p>Dear ${params.guestName},</p>
<p>We are pleased to confirm that payment for your invoice for <strong>${params.programName}</strong> has been completed.</p>
<p><strong>Invoice reference:</strong> ${params.invoiceNumber}</p>
${paidDateStr ? `<p><strong>Paid on:</strong> ${paidDateStr}</p>` : ""}
${params.paymentReference ? `<p><strong>Payment reference:</strong> ${params.paymentReference}</p>` : ""}
<p>You can view your invoice at any time: <a href="${params.statusLink}" style="color:#2563eb;font-weight:600">Check invoice status</a>.</p>
<p>Thank you for your contribution.</p>
<p>Best regards,<br/>${APP_NAME}</p>
`;
  return sendEmail({
    to: params.to,
    subject: `Payment completed – ${params.programName} – ${params.invoiceNumber}`,
    html: wrap(body),
  });
}

/** Send status link to guest when they request a new one (e.g. lost link). */
export async function sendStatusLinkEmail(params: {
  to: string;
  guestName: string;
  programName: string;
  invoiceNumber: string;
  statusLink: string;
}) {
  const body = `
<p>Dear ${params.guestName},</p>
<p>As requested, here is a new link to check the status of your invoice for <strong>${params.programName}</strong>.</p>
<p><strong>Invoice reference:</strong> ${params.invoiceNumber}</p>
<p><a href="${params.statusLink}" style="color:#2563eb;font-weight:600">Check invoice status</a></p>
<p>${PAYMENT_TIMELINE}</p>
<p>Best regards,<br/>${APP_NAME}</p>
`;
  return sendEmail({
    to: params.to,
    subject: `Invoice status link – ${params.programName} – ${params.invoiceNumber}`,
    html: wrap(body),
  });
}

/** Confirmation email to guest after they submit an invoice (upload or generate). */
export async function sendGuestSubmissionConfirmation(params: {
  to: string;
  guestName: string;
  programName: string;
  invoiceNumber: string;
  statusLink: string;
  producerName: string;
}) {
  const body = `
<p>Dear ${params.guestName},</p>
<p>Thank you for submitting your invoice for <strong>${params.programName}</strong>.</p>
<p><strong>Invoice reference:</strong> ${params.invoiceNumber}</p>
<p>You can check the status of your invoice at any time: <a href="${params.statusLink}" style="color:#2563eb;font-weight:600">Check invoice status</a>.</p>
<p>${PAYMENT_TIMELINE}</p>
<p>If you have any questions, please contact ${params.producerName}.</p>
<p>Best regards,<br/>${APP_NAME}</p>
`;
  return sendEmail({
    to: params.to,
    subject: `Invoice received – ${params.programName} – ${params.invoiceNumber}`,
    html: wrap(body),
  });
}

/** Reminder email to guest if they haven't submitted within a few days of receiving the link. */
export async function sendGuestInvoiceReminderEmail(params: {
  to: string;
  guestName: string;
  programName: string;
  submitLink: string;
  producerName: string;
}) {
  const body = `
<p>Dear ${params.guestName},</p>
<p>This is a friendly reminder to submit your invoice for <strong>${params.programName}</strong>.</p>
<p><a href="${params.submitLink}" style="color:#2563eb;font-weight:600">Click here to submit your invoice</a>. This link is valid for 7 days from when it was sent.</p>
<p>If you have already submitted, please disregard this email. If you need a new link, please contact ${params.producerName}.</p>
<p>Best regards,<br/>${APP_NAME}</p>
`;
  return sendEmail({
    to: params.to,
    subject: `Reminder – Submit your invoice – ${params.programName}`,
    html: wrap(body),
  });
}

/** Guest does not receive payment: thank you, contribution was valuable. */
export async function sendPostRecordingNoPayment(params: {
  to: string;
  guestName: string;
  programName: string;
  recordingTopic: string;
  producerName: string;
}) {
  const body = `
<p>Dear ${params.guestName},</p>
<p>Thank you for participating in <strong>${params.programName}</strong>. We truly appreciate your valuable contribution.</p>
<p>Your insights and analysis on ${params.recordingTopic} were very helpful and greatly enriched our programme. Thank you for sharing your expertise with our audience.</p>
<p>Best regards,<br/>${params.producerName}</p>
`;
  return sendEmail({
    to: params.to,
    subject: `Thank you – ${params.programName}`,
    html: wrap(body),
  });
}
