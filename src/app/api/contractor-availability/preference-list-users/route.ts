/**
 * Returns list of users (id, full_name) for the preference list dropdown.
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
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");

    if (error) throw error;
    const users = (data ?? []).map((p: { id: string; full_name: string | null }) => ({
      id: p.id,
      full_name: p.full_name ?? "Unknown",
    }));
    return NextResponse.json(users);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
