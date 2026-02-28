/**
 * Mark office request as completed and send email to requester.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { sendOfficeRequestCompletedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const completionNotes = typeof body.completion_notes === "string" ? body.completion_notes.trim() : null;
    const createInvoice = body.create_invoice === true;

    const supabase = createAdminClient();
    const { data: req, error: fetchErr } = await supabase
      .from("office_requests")
      .select("id, title, description, status, requester_user_id, cost_estimate, project_id")
      .eq("id", id)
      .single();

    if (fetchErr || !req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if ((req as { status: string }).status !== "approved") {
      return NextResponse.json({ error: "Request must be approved first" }, { status: 400 });
    }

    const canComplete = profile.role === "admin" || profile.role === "operations";
    const { data: todo } = await supabase.from("office_request_todos").select("*").eq("office_request_id", id).single();
    const isAssignee = (todo as { assignee_user_id?: string })?.assignee_user_id === session.user.id;

    if (!canComplete && !isAssignee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error: todoErr } = await supabase
      .from("office_request_todos")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: session.user.id,
        completion_notes: completionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("office_request_id", id);

    if (todoErr) throw todoErr;

    let linkedInvoiceId: string | null = null;
    if (createInvoice && canComplete) {
      const costEst = (req as { cost_estimate?: number | null }).cost_estimate;
      const invoiceId = crypto.randomUUID();
      const { error: invErr } = await supabase.from("invoices").insert({
        id: invoiceId,
        submitter_user_id: session.user.id,
        department_id: null,
        program_id: null,
        service_description: `Office request: ${(req as { title: string }).title}`,
        currency: "GBP",
        invoice_type: "other",
        project_id: (req as { project_id?: string | null }).project_id ?? null,
      });
      if (!invErr) {
        await supabase.from("invoice_workflows").insert({
          invoice_id: invoiceId,
          status: "ready_for_payment",
          manager_user_id: null,
        });
        await supabase.from("invoice_extracted_fields").upsert(
          {
            invoice_id: invoiceId,
            gross_amount: costEst ?? null,
            needs_review: false,
            manager_confirmed: true,
            raw_json: { source: "office_request", office_request_id: id },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "invoice_id" }
        );
        linkedInvoiceId = invoiceId;
      }
    }

    const { error: reqErr } = await supabase
      .from("office_requests")
      .update({
        status: "completed",
        linked_invoice_id: linkedInvoiceId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (reqErr) throw reqErr;

    const requesterId = (req as { requester_user_id: string }).requester_user_id;
    const { data: user } = await supabase.auth.admin.getUserById(requesterId);
    const email = user?.user?.email;

    if (email && email.includes("@")) {
      await sendOfficeRequestCompletedEmail({
        to: email,
        title: (req as { title: string }).title,
        description: (req as { description?: string | null }).description,
        completionNotes,
        link: `${APP_URL}/office-requests`,
      });
    }

    const { data: updated } = await supabase.from("office_requests").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
