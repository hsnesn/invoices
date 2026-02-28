/**
 * Reminder: update or mark done (advance next_due_date).
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

    const supabase = createAdminClient();
    const { data: rem, error: fetchErr } = await supabase
      .from("reminders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !rem) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.frequency_months !== undefined) updates.frequency_months = Math.max(1, body.frequency_months);
    if (body.assignee_user_id !== undefined) updates.assignee_user_id = body.assignee_user_id || null;
    if (body.notify_user_ids !== undefined) updates.notify_user_ids = Array.isArray(body.notify_user_ids) ? body.notify_user_ids : [];
    if (body.is_active !== undefined) updates.is_active = !!body.is_active;

    if (body.mark_done === true) {
      const freq = (rem as { frequency_months: number }).frequency_months || 6;
      const next = new Date((rem as { next_due_date: string }).next_due_date);
      next.setMonth(next.getMonth() + freq);
      updates.next_due_date = next.toISOString().slice(0, 10);
      updates.last_notified_at = new Date().toISOString();
    } else if (body.next_due_date !== undefined) {
      updates.next_due_date = body.next_due_date;
    }

    const { error } = await supabase.from("reminders").update(updates).eq("id", id);
    if (error) throw error;

    const { data: updated } = await supabase.from("reminders").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
