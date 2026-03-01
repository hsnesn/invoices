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
<p>Alternatively, you can reply to this email with your invoice attached. Your invoice must include:</p>`
    : `<p>To process your payment as quickly as possible, please send us your invoice at your earliest convenience. Your invoice must include:</p>`;
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
  <li>Bank account details (account name, account number, sort code)</li>
  <li>PayPal address (if you prefer PayPal payment)</li>
</ul>
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
}) {
  const body = `
<p>Dear ${params.guestName},</p>
<p>Thank you for participating in <strong>${params.programName}</strong>. We truly appreciate your valuable contribution.</p>
<p>Please find attached the invoice for your payment (Invoice #${params.invoiceNumber}).</p>
<p>Payment will be made as soon as possible. Please keep this invoice for your records.</p>
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
