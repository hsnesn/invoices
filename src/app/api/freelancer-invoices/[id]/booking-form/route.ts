import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBookingFormPdf } from "@/lib/booking-form/pdf-generator";
import { getLogoUrl } from "@/lib/get-logo-url";

/** ASCII-only filename for Content-Disposition header (RFC 2616) */
function asciiFilename(name: string): string {
  const tr: Record<string, string> = { ş: "s", ğ: "g", ı: "i", ö: "o", ü: "u", ç: "c", Ş: "S", Ğ: "G", İ: "I", Ö: "O", Ü: "U", Ç: "C" };
  let s = name;
  for (const [k, v] of Object.entries(tr)) s = s.replaceAll(k, v);
  return s.replace(/[^\x20-\x7E]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 120) || "booking-form";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
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

    const isAdmin = profile.role === "admin";
    const isOperations = profile.role === "operations";
    const isFinance = profile.role === "finance";
    const isViewer = profile.role === "viewer";
    const isAssignedManager = profile.role === "manager" && managerUserId === session.user.id;
    const { data: orMember } = await supabase.from("operations_room_members").select("id").eq("user_id", session.user.id).maybeSingle();
    const isOpsRoomMember = !!orMember;

    const canAccess = isAdmin || isOperations || isFinance || isViewer || isAssignedManager || isOpsRoomMember;
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Serve stored booking form if it exists (created once after first approval)
    const { data: storedFile } = await supabase
      .from("invoice_files")
      .select("storage_path, file_name")
      .eq("invoice_id", invoiceId)
      .like("storage_path", "booking-forms/%")
      .limit(1)
      .maybeSingle();
    if (storedFile?.storage_path) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("invoices")
        .download(storedFile.storage_path);
      if (!downloadError && fileData) {
        const buf = await fileData.arrayBuffer();
        return new NextResponse(Buffer.from(buf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${asciiFilename(storedFile.file_name || "booking-form.pdf")}"`,
          },
        });
      }
      if (downloadError) {
        console.error("[BookingForm] Storage download failed:", downloadError);
        return NextResponse.json(
          { error: "Stored booking form could not be retrieved. Please contact support." },
          { status: 503 }
        );
      }
    }

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
    const serviceMonthRaw = (fl?.service_month as string) ?? "—";
    const daysDetail = (fl?.service_days as string) ?? "—";
    const rate = Number(fl?.service_rate_per_day) || 0;
    const additionalCost = Number(fl?.additional_cost) || 0;
    const additionalCostReason = (fl?.additional_cost_reason as string) ?? "";
    const bookedBy = (fl?.booked_by as string) ?? "—";
    const totalAmount = serviceDays * rate + additionalCost;

    const approvalDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "numeric", year: "numeric" });
    // Month cell shows only month name (no year)
    const displayMonth = serviceMonthRaw !== "—" && /\d{4}/.test(serviceMonthRaw)
      ? serviceMonthRaw.replace(/\s+\d{4}$/, "").trim()
      : serviceMonthRaw;

    const displayName = companyName !== "—" ? `${companyName} ${contractorName !== "—" ? contractorName : ""}`.trim() : contractorName;

    const logoUrl = await getLogoUrl("logo_trt_world");
    let logoPathOrUrl: string | undefined;
    let logoDataBase64: string | undefined;
    if (logoUrl.startsWith("http")) {
      try {
        const res = await fetch(logoUrl);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          logoDataBase64 = Buffer.from(buf).toString("base64");
        }
      } catch {
        /* use default */
      }
    } else {
      logoPathOrUrl = logoUrl.replace(/^\//, "");
    }

    const pdf = generateBookingFormPdf(
      {
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
      },
      logoPathOrUrl,
      logoDataBase64
    );

    const safeName = asciiFilename(`Booking_Form_${contractorName}_${displayMonth}.pdf`);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
