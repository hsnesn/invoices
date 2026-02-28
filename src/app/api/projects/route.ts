/**
 * Projects: list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const status = STATUSES.includes((body.status as (typeof STATUSES)[number]) ?? "active") ? body.status : "active";
    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    const deadline = typeof body.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline) ? body.deadline : null;
    const assigneeUserId = typeof body.assignee_user_id === "string" ? body.assignee_user_id.trim() || null : null;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        description,
        status,
        deadline,
        assignee_user_id: assigneeUserId,
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
