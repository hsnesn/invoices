import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";
import type { BookingFormData } from "./types";

const fmtCurrency = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Generate Booking Form PDF with exact field labels per spec.
 * Fields: Name, Service Description, Amount, Department, Department 2,
 * Number of days, Month, Days, Service rate (per day), Additional Cost, Additional Cost Reason.
 */
export function generateBookingFormPdf(data: BookingFormData): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const mx = 20;
  const cw = pw - 2 * mx;

  let logoData: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "trt-world-logo.png");
    const buf = fs.readFileSync(logoPath);
    logoData = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    /* logo not found */
  }

  let y = 15;

  if (logoData) {
    const logoW = 100;
    const logoH = 20;
    const logoX = (pw - logoW) / 2;
    const pad = 4;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(logoX - pad, y - pad, logoW + pad * 2, logoH + pad * 2, 3, 3, "F");
    doc.addImage(logoData, "PNG", logoX, y, logoW, logoH);
    y += logoH + 12;
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text('TRT WORLD LONDON "DAILY" FREELANCE BOOKING FORM', pw / 2, y, { align: "center" });
  y += 12;

  const fields: [string, string][] = [
    ["Name", data.name],
    ["Service Description", data.serviceDescription],
    ["Amount", fmtCurrency(data.amount)],
    ["Department", data.department],
    ["Department 2", data.department2],
    ["Number of days", String(data.numberOfDays)],
    ["Month", data.month],
    ["Days", data.days],
    ["Service rate (per day)", fmtCurrency(data.serviceRatePerDay)],
    ["Additional Cost", data.additionalCost > 0 ? fmtCurrency(data.additionalCost) : ""],
    ["Additional Cost Reason", data.additionalCostReason],
  ];

  const labelW = 58;
  const valX = mx + labelW;
  const valW = cw - labelW;
  const rowH = 9;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);

  for (const [label, value] of fields) {
    doc.setFillColor(245, 247, 250);
    doc.rect(mx, y, labelW, rowH, "FD");
    doc.setFillColor(255, 255, 255);
    doc.rect(valX, y, valW, rowH, "FD");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(label, mx + 3, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(value || "", valX + 3, y + 6);

    y += rowH;
  }

  y += 10;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80, 80, 80);
  doc.text(
    "This form is filled, duly signed and the details above are understood by both parties.",
    pw / 2,
    y,
    { align: "center" }
  );

  y += 14;

  doc.setFillColor(55, 65, 81);
  doc.rect(mx, y, cw, 8, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("FOR INTERNAL USE ONLY", pw / 2, y + 5.5, { align: "center" });
  y += 14;

  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const internalFields: [string, string][] = [
    ["Booked by", data.bookedBy !== "—" ? data.bookedBy : ""],
    ["Approved by", data.approverName],
    ["Date and time of approval", data.approvalDate],
  ];

  for (const [label, value] of internalFields) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, mx, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, mx + 45, y);
    y += 7;
  }

  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("For billing, please address invoice to:", mx, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  const billingLines = [
    "TRT World UK",
    "200 Gray's Inn Road",
    "WC1X 8XZ London-UK",
    "",
    "Attention: Mr. Hasan Esen",
    "Email: hasanesen@trt.net.tr",
  ];
  for (const line of billingLines) {
    doc.text(line, mx, y);
    y += 5.5;
  }

  y += 8;

  doc.setFillColor(254, 243, 199);
  doc.roundedRect(mx, y, cw, 28, 2, 2, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(180, 83, 9);
  doc.text("IMPORTANT NOTICE", mx + 3, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 53, 15);
  const notice =
    "*Invoices will be settled on the last day of the following month from the date in which they were sent (Example: invoices filed on any given day during June, will be settled on the last day of July - and so on and so forth).";
  const noticeLines = doc.splitTextToSize(notice, cw - 6);
  doc.text(noticeLines, mx + 3, y + 12);

  return doc.output("arraybuffer");
}

/** Sanitize name for filename: alphanumeric, underscore, hyphen only */
export function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 80) || "Unknown";
}
