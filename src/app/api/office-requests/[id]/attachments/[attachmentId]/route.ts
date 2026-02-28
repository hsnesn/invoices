/**
 * Delete office request attachment.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BUCKET = "office-request-attachments";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id, attachmentId } = await context.params;

    const supabase = createAdminClient();
    const { data: att, error: fetchErr } = await supabase
      .from("office_request_attachments")
      .select("id, storage_path, office_request_id")
      .eq("id", attachmentId)
      .eq("office_request_id", id)
      .single();

    if (fetchErr || !att) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    const { data: req } = await supabase
      .from("office_requests")
      .select("requester_user_id")
      .eq("id", id)
      .single();

    const canDelete = req && ((req as { requester_user_id: string }).requester_user_id === session.user.id ||
      profile.role === "admin" || profile.role === "operations");
    if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await supabase.storage.from(BUCKET).remove([(att as { storage_path: string }).storage_path]);
    const { error: delErr } = await supabase
      .from("office_request_attachments")
      .delete()
      .eq("id", attachmentId);

    if (delErr) throw delErr;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
