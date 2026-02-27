/**
 * List users that can be messaged (active profiles, excluding self).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session } = await requireAuth();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .neq("id", session.user.id)
      .order("full_name");

    if (error) throw error;

    return NextResponse.json(
      (data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name || p.id,
        role: (p as { role?: string }).role,
      }))
    );
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
