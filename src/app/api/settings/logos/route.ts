/**
 * Public API: returns logo URLs for each scenario.
 * Used by Nav, Dashboard, UploadOverlay, etc.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function toLogoUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `/${v.startsWith("/") ? v.slice(1) : v}`;
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["logo_trt", "logo_trt_world", "logo_email"]);

    if (error) throw error;

    const map: Record<string, string> = {
      logo_trt: "/trt-logo.png",
      logo_trt_world: "/trt-world-logo.png",
      logo_email: "/logo.png",
    };

    for (const row of data ?? []) {
      const key = (row as { key: string }).key;
      const val = (row as { value: unknown }).value;
      map[key] = toLogoUrl(val) || map[key];
    }

    return NextResponse.json(map);
  } catch (e) {
    console.error("[logos]", e);
    return NextResponse.json(
      { logo_trt: "/trt-logo.png", logo_trt_world: "/trt-world-logo.png", logo_email: "/logo.png" },
      { status: 200 }
    );
  }
}
