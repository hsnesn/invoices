import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;

    if (profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { data: wf } = await supabase
      .from("invoice_workflows")
      .select("manager_user_id, status")
      .eq("invoice_id", invoiceId)
      .single();

    if (!wf || wf.status !== "pending_manager") {
      return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    const { data: inv } = await supabase
      .from("invoices")
      .select("department_id, program_id")
      .eq("id", invoiceId)
      .single();

    const canManage =
      wf.manager_user_id === session.user.id ||
      inv?.program_id ||
      inv?.department_id;

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase
      .from("invoice_extracted_fields")
      .update({ manager_confirmed: true })
      .eq("invoice_id", invoiceId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to confirm" },
        { status: 500 }
      );
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "bank_details_confirmed",
      payload: {},
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
