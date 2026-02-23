import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuditEvent } from "@/lib/audit";
import { sendManagerAssignedEmail } from "@/lib/email";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const body = await request.json();
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("invoices")
      .select("id, submitter_user_id, department_id, invoice_workflows(status, manager_user_id)")
      .eq("id", invoiceId)
      .single();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const wfRaw = (existing as Record<string, unknown>).invoice_workflows;
    const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw;
    const wfStatus = (wf as Record<string, unknown> | null)?.status as string | undefined;

    if (profile.role === "submitter") {
      const isOwner = existing.submitter_user_id === session.user.id;
      if (!isOwner || !["submitted", "pending_manager", "rejected"].includes(wfStatus ?? "submitted")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "manager") {
      const isAssigned = (wf as Record<string, unknown> | null)?.manager_user_id === session.user.id;
      if (!isAssigned && existing.submitter_user_id !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoiceUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.departmentId !== undefined) invoiceUpdate.department_id = body.departmentId || null;

    await supabase.from("invoices").update(invoiceUpdate).eq("id", invoiceId);

    const flUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const flFields = ["contractor", "companyName", "serviceDescription", "serviceDaysCount", "days", "serviceRate", "month", "additionalCost", "additionalCostReason", "bookedBy", "department2", "istanbulTeam"];
    const dbFieldMap: Record<string, string> = {
      contractor: "contractor_name",
      companyName: "company_name",
      serviceDescription: "service_description",
      serviceDaysCount: "service_days_count",
      days: "service_days",
      serviceRate: "service_rate_per_day",
      month: "service_month",
      additionalCost: "additional_cost",
      additionalCostReason: "additional_cost_reason",
      bookedBy: "booked_by",
      department2: "department_2",
      istanbulTeam: "istanbul_team",
    };
    for (const key of flFields) {
      if (body[key] !== undefined) {
        const dbKey = dbFieldMap[key];
        if (["serviceDaysCount", "serviceRate", "additionalCost"].includes(key)) {
          flUpdate[dbKey] = body[key] ? parseFloat(body[key]) : null;
        } else {
          flUpdate[dbKey] = body[key] || null;
        }
      }
    }
    if (Object.keys(flUpdate).length > 1) {
      await supabase.from("freelancer_invoice_fields").update(flUpdate).eq("invoice_id", invoiceId);
    }

    if (body.invNumber !== undefined || body.beneficiary !== undefined || body.accountNumber !== undefined || body.sortCode !== undefined || body.amount !== undefined) {
      const extUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.invNumber !== undefined) extUpdate.invoice_number = body.invNumber || null;
      if (body.beneficiary !== undefined) extUpdate.beneficiary_name = body.beneficiary || null;
      if (body.accountNumber !== undefined) extUpdate.account_number = body.accountNumber || null;
      if (body.sortCode !== undefined) extUpdate.sort_code = body.sortCode || null;
      if (body.amount !== undefined) extUpdate.gross_amount = body.amount ? parseFloat(body.amount) : null;
      await supabase.from("invoice_extracted_fields").upsert({ invoice_id: invoiceId, ...extUpdate }, { onConflict: "invoice_id" });
    }

    if (body.deptManagerId !== undefined && profile.role === "admin") {
      const newManagerId = (body.deptManagerId as string) || null;
      const prevManagerId = (wf as Record<string, unknown> | null)?.manager_user_id as string | null;
      await supabase.from("invoice_workflows").update({ manager_user_id: newManagerId, updated_at: new Date().toISOString() }).eq("invoice_id", invoiceId);
      if (newManagerId && newManagerId !== prevManagerId) {
        const { data: mUser } = await supabase.auth.admin.getUserById(newManagerId);
        const { data: extracted } = await supabase.from("invoice_extracted_fields").select("invoice_number").eq("invoice_id", invoiceId).single();
        if (mUser?.user?.email) {
          await sendManagerAssignedEmail({
            managerEmail: mUser.user.email,
            invoiceId,
            invoiceNumber: extracted?.invoice_number ?? undefined,
            assignedByName: profile.full_name ?? undefined,
          });
        }
      }
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_updated",
      payload: { changes: body, invoice_type: "freelancer" },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
