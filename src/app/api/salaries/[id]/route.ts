import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { createSalaryAuditEvent, runSalaryExtraction } from "@/lib/salary-extraction";
import { sendSalaryPaymentConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function canEdit(role: string): boolean {
  return role === "admin" || role === "operations";
}
function canMarkPaid(role: string): boolean {
  return role === "admin" || role === "finance";
}
function canDelete(role: string): boolean {
  return role === "admin" || role === "operations";
}

/** DELETE /api/salaries/[id] - Delete salary (admin, operations) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (!canDelete(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("salaries")
      .select("id, payslip_storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Salary not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase.from("salaries").delete().eq("id", id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const path = (existing as { payslip_storage_path?: string }).payslip_storage_path;
    if (path) {
      await supabase.storage.from("invoices").remove([path]);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** PATCH /api/salaries/[id] - Update salary (edit, mark paid, re-extract) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("salaries")
      .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Salary not found" }, { status: 404 });
    }

    if (action === "re_extract") {
      if (!canEdit(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const storagePath = (existing as { payslip_storage_path?: string }).payslip_storage_path;
      if (!storagePath) {
        return NextResponse.json({ error: "No payslip file to extract from" }, { status: 400 });
      }
      try {
        await runSalaryExtraction(id, storagePath, session.user.id);
      } catch (err) {
        return NextResponse.json(
          { error: (err as Error).message ?? "Extraction failed" },
          { status: 500 }
        );
      }
      const { data: afterExtract } = await supabase
        .from("salaries")
        .select("employee_name, employee_id")
        .eq("id", id)
        .single();
      if (afterExtract?.employee_name && !afterExtract.employee_id) {
        const { data: allEmployees } = await supabase
          .from("employees")
          .select("id, full_name, bank_account_number, sort_code");
        const empList = allEmployees ?? [];
        const extractedNorm = (afterExtract.employee_name ?? "").replace(/\b(Mr|Mrs|Ms|Dr)\.?\s*/gi, "").trim().toLowerCase();
        for (let i = 0; i < empList.length; i++) {
          const emp = empList[i];
          const dbNorm = (emp?.full_name ?? "").trim().toLowerCase();
          if (dbNorm === extractedNorm || extractedNorm.includes(dbNorm) || dbNorm.includes(extractedNorm)) {
            await supabase
              .from("salaries")
              .update({
                employee_id: emp?.id,
                bank_account_number: emp?.bank_account_number ?? undefined,
                sort_code: emp?.sort_code ?? undefined,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id);
            break;
          }
        }
      }
      const { data: updated } = await supabase
        .from("salaries")
        .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
        .eq("id", id)
        .single();
      return NextResponse.json(updated ?? existing);
    }

    if (action === "set_pending") {
      if (!canEdit(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { error: updateError } = await supabase
        .from("salaries")
        .update({ status: "pending", paid_date: null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      await createSalaryAuditEvent({
        salary_id: id,
        actor_user_id: session.user.id,
        event_type: "salary_status_changed",
        from_status: existing.status,
        to_status: "pending",
        payload: {},
      });
      const { data: updated } = await supabase
        .from("salaries")
        .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
        .eq("id", id)
        .single();
      return NextResponse.json(updated ?? existing);
    }

    if (action === "set_needs_review") {
      if (!canEdit(profile.role) && !canMarkPaid(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const rejectionReason = (body.rejection_reason as string)?.trim() || null;
      const { error: updateError } = await supabase
        .from("salaries")
        .update({ status: "needs_review", paid_date: null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      await createSalaryAuditEvent({
        salary_id: id,
        actor_user_id: session.user.id,
        event_type: "salary_rejected",
        from_status: existing.status,
        to_status: "needs_review",
        payload: rejectionReason ? { rejection_reason: rejectionReason } : {},
      });
      const { data: updated } = await supabase
        .from("salaries")
        .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
        .eq("id", id)
        .single();
      return NextResponse.json(updated ?? existing);
    }

    if (action === "mark_paid") {
      if (!canMarkPaid(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (existing.status === "paid") {
        return NextResponse.json({ error: "Already marked as paid" }, { status: 400 });
      }
      if (!existing.net_pay || existing.net_pay <= 0) {
        return NextResponse.json(
          { error: "Cannot mark as paid: Net Pay is missing or invalid" },
          { status: 400 }
        );
      }

      const paidDate = new Date().toISOString().slice(0, 10);

      const { error: updateError } = await supabase
        .from("salaries")
        .update({
          status: "paid",
          paid_date: paidDate,
          email_sent_status: "not_sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await createSalaryAuditEvent({
        salary_id: id,
        actor_user_id: session.user.id,
        event_type: "salary_marked_paid",
        from_status: existing.status,
        to_status: "paid",
        payload: { paid_date: paidDate },
      });

      let payslipBuffer: Buffer | null = null;
      let payslipFilename = "payslip.pdf";
      const storagePath = (existing as { payslip_storage_path?: string }).payslip_storage_path;
      if (storagePath) {
        const { data: fileData } = await supabase.storage.from("invoices").download(storagePath);
        if (fileData) {
          payslipBuffer = Buffer.from(await fileData.arrayBuffer());
          payslipFilename = storagePath.split("/").pop() ?? "payslip.pdf";
        }
      }

      const emp = existing as { employees?: { email_address?: string } | null };
      const emailTo = emp?.employees?.email_address ?? "hasanesen@gmail.com";
      const salaryForEmail: SalaryForEmail = {
        ...existing,
        paid_date: paidDate,
      };
      const { success: emailSent } = await sendSalaryPaymentConfirmationEmail({
        to: emailTo,
        salary: salaryForEmail,
        payslipBuffer,
        payslipFilename,
      });

      await supabase
        .from("salaries")
        .update({
          email_sent_status: emailSent ? "sent" : "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      const { data: updated } = await supabase
        .from("salaries")
        .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
        .eq("id", id)
        .single();

      return NextResponse.json(updated);
    }

    if (action === "edit" || Object.keys(body).some((k) => k !== "action")) {
      if (!canEdit(profile.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const allowedFields = [
        "employee_name",
        "ni_number",
        "bank_account_number",
        "sort_code",
        "net_pay",
        "total_gross_pay",
        "paye_tax",
        "employee_ni",
        "employee_pension",
        "employer_pension",
        "employer_ni",
        "payment_month",
        "payment_year",
        "process_date",
        "tax_period",
        "reference",
      ];
      const updates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in body && body[key] !== undefined) {
          updates[key] = body[key];
        }
      }
      if (updates.net_pay != null || updates.total_gross_pay != null || updates.employer_pension != null || updates.employer_ni != null) {
        const gross = (updates.total_gross_pay as number) ?? existing.total_gross_pay ?? 0;
        const erPension = (updates.employer_pension as number) ?? existing.employer_pension ?? 0;
        const erNi = (updates.employer_ni as number) ?? existing.employer_ni ?? 0;
        if (gross > 0) updates.employer_total_cost = gross + erPension + erNi;
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json(existing);
      }
      const { error: updateError } = await supabase
        .from("salaries")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      const empId = (existing as { employee_id?: string }).employee_id;
      if (empId && (updates.bank_account_number != null || updates.sort_code != null)) {
        const empUpdates: Record<string, unknown> = {};
        if (updates.bank_account_number != null) empUpdates.bank_account_number = updates.bank_account_number;
        if (updates.sort_code != null) empUpdates.sort_code = updates.sort_code;
        if (Object.keys(empUpdates).length > 0) {
          await supabase.from("employees").update({ ...empUpdates, updated_at: new Date().toISOString() }).eq("id", empId);
        }
      }
      await createSalaryAuditEvent({
        salary_id: id,
        actor_user_id: session.user.id,
        event_type: "salary_edited",
        payload: { changes: updates },
      });
      const { data: updated } = await supabase
        .from("salaries")
        .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
        .eq("id", id)
        .single();
      return NextResponse.json(updated ?? existing);
    }

    return NextResponse.json(existing);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

type SalaryForEmail = {
  employee_name: string | null;
  net_pay: number | null;
  total_gross_pay: number | null;
  paye_tax: number | null;
  employee_ni: number | null;
  employer_pension: number | null;
  paid_date: string | null;
  reference: string | null;
  payment_month: string | null;
  payment_year: number | null;
};
