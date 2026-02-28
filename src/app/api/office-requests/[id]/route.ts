/**
 * Office request: approve or reject.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = body.action as string;
    const assigneeUserId = body.assignee_user_id as string | null;
    const dueDate = body.due_date as string | null;
    const rejectionReason = body.rejection_reason as string | null;

    const supabase = createAdminClient();
    const { data: req, error: fetchErr } = await supabase
      .from("office_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !req) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if ((req as { status: string }).status !== "pending") {
      return NextResponse.json({ error: "Request is no longer pending" }, { status: 400 });
    }

    if (action === "approve") {
      const { error: updateErr } = await supabase
        .from("office_requests")
        .update({
          status: "approved",
          approved_by: session.user.id,
          approved_at: new Date().toISOString(),
          rejected_by: null,
          rejected_at: null,
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateErr) throw updateErr;

      const { error: todoErr } = await supabase.from("office_request_todos").upsert(
        {
          office_request_id: id,
          assignee_user_id: assigneeUserId || null,
          due_date: dueDate || null,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "office_request_id" }
      );
      if (todoErr) throw todoErr;
    } else if (action === "reject") {
      const { error: updateErr } = await supabase
        .from("office_requests")
        .update({
          status: "rejected",
          rejected_by: session.user.id,
          rejected_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null,
          approved_by: null,
          approved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateErr) throw updateErr;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: updated } = await supabase.from("office_requests").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
