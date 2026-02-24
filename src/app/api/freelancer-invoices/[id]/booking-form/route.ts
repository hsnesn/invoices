import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBookingFormPdf } from "@/lib/booking-form/pdf-generator";

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
    const companyRaw = (fl?.company_name as string) ?? "—";
    const companyName = !companyRaw || /trt/i.test(companyRaw) ? "—" : companyRaw;
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
    let displayMonth = serviceMonth;
    if (displayMonth !== "—" && !/\d{4}/.test(displayMonth)) {
      displayMonth = `${displayMonth} ${new Date().getFullYear()}`;
    }

    const displayName = companyName !== "—" ? `${companyName} ${contractorName !== "—" ? contractorName : ""}`.trim() : contractorName;

    const pdf = generateBookingFormPdf({
      name: displayName,
      serviceDescription: serviceDesc,
      amount: totalAmount,
      department: deptName,
      department2: dept2,
      numberOfDays: serviceDays,
      month: displayMonth,
      days: daysDetail,
      serviceRatePerDay: rate,
      additionalCost,
      additionalCostReason,
      approverName,
      bookedBy,
      approvalDate,
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
