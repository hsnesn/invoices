/**
 * Bulk delete producer guests. Only removes from producer_guests; guest_contacts (contact list) is never touched.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const body = (await request.json()) as { ids: string[] };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string" && !x.startsWith("inv-"))
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No valid guest IDs to delete" }, { status: 400 });
    }

    const isAdmin = profile.role === "admin";
    let query = supabase
      .from("producer_guests")
      .select("id")
      .in("id", ids);
    if (!isAdmin) {
      query = query.eq("producer_user_id", session.user.id);
    }
    const { data: existing, error: fetchErr } = await query;
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const toDelete = (existing ?? []).map((r) => r.id);
    if (toDelete.length === 0) {
      return NextResponse.json({ error: "No guests found or not accessible" }, { status: 404 });
    }

    const { error } = await supabase.from("producer_guests").delete().in("id", toDelete);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: toDelete.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
