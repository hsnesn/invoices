import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/salaries/[id]/audit - Fetch audit log for a salary */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: events } = await supabase
      .from("audit_events")
      .select("id, event_type, from_status, to_status, payload, actor_user_id, created_at")
      .eq("salary_id", id)
      .order("created_at", { ascending: true });

    const actorIds = Array.from(new Set((events ?? []).map((e) => e.actor_user_id).filter(Boolean)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds.length > 0 ? actorIds : ["_"]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.id]));

    return NextResponse.json(
      (events ?? []).map((e) => ({
        ...e,
        actor_name: e.actor_user_id ? profileMap.get(e.actor_user_id) ?? e.actor_user_id : "System",
      }))
    );
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
