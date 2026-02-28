/**
 * Admin: set logo by path or URL (without file upload).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const LOGO_KEYS = ["logo_trt", "logo_trt_world", "logo_email"] as const;

export async function PATCH(request: NextRequest) {
  try {
    try {
      await requireAdmin();
    } catch (e) {
      if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") {
        return NextResponse.json({ error: "Not authorised. Please refresh and log in again." }, { status: 401 });
      }
      throw e;
    }

    const body = await request.json();
    const { key, value } = body as { key: string; value: string };

    if (!key || !LOGO_KEYS.includes(key as (typeof LOGO_KEYS)[number])) {
      return NextResponse.json({ error: "Invalid key." }, { status: 400 });
    }
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: "Value is required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: value.trim(), updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
