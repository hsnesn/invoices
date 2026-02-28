/**
 * Office request todo: update assignee, due date, status.
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
    const { id } = await context.params;
    const body = await request.json();

    const supabase = createAdminClient();
    const { data: req } = await supabase.from("office_requests").select("id, status").eq("id", id).single();
    if (!req || (req as { status: string }).status !== "approved") {
      return NextResponse.json({ error: "Request not found or not approved" }, { status: 404 });
    }

    const canEdit = profile.role === "admin" || profile.role === "operations";
    const { data: todo } = await supabase.from("office_request_todos").select("*").eq("office_request_id", id).single();
    const isAssignee = (todo as { assignee_user_id?: string })?.assignee_user_id === session.user.id;

    if (!canEdit && !isAssignee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.assignee_user_id !== undefined) updates.assignee_user_id = body.assignee_user_id || null;
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;
    if (body.status !== undefined && ["pending", "in_progress", "completed"].includes(body.status)) {
      updates.status = body.status;
    }

    const { error } = await supabase
      .from("office_request_todos")
      .update(updates)
      .eq("office_request_id", id);

    if (error) throw error;
    const { data: updated } = await supabase.from("office_request_todos").select("*").eq("office_request_id", id).single();
    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
