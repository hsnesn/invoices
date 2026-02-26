import { jsPDF } from "jspdf";

const TO_ADDRESS = [
  "TRT WORLD UK",
  "200 Grays Inn Road",
  "Holborn, London",
  "London",
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

  // Top: INV NO (left) | DATE (right) - large caps
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`INV NO: ${(data.invNo || "").toUpperCase()}`, mx, y);
  doc.text(`DATE: ${(data.invoiceDate || "").toUpperCase()}`, pw - mx, y, { align: "right" });
  y += 14;

  // FROM | TO side by side
  const colW = (cw - 10) / 2;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("FROM", mx, y);
  doc.text("TO", mx + colW + 10, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const fromLines = [
    data.guestName,
    data.guestAddress || "",
    data.guestEmail || "",
    data.guestPhone || "",
  ].filter(Boolean);
  fromLines.forEach((line) => {
    doc.text(line, mx, y);
    y += 5;
  });

  const fromBottom = y;
  y = fromBottom - fromLines.length * 5 - 6;

  doc.text(TO_ADDRESS[0], mx + colW + 10, y + 6);
  doc.text(TO_ADDRESS[1], mx + colW + 10, y + 11);
  doc.text(TO_ADDRESS[2], mx + colW + 10, y + 16);
  doc.text(TO_ADDRESS[3], mx + colW + 10, y + 21);
  doc.text(TO_ADDRESS[4], mx + colW + 10, y + 26);

  y = Math.max(fromBottom, y + 30) + 10;

  // Table: Programme Name | Topic | Date | Amount
  const colWidths = [45, 50, 35, 40];
  const headers = ["Programme Name", "Topic", "Date", "Amount"];
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 247, 250);
  doc.rect(mx, y, cw, 8, "F");
  let x = mx;
  headers.forEach((h, i) => {
    doc.text(h, x + 2, y + 5.5);
    x += colWidths[i];
  });
  y += 8;

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

  // Expenses
  if (data.expenses.length > 0) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Expenses", mx, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    for (const exp of data.expenses) {
      doc.text(`${exp.label}: ${fmtAmount(exp.amount, data.currency)}`, mx + 5, y);
      y += 5;
    }
  }

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL: ${fmtAmount(data.totalAmount, data.currency)}`, mx, y);
  y += 14;

  // Payment section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PAYMENT", mx, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("We prefer PayPal if you have one.", mx, y);
  y += 6;

  if (data.paypal?.trim()) {
    doc.text(`PayPal: ${data.paypal.trim()}`, mx, y);
    y += 6;
  }

  doc.text("Payment by bank transfer:", mx, y);
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
