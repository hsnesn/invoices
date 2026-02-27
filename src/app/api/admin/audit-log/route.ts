/**
 * GET /api/admin/audit-log - Fetch audit events for compliance (admin only)
 * Query: invoice_id, actor_id, event_type, from_date, to_date, limit
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("invoice_id");
    const actorId = searchParams.get("actor_id");
    const eventType = searchParams.get("event_type");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "500", 10), 2000);

    const supabase = createAdminClient();
    let q = supabase
      .from("audit_events")
      .select("id, invoice_id, salary_id, actor_user_id, event_type, from_status, to_status, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (invoiceId) q = q.eq("invoice_id", invoiceId);
    if (actorId) q = q.eq("actor_user_id", actorId);
    if (eventType) q = q.eq("event_type", eventType);
    if (fromDate) q = q.gte("created_at", fromDate);
    if (toDate) q = q.lte("created_at", toDate + "T23:59:59.999Z");

    const { data: events, error } = await q;

    if (error) throw error;

    const actorIds = Array.from(new Set((events ?? []).map((e) => e.actor_user_id).filter(Boolean)));
    const { data: profiles } =
      actorIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
        : { data: [] };
    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || p.id])
    );

    const rows = (events ?? []).map((e) => ({
      ...e,
      actor_name: e.actor_user_id ? profileMap[e.actor_user_id] ?? e.actor_user_id : "System",
    }));

    return NextResponse.json(rows);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
