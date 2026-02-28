/**
 * Server-side: get logo URL from app_settings.
 * Used by email, PDF generator, etc.
 */
import { createAdminClient } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function toFullUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `${APP_URL}/${v.startsWith("/") ? v.slice(1) : v}`;
}

export async function getLogoUrl(key: "logo_trt" | "logo_trt_world" | "logo_email"): Promise<string> {
  const defaults: Record<string, string> = {
    logo_trt: `${APP_URL}/trt-logo.png`,
    logo_trt_world: `${APP_URL}/trt-world-logo.png`,
    logo_email: `${APP_URL}/logo.png`,
  };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .single();

    if (error || !data) return defaults[key];
    const url = toFullUrl((data as { value: unknown }).value);
    return url || defaults[key];
  } catch {
    return defaults[key];
  }
}
