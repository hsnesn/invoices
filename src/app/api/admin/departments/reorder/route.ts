import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrOperations } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const body = await request.json();
    const { ids } = body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }
    const supabase = createAdminClient();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) continue;
      await supabase.from("departments").update({ sort_order: i }).eq("id", id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
