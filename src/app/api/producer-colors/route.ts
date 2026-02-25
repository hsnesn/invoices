import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

/** GET: Returns producer_name -> color_hex map for badge display. */
export async function GET() {
  try {
    await requireAuth();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("producer_colors")
      .select("producer_name, color_hex");
    if (error) throw error;
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: { producer_name: string; color_hex: string }) => {
      map[r.producer_name] = r.color_hex;
    });
    return NextResponse.json(map);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
