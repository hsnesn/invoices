/**
 * Get unread message count for the current user.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session } = await requireAuth();
    const supabase = createAdminClient();

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", session.user.id)
      .is("read_at", null);

    if (error) throw error;

    return NextResponse.json({ unread: count ?? 0 });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ unread: 0 });
  }
}
