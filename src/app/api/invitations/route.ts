import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("user_invitations")
      .select("*")
      .order("invited_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
