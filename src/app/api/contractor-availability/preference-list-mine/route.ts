/**
 * Per-user preference list: each person saves who they prefer to work with.
 * AI suggest prefers people who appear in more users' lists (when available).
 * Same access as Request page: admin, operations, manager.
 */
import { NextRequest, NextResponse } from "next/server";
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
    const { data } = await supabase
      .from("contractor_preference_per_user")
      .select("preferred_user_id, sort_order")
      .eq("user_id", profile.id)
      .order("sort_order");

    const ids = (data ?? []).map((r: { preferred_user_id: string }) => r.preferred_user_id);
    if (ids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);

    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
    }

    const users = ids.map((user_id) => ({
      user_id,
      full_name: nameMap.get(user_id) ?? "Unknown",
    }));

    return NextResponse.json({ users });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canAccess(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userIds = body.user_ids as unknown;
    if (!Array.isArray(userIds)) {
      return NextResponse.json({ error: "user_ids must be an array of UUIDs." }, { status: 400 });
    }
    const valid = userIds.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x));

    const supabase = createAdminClient();

    await supabase
      .from("contractor_preference_per_user")
      .delete()
      .eq("user_id", profile.id);

    if (valid.length > 0) {
      const rows = valid.map((preferred_user_id, i) => ({
        user_id: profile.id,
        preferred_user_id,
        sort_order: i,
      }));
      const { error } = await supabase.from("contractor_preference_per_user").insert(rows);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, user_ids: valid });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
