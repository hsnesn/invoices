import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { createSalaryAuditEvent } from "@/lib/salary-extraction";
import { sendSalaryPaymentConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** PATCH /api/salaries/[id] - Update salary (e.g. mark as paid) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    if (action === "mark_paid") {
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

    const { data: updated } = await supabase
      .from("salaries")
      .select("*, employees(full_name, email_address, bank_account_number, sort_code)")
      .eq("id", id)
      .single();

    return NextResponse.json(updated ?? existing);
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
};
