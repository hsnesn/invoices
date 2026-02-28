/**
 * Office request: approve or reject.
 * Sends emails: approved → requester (+ assignee if assigned); rejected → requester.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import {
  sendOfficeRequestApprovedEmail,
  sendOfficeRequestRejectedEmail,
  sendOfficeRequestAssignedEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function getEmailForUserId(supabase: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId);
  const email = data?.user?.email;
  return email && email.includes("@") ? email : null;
}

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

    const reqRow = req as { title: string; requester_user_id: string };
    const link = `${APP_URL}/office-requests`;

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

      const requesterEmail = await getEmailForUserId(supabase, reqRow.requester_user_id);
      if (requesterEmail) {
        const { data: assigneeProfile } = assigneeUserId
          ? await supabase.from("profiles").select("full_name").eq("id", assigneeUserId).single()
          : { data: null };
        const assigneeName = assigneeProfile?.full_name ?? null;
        await sendOfficeRequestApprovedEmail({
          to: requesterEmail,
          title: reqRow.title,
          assigneeName,
          link,
        }).catch(() => {});
      }

      if (assigneeUserId && assigneeUserId !== reqRow.requester_user_id) {
        const assigneeEmail = await getEmailForUserId(supabase, assigneeUserId);
        if (assigneeEmail) {
          await sendOfficeRequestAssignedEmail({
            to: assigneeEmail,
            title: reqRow.title,
            dueDate: dueDate || null,
            link,
          }).catch(() => {});
        }
      }
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

      const requesterEmail = await getEmailForUserId(supabase, reqRow.requester_user_id);
      if (requesterEmail) {
        await sendOfficeRequestRejectedEmail({
          to: requesterEmail,
          title: reqRow.title,
          rejectionReason: rejectionReason || null,
          link,
        }).catch(() => {});
      }
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
