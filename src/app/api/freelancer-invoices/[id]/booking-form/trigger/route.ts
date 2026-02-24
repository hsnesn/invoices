/**
 * Manual trigger for Booking Form email workflow.
 * Use when the automatic trigger failed or was missed.
 * Admin only. Invoice must be freelancer and in ready_for_payment or paid.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { triggerBookingFormWorkflow } from "@/lib/booking-form/approval-trigger";
import { sendBookingFormEmailsForInvoice } from "@/lib/booking-form/process-pending-emails";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const { data: inv } = await supabase
      .from("invoices")
      .select("invoice_type")
      .eq("id", invoiceId)
      .single();

    if (!inv || (inv as { invoice_type?: string }).invoice_type !== "freelancer") {
      return NextResponse.json({ error: "Freelancer invoice not found" }, { status: 404 });
    }

    const { data: wf } = await supabase
      .from("invoice_workflows")
      .select("status, manager_user_id")
      .eq("invoice_id", invoiceId)
      .single();

    const allowedStatuses = ["approved_by_manager", "pending_admin", "ready_for_payment", "paid", "archived"];
    if (!wf || !allowedStatuses.includes(wf.status)) {
      return NextResponse.json(
        { error: "Invoice must be approved (approved_by_manager, pending_admin, ready_for_payment or paid)" },
        { status: 400 }
      );
    }

    const approverUserId = (wf.manager_user_id as string) || session.user.id;
    const approverUser = (await supabase.auth.admin.getUserById(approverUserId)).data?.user;
    const approverProfile = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", approverUserId)
      .single();

    // Ensure form exists (creates if not)
    const createResult = await triggerBookingFormWorkflow(supabase, {
      invoiceId,
      approverUserId,
      approverName: approverProfile.data?.full_name ?? "Admin",
      approverEmail: approverUser?.email ?? "",
      approvedAt: new Date(),
    });

    if (!createResult.ok) {
      const errDetail = createResult.error ?? "Workflow failed";
      console.error("[BookingForm] Manual trigger failed:", errDetail);
      return NextResponse.json(
        { error: errDetail, hint: "Check RESEND_API_KEY, RESEND_FROM_EMAIL (verified domain), and approver email in auth" },
        { status: 500 }
      );
    }

    // Send emails immediately (bypass 30s delay)
    const sendResult = await sendBookingFormEmailsForInvoice(supabase, invoiceId);
    if (!sendResult.ok) {
      console.error("[BookingForm] Manual send failed:", sendResult.error);
      return NextResponse.json(
        { error: sendResult.error ?? "Failed to send emails" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Booking form emails sent to Line Manager and London Operations",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
