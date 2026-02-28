/**
 * Reminders: list and create (e.g. fire extinguisher maintenance).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") !== "false";

    let query = supabase
      .from("reminders")
      .select("*")
      .order("next_due_date", { ascending: true });

    if (activeOnly) query = query.eq("is_active", true);

    if (profile.role !== "admin" && profile.role !== "operations") {
      query = query.eq("assignee_user_id", session.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const userIds = new Set<string>();
    for (const r of data ?? []) {
      const o = r as { assignee_user_id?: string; notify_user_ids?: string[]; created_by?: string };
      if (o.assignee_user_id) userIds.add(o.assignee_user_id);
      if (o.created_by) userIds.add(o.created_by);
      for (const uid of o.notify_user_ids ?? []) userIds.add(uid);
    }
    const { data: profiles } = userIds.size > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", Array.from(userIds))
      : { data: [] };
    const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || p.id]));

    const enriched = (data ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      return {
        ...o,
        assignee_name: o.assignee_user_id ? profileMap[o.assignee_user_id as string] ?? o.assignee_user_id : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const frequencyMonths = typeof body.frequency_months === "number" ? Math.max(1, body.frequency_months) : 6;
    const nextDueDate = typeof body.next_due_date === "string" ? body.next_due_date : null;
    const assigneeUserId = body.assignee_user_id as string | null;
    const notifyUserIds = Array.isArray(body.notify_user_ids) ? body.notify_user_ids.filter((id: unknown) => typeof id === "string") : [];

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!nextDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) {
      return NextResponse.json({ error: "Valid next_due_date (YYYY-MM-DD) is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("reminders")
      .insert({
        title,
        description: description || null,
        frequency_months: frequencyMonths,
        next_due_date: nextDueDate,
        assignee_user_id: assigneeUserId || null,
        notify_user_ids: notifyUserIds,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
