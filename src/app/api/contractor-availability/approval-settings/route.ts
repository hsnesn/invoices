/**
 * Contractor approval: which users (admin/operations/manager) can approve assignments.
 * Admin always can. Others need to be in contractor_approval_user_ids.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KEY = "contractor_approval_user_ids";

function getIds(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x) => typeof x === "string" && x.length > 0);
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).single();
    const ids = getIds((data as { value?: unknown } | null)?.value ?? []);

    const { data: profiles } = await supabase.from("profiles").select("id, full_name, role").in("role", ["admin", "operations", "manager"]);
    const users = (profiles ?? []).map((p: { id: string; full_name: string | null; role: string }) => ({
      id: p.id,
      full_name: p.full_name ?? "Unknown",
      role: p.role,
      canApprove: p.role === "admin" || ids.includes(p.id),
    }));

    return NextResponse.json({ userIds: ids, users });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { userIds } = body as { userIds?: string[] };
    const ids = Array.isArray(userIds) ? userIds.filter((x) => typeof x === "string" && x.length > 0) : [];

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: KEY, value: ids, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;

    return NextResponse.json({ ok: true, userIds: ids });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
