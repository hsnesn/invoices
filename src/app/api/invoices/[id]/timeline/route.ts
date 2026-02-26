import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const allowed = await canAccessInvoice(supabase, invoiceId, session.user.id, {
      role: profile.role,
      department_id: profile.department_id,
      program_ids: profile.program_ids,
      full_name: profile.full_name ?? null,
    });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: events } = await supabase
      .from("audit_events")
      .select("id, event_type, from_status, to_status, payload, actor_user_id, created_at")
      .eq("invoice_id", invoiceId)
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
