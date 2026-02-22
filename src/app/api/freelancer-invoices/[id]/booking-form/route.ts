import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const { data: inv } = await supabase
      .from("invoices")
      .select(`
        id, submitter_user_id, department_id, created_at,
        invoice_workflows(status, manager_user_id, rejection_reason),
        freelancer_invoice_fields(contractor_name, company_name, service_description, service_days_count, service_days, service_rate_per_day, service_month, additional_cost, additional_cost_reason, booked_by, department_2),
        invoice_extracted_fields(gross_amount)
      `)
      .eq("id", invoiceId)
      .single();

    if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const wfRaw = (inv as Record<string, unknown>).invoice_workflows;
    const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw;
    const flRaw = (inv as Record<string, unknown>).freelancer_invoice_fields;
    const fl = (Array.isArray(flRaw) ? flRaw[0] : flRaw) as Record<string, unknown> | null;
    const extRaw = (inv as Record<string, unknown>).invoice_extracted_fields;
    const ext = (Array.isArray(extRaw) ? extRaw[0] : extRaw) as Record<string, unknown> | null;

    const managerUserId = (wf as Record<string, unknown> | null)?.manager_user_id as string | null;
    let approverName = "—";
    if (managerUserId) {
      const { data: mp } = await supabase.from("profiles").select("full_name").eq("id", managerUserId).single();
      approverName = mp?.full_name ?? "—";
    }

    const { data: dept } = inv.department_id
      ? await supabase.from("departments").select("name").eq("id", inv.department_id).single()
      : { data: null };

    const deptName = dept?.name ?? "—";
    const dept2 = (fl?.department_2 as string) ?? "—";
    const contractorName = (fl?.contractor_name as string) ?? "—";
    const companyName = (fl?.company_name as string) ?? "—";
    const serviceDesc = (fl?.service_description as string) ?? "—";
    const serviceDays = Number(fl?.service_days_count) || 0;
    const serviceMonth = (fl?.service_month as string) ?? "—";
    const daysDetail = (fl?.service_days as string) ?? "—";
    const rate = Number(fl?.service_rate_per_day) || 0;
    const additionalCost = Number(fl?.additional_cost) || 0;
    const additionalCostReason = (fl?.additional_cost_reason as string) ?? "";
    const bookedBy = (fl?.booked_by as string) ?? "—";
    const totalAmount = serviceDays * rate + additionalCost;

    const approvalDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "numeric" });

    const displayName = companyName !== "—" ? `${companyName} ${contractorName !== "—" ? contractorName : ""}`.trim() : contractorName;

    const pdf = buildBookingFormPdf({
      displayName, serviceDesc, totalAmount, deptName, dept2, serviceDays, serviceMonth, daysDetail,
      rate, additionalCost, additionalCostReason, approverName, bookedBy, approvalDate,
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Booking_Form_${contractorName.replace(/\s+/g, "_")}_${serviceMonth}.pdf"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function buildBookingFormPdf(data: {
  displayName: string; serviceDesc: string; totalAmount: number;
  deptName: string; dept2: string; serviceDays: number; serviceMonth: string;
  daysDetail: string; rate: number; additionalCost: number; additionalCostReason: string;
  approverName: string; bookedBy: string; approvalDate: string;
}): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const mx = 20;
  const cw = pw - 2 * mx;

  let logoData: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "trt-world-logo.png");
    const buf = fs.readFileSync(logoPath);
    logoData = `data:image/png;base64,${buf.toString("base64")}`;
  } catch { /* logo not found */ }

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

  const fmtCurrency = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const fields: [string, string][] = [
    ["Name", data.displayName],
    ["Service Description", data.serviceDesc],
    ["Amount", fmtCurrency(data.totalAmount)],
    ["Department", data.deptName],
    ["Department 2", data.dept2],
    ["Number of days", String(data.serviceDays)],
    ["Month", data.serviceMonth],
    ["Days", data.daysDetail],
    ["Service rate (per day)", fmtCurrency(data.rate)],
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
    pw / 2, y, { align: "center" }
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
    ["Date of approval", data.approvalDate],
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
  const notice = "*Invoices will be settled on the last day of the following month from the date in which they were sent (Example: invoices filed on any given day during June, will be settled on the last day of July - and so on and so forth).";
  const noticeLines = doc.splitTextToSize(notice, cw - 6);
  doc.text(noticeLines, mx + 3, y + 12);

  return doc.output("arraybuffer");
}
