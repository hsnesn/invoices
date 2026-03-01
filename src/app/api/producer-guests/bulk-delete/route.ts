/**
 * Bulk delete producer guests and/or guest invitations. guest_contacts (contact list) is never touched.
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
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No valid guest IDs to delete" }, { status: 400 });
    }

    const isAdmin = profile.role === "admin";
    let deleted = 0;

    // Delete from producer_guests
    let pgQuery = supabase.from("producer_guests").select("id").in("id", ids);
    if (!isAdmin) pgQuery = pgQuery.eq("producer_user_id", session.user.id);
    const { data: pgRows } = await pgQuery;
    const pgIds = (pgRows ?? []).map((r) => r.id);
    if (pgIds.length > 0) {
      const { error } = await supabase.from("producer_guests").delete().in("id", pgIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deleted += pgIds.length;
    }

    // Delete from guest_invitations (remaining ids)
    const remainingIds = ids.filter((id) => !pgIds.includes(id));
    if (remainingIds.length > 0) {
      let invQuery = supabase.from("guest_invitations").select("id").in("id", remainingIds);
      if (!isAdmin) {
        invQuery = invQuery.or(`producer_user_id.eq.${session.user.id},producer_user_id.is.null`);
      }
      const { data: invRows } = await invQuery;
      const invIds = (invRows ?? []).map((r) => r.id);
      if (invIds.length > 0) {
        const { error } = await supabase.from("guest_invitations").delete().in("id", invIds);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        deleted += invIds.length;
      }
    }

    if (deleted === 0) {
      return NextResponse.json({ error: "No guests found or not accessible" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
