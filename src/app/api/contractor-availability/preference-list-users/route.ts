/**
 * Returns list of users (id, full_name) for the preference list dropdown.
 * When contractor_preference_pool is populated, only those users are returned.
 * When empty, all active users are returned (backward compatible).
 * Same access as Request: admin, operations, manager.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canAccess(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (!canAccess(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data: poolRows } = await supabase
      .from("contractor_preference_pool")
      .select("user_id")
      .order("sort_order")
      .order("created_at");

    const poolUserIds = (poolRows ?? []).map((r: { user_id: string }) => r.user_id);

    let userIds: string[];

    if (poolUserIds.length > 0) {
      userIds = poolUserIds;
    } else {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_active", true);
      userIds = (allProfiles ?? []).map((p: { id: string }) => p.id);
    }

    if (userIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds)
      .eq("is_active", true);

    if (error) throw error;

    const profMap = new Map<string, string>();
    for (const p of data ?? []) {
      profMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
    }

    const users = userIds
      .filter((id) => profMap.has(id))
      .map((id) => ({
        id,
        full_name: profMap.get(id) ?? "Unknown",
      }));

    return NextResponse.json(users);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
