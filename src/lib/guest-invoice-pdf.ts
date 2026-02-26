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

  // FROM | TO side by side — TO right-aligned, larger fonts, color
  const toX = pw - mx; // right edge for TO block

  // FROM header — subtle blue
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  doc.text("FROM", mx, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const fromLines = [
    data.guestName,
    data.guestAddress || "",
    data.guestEmail || "",
    data.guestPhone || "",
  ].filter(Boolean);
  fromLines.forEach((line) => {
    doc.text(line, mx, y);
    y += 5.5;
  });

  const fromBottom = y;
  y = fromBottom - fromLines.length * 5.5 - 6;

  // TO header — right-aligned, accent color
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  doc.text("TO", toX, y + 6, { align: "right" });

  // TO address — right-aligned, larger font
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  let toY = y + 12;
  TO_ADDRESS.forEach((line) => {
    doc.text(line, toX, toY, { align: "right" });
    toY += 5.5;
  });

  y = Math.max(fromBottom, toY + 4) + 10;

  // Table: Programme Name | Topic | Date | Amount — colored header
  const colWidths = [45, 50, 35, 40];
  const headers = ["Programme Name", "Topic", "Date", "Amount"];
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(30, 64, 120);
  doc.rect(mx, y, cw, 10, "F");
  doc.setTextColor(255, 255, 255);
  let x = mx;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y + 6.5);
    x += colWidths[i];
  });
  doc.setTextColor(40, 40, 40);
  y += 10;

  doc.setFont("helvetica", "normal");
  for (const row of data.appearances) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(255, 255, 255);
    doc.rect(mx, y, cw, 7, "F");
    x = mx;
    doc.text((row.programmeName || "").slice(0, 25), x + 2, y + 4.5);
    x += colWidths[0];
    doc.text((row.topic || "").slice(0, 28), x + 2, y + 4.5);
    x += colWidths[1];
    doc.text(row.date || "", x + 2, y + 4.5);
    x += colWidths[2];
    doc.text(fmtAmount(row.amount, data.currency), x + 2, y + 4.5);
    y += 7;
  }

  // Expenses — accent header
  if (data.expenses.length > 0) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 64, 120);
    doc.text("Expenses", mx, y);
    doc.setTextColor(40, 40, 40);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const exp of data.expenses) {
      doc.text(`${exp.label}: ${fmtAmount(exp.amount, data.currency)}`, mx + 5, y);
      y += 5;
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
    doc.text("PayPal:", mx, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.paypal.trim(), mx + 22, y);
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
