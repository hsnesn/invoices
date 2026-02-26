import { jsPDF } from "jspdf";

const TO_ADDRESS = [
  "TRT WORLD UK",
  "200 Grays Inn Road",
  "Holborn, London",
  "WC1X 8XZ",
];

export type GuestInvoiceAppearance = {
  programmeName: string;
  topic: string;
  date: string;
  amount: number;
};

export type GuestInvoiceExpense = {
  label: string;
  amount: number;
};

export type GuestInvoicePdfData = {
  invNo: string;
  invoiceDate: string;
  currency: "GBP" | "EUR" | "USD";
  guestName: string;
  guestAddress?: string;
  guestEmail?: string;
  guestPhone?: string;
  departmentName?: string;
  programmeName?: string;
  appearances: GuestInvoiceAppearance[];
  expenses: GuestInvoiceExpense[];
  totalAmount: number;
  paypal?: string;
  accountName: string;
  bankName?: string;
  accountNumber: string;
  sortCode: string;
  bankAddress?: string;
};

function currencySymbol(c: string): string {
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  return "£";
}

function fmtAmount(amount: number, currency: string): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function generateGuestInvoicePdf(data: GuestInvoicePdfData): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const mx = 20;
  const cw = pw - 2 * mx;
  const sym = currencySymbol(data.currency);

  let y = 20;

  // Top: INV NO (left) | DATE (right) — larger, accent color
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  doc.text(`INV NO: ${(data.invNo || "").toUpperCase()}`, mx, y);
  doc.text(`DATE: ${(data.invoiceDate || "").toUpperCase()}`, pw - mx, y, { align: "right" });
  y += 16;

  // FROM | TO side by side — clear column split to avoid overlap
  const leftColEnd = 95;
  const toX = pw - mx;

  // FROM header (left) and TO header (right) on same line
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  doc.text("FROM", mx, y);
  doc.text("TO", toX, y, { align: "right" });
  const toStartY = y + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const fromLines = [
    data.guestName,
    data.guestAddress || "",
    data.guestEmail || "",
    data.guestPhone || "",
  ].filter(Boolean);
  fromLines.forEach((line, i) => {
    doc.text(line, mx, toStartY + i * 5.5, { maxWidth: leftColEnd - mx - 2 });
  });
  const fromBottom = fromLines.length > 0 ? toStartY + fromLines.length * 5.5 : toStartY;

  let toY = toStartY;
  TO_ADDRESS.forEach((line) => {
    doc.text(line, toX, toY, { align: "right" });
    toY += 5.5;
  });

  y = Math.max(fromBottom, toY + 4) + 10;

  // Department label — only department name (programme stays in table)
  if (data.departmentName) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 120);
    doc.text(`Department: ${data.departmentName}`, mx, y);
    doc.setTextColor(40, 40, 40);
    y += 8;
  }

  // Table: Topic | Date | Amount — Amount right-aligned
  const colWidths = [95, 35, 40];
  const headers = ["Topic", "Date", "Amount"];
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(30, 64, 120);
  doc.rect(mx, y, cw, 10, "F");
  doc.setTextColor(255, 255, 255);
  let x = mx;
  headers.forEach((h, i) => {
    if (i === 2) doc.text(h, mx + cw - 2, y + 6.5, { align: "right" });
    else doc.text(h, x + 2, y + 6.5);
    x += colWidths[i];
  });
  doc.setTextColor(40, 40, 40);
  y += 10;

  const rowHeight = 10;
  doc.setFont("helvetica", "normal");
  for (const row of data.appearances) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(255, 255, 255);
    doc.rect(mx, y, cw, rowHeight, "F");
    x = mx;
    doc.text((row.topic || "").slice(0, 55), x + 2, y + 6);
    x += colWidths[0];
    doc.text(row.date || "", x + 2, y + 6);
    x += colWidths[1];
    doc.text(fmtAmount(row.amount, data.currency), mx + cw - 2, y + 6, { align: "right" });
    y += rowHeight;
  }

  // Expenses (train, parking, etc.) — listed on invoice
  if (data.expenses.length > 0) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 120);
    doc.text("Additional expenses", mx, y);
    doc.setTextColor(40, 40, 40);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const exp of data.expenses) {
      doc.text(`${exp.label}:`, mx + 5, y);
      doc.text(fmtAmount(exp.amount, data.currency), mx + cw - 2, y, { align: "right" });
      y += 6;
    }
  }

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 64, 120);
  doc.text(`TOTAL: ${fmtAmount(data.totalAmount, data.currency)}`, mx, y);
  doc.setTextColor(40, 40, 40);
  y += 20;

  // Payment details — always at the very bottom, after a separator
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(mx, y, pw - mx, y);
  y += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 64, 120);
  doc.text("PAYMENT DETAILS", mx, y);
  doc.setTextColor(40, 40, 40);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  if (data.paypal?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 0, 0);
    doc.text(`PayPal: ${data.paypal.trim()}`, mx, y);
    doc.setTextColor(40, 40, 40);
    y += 8;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Bank transfer:", mx, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(`Account Name:     ${data.accountName || ""}`, mx, y);
  y += 5;
  if (data.bankName) {
    doc.text(`Bank Name:        ${data.bankName}`, mx, y);
    y += 5;
  }
  doc.text(`Account Number:   ${data.accountNumber || ""}`, mx, y);
  y += 5;
  doc.text(`Sort Code:        ${data.sortCode || ""}`, mx, y);
  y += 5;
  if (data.bankAddress) {
    doc.text(`Bank Address:     ${data.bankAddress}`, mx, y);
  }

  return doc.output("arraybuffer");
}
