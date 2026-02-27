import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("app_settings").select("key, value");
    if (error) throw error;
    const map: Record<string, unknown> = {};
    for (const row of data ?? []) {
      map[(row as { key: string }).key] = (row as { value: unknown }).value;
    }
    return NextResponse.json(map);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { key, value } = body as { key: string; value: unknown };
    if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: value ?? null, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
