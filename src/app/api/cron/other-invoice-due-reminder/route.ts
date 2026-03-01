/**
 * Cron: Send reminder for Other Invoices due within 3 days.
 * Call via Vercel Cron: 0 10 * * * (daily at 10:00 UTC) or similar.
 * Requires CRON_SECRET in env to prevent unauthorized calls.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanySettingsAsync } from "@/lib/company-settings";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const today = new Date();
    const inThreeDays = new Date(today);
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    const todayStr = today.toISOString().slice(0, 10);
    const inThreeDaysStr = inThreeDays.toISOString().slice(0, 10);

    const { data: invoices } = await supabase
      .from("invoices")
      .select(`
        id,
        service_description,
        invoice_extracted_fields(beneficiary_name, gross_amount, extracted_currency, raw_json),
        invoice_workflows(status)
      `)
      .eq("invoice_type", "other");

    const pending = (invoices ?? []).filter((inv) => {
      const wf = Array.isArray(inv.invoice_workflows) ? inv.invoice_workflows[0] : inv.invoice_workflows;
      const status = (wf as { status?: string })?.status;
      return status === "ready_for_payment";
    });

    const dueSoon: { id: string; beneficiary: string; amount: string; currency: string; dueDate: string }[] = [];
    for (const inv of pending) {
      const ext = Array.isArray(inv.invoice_extracted_fields) ? inv.invoice_extracted_fields[0] : inv.invoice_extracted_fields;
      const raw = (ext as { raw_json?: { due_date?: string } })?.raw_json;
      const dueDate = raw?.due_date;
      if (!dueDate) continue;
      const d = dueDate.slice(0, 10);
      if (d >= todayStr && d <= inThreeDaysStr) {
        const beneficiary = (ext as { beneficiary_name?: string })?.beneficiary_name ?? "Unknown";
        const amount = (ext as { gross_amount?: number })?.gross_amount ?? 0;
        const currency = (ext as { extracted_currency?: string })?.extracted_currency ?? "GBP";
        dueSoon.push({
          id: inv.id,
          beneficiary,
          amount: amount.toFixed(2),
          currency,
          dueDate: d,
        });
      }
    }

    if (dueSoon.length === 0) {
      return NextResponse.json({ sent: 0, message: "No due reminders to send" });
    }

    const company = await getCompanySettingsAsync();
    const to = company?.email_bank_transfer?.trim() || process.env.FINANCE_EMAIL || "london.finance@trtworld.com";

    const { sendOtherInvoiceDueReminderEmail } = await import("@/lib/email");
    const result = await sendOtherInvoiceDueReminderEmail({
      to,
      invoices: dueSoon,
    });

    return NextResponse.json({
      sent: result.success ? 1 : 0,
      count: dueSoon.length,
      invoiceIds: dueSoon.map((i) => i.id),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
