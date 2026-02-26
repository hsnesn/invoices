import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuditEvent } from "@/lib/audit";
import { sendManagerAssignedEmail } from "@/lib/email";
import { buildFreelancerEmailDetails } from "@/lib/freelancer-email-details";
import { isEmailStageEnabled, isRecipientEnabled, userWantsUpdateEmails } from "@/lib/email-settings";

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

    const { data: oldFl } = await supabase
      .from("freelancer_invoice_fields")
      .select("contractor_name, company_name, service_description, service_days_count, service_days, service_rate_per_day, service_month, additional_cost, additional_cost_reason, booked_by, department_2, istanbul_team")
      .eq("invoice_id", invoiceId)
      .single();
    const { data: oldExt } = await supabase
      .from("invoice_extracted_fields")
      .select("invoice_number, beneficiary_name, account_number, sort_code, gross_amount")
      .eq("invoice_id", invoiceId)
      .single();

    const toStr = (v: unknown): string => (v != null && v !== "" ? String(v).trim() : "—");
    const flLabelMap: Record<string, string> = {
      contractor: "Contractor",
      companyName: "Company Name",
      serviceDescription: "Service Description",
      serviceDaysCount: "Service Days",
      days: "Days",
      serviceRate: "Rate/Day",
      month: "Month",
      additionalCost: "Additional Cost",
      additionalCostReason: "Add. Cost Reason",
      bookedBy: "Booked By",
      department2: "Department 2",
      istanbulTeam: "Istanbul Team",
      departmentId: "Department",
      invNumber: "Inv Number",
      beneficiary: "Beneficiary",
      accountNumber: "Account Number",
      sortCode: "Sort Code",
      amount: "Amount",
      deptManagerId: "Manager",
    };
    const changes: Record<string, { from: string; to: string }> = {};

    if (body.departmentId !== undefined) {
      const o = toStr(existing.department_id);
      const n = toStr(body.departmentId);
      if (o !== n) changes["Department"] = { from: o, to: n };
    }
    for (const key of ["contractor", "companyName", "serviceDescription", "serviceDaysCount", "days", "serviceRate", "month", "additionalCost", "additionalCostReason", "bookedBy", "department2", "istanbulTeam"]) {
      if (body[key] === undefined) continue;
      let n = key === "serviceDaysCount" || key === "serviceRate" || key === "additionalCost" ? toStr(body[key] != null ? String(body[key]) : "") : toStr(body[key]);
      if (key === "companyName" && n && /trt/i.test(n)) n = toStr((oldFl as Record<string, unknown>)?.["contractor_name"]) || "—";
      const dbKey = key === "contractor" ? "contractor_name" : key === "companyName" ? "company_name" : key === "serviceDescription" ? "service_description" : key === "serviceDaysCount" ? "service_days_count" : key === "days" ? "service_days" : key === "serviceRate" ? "service_rate_per_day" : key === "month" ? "service_month" : key === "additionalCost" ? "additional_cost" : key === "additionalCostReason" ? "additional_cost_reason" : key === "bookedBy" ? "booked_by" : key === "department2" ? "department_2" : "istanbul_team";
      const o = toStr((oldFl as Record<string, unknown>)?.[dbKey]);
      if (o !== n) changes[flLabelMap[key]] = { from: o, to: n };
    }
    if (body.invNumber !== undefined) {
      const o = toStr((oldExt as Record<string, unknown>)?.["invoice_number"]);
      const n = toStr(body.invNumber);
      if (o !== n) changes["Inv Number"] = { from: o, to: n };
    }
    if (body.beneficiary !== undefined) {
      const o = toStr((oldExt as Record<string, unknown>)?.["beneficiary_name"]);
      const n = toStr(body.beneficiary);
      if (o !== n) changes["Beneficiary"] = { from: o, to: n };
    }
    if (body.accountNumber !== undefined) {
      const o = toStr((oldExt as Record<string, unknown>)?.["account_number"]);
      const n = toStr(body.accountNumber);
      if (o !== n) changes["Account Number"] = { from: o, to: n };
    }
    if (body.sortCode !== undefined) {
      const o = toStr((oldExt as Record<string, unknown>)?.["sort_code"]);
      const n = toStr(body.sortCode);
      if (o !== n) changes["Sort Code"] = { from: o, to: n };
    }
    if (body.amount !== undefined) {
      const o = toStr((oldExt as Record<string, unknown>)?.["gross_amount"]);
      const n = toStr(body.amount != null ? String(body.amount) : "");
      if (o !== n) changes["Amount"] = { from: o, to: n };
    }
    if (body.deptManagerId !== undefined && profile.role === "admin") {
      const o = toStr((wf as Record<string, unknown> | null)?.manager_user_id) === "—" ? "Unassigned" : toStr((wf as Record<string, unknown> | null)?.manager_user_id);
      const n = toStr(body.deptManagerId) === "—" ? "Unassigned" : toStr(body.deptManagerId);
      if (o !== n) changes["Manager"] = { from: o, to: n };
    }
    if (body.submitterUserId !== undefined && profile.role === "admin") {
      const o = toStr(existing.submitter_user_id);
      const n = toStr(body.submitterUserId);
      if (o !== n) changes["Submitted by"] = { from: o, to: n };
    }

    const invoiceUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.departmentId !== undefined) invoiceUpdate.department_id = body.departmentId || null;
    if (body.submitterUserId !== undefined && profile.role === "admin") invoiceUpdate.submitter_user_id = body.submitterUserId || null;

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
        let val = body[key];
        if (key === "companyName" && val && /trt/i.test(String(val))) val = (oldFl as Record<string, unknown>)?.["contractor_name"] ?? null;
        const dbKey = dbFieldMap[key];
        if (["serviceDaysCount", "serviceRate", "additionalCost"].includes(key)) {
          flUpdate[dbKey] = val ? parseFloat(val as string) : null;
        } else {
          flUpdate[dbKey] = val || null;
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
      if (newManagerId && newManagerId !== prevManagerId && (await isEmailStageEnabled("manager_assigned")) && (await isRecipientEnabled("manager_assigned", "dept_ep")) && (await userWantsUpdateEmails(newManagerId))) {
        const { data: mUser } = await supabase.auth.admin.getUserById(newManagerId);
        const { data: fl } = await supabase.from("freelancer_invoice_fields").select("contractor_name, company_name, service_description, service_days_count, service_rate_per_day, service_month, additional_cost").eq("invoice_id", invoiceId).single();
        const { data: ext } = await supabase.from("invoice_extracted_fields").select("invoice_number, beneficiary_name, account_number, sort_code, gross_amount").eq("invoice_id", invoiceId).single();
        const deptName = existing.department_id ? ((await supabase.from("departments").select("name").eq("id", existing.department_id).single()).data?.name ?? "—") : "—";
        const freelancerDetails = buildFreelancerEmailDetails(fl, ext, deptName);
        if (mUser?.user?.email) {
          await sendManagerAssignedEmail({
            managerEmail: mUser.user.email,
            invoiceId,
            invoiceNumber: ext?.invoice_number ?? undefined,
            assignedByName: profile.full_name ?? undefined,
            freelancerDetails,
          });
        }
      }
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "invoice_updated",
      payload: { changes: Object.keys(changes).length > 0 ? changes : undefined, invoice_type: "freelancer" },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
