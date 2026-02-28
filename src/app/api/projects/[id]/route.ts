/**
 * Project: get, update, or delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const supabase = createAdminClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null;
    if (body.status !== undefined) updates.status = STATUSES.includes(body.status as (typeof STATUSES)[number]) ? body.status : existing.status;
    if (body.deadline !== undefined) updates.deadline = body.deadline && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline) ? body.deadline : null;
    if (body.assignee_user_id !== undefined) updates.assignee_user_id = body.assignee_user_id ? String(body.assignee_user_id).trim() : null;

    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) throw error;

    const { data: updated } = await supabase.from("projects").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const supabase = createAdminClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
