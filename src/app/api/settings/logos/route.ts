/**
 * Public API: returns logo URLs for each scenario.
 * Used by Nav, Dashboard, UploadOverlay, etc.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function toLogoUrl(value: unknown): string {
  let v: string;
  if (typeof value === "string") {
    v = value.trim();
  } else if (value && typeof value === "object" && "url" in (value as Record<string, unknown>)) {
    v = String((value as Record<string, string>).url).trim();
  } else if (value !== null && value !== undefined) {
    v = String(value).trim();
  } else {
    return "";
  }
  if (!v) return "";
  // jsonb::text can wrap strings in quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `/${v.startsWith("/") ? v.slice(1) : v}`;
}

function addCacheBust(url: string, updatedAt: string | null): string {
  if (!url) return url;
  const ts = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${ts}`;
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("get_logo_settings");

    if (error) {
      // Fallback to direct select if RPC missing (e.g. migration not applied)
      const { data: fallback, error: fallbackErr } = await supabase
        .from("app_settings")
        .select("key, value, updated_at")
        .in("key", ["logo_trt", "logo_trt_world", "logo_email"]);
      if (fallbackErr) throw fallbackErr;
      return buildResult(fallback ?? []);
    }

    return buildResult(data ?? []);
  } catch (e) {
    console.error("[logos]", e);
    return NextResponse.json(
      { logo_trt: "/trt-logo.png", logo_trt_world: "/trt-world-logo.png", logo_email: "/logo.png" },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  }
}

function buildResult(rows: { key: string; value: unknown; updated_at?: string | null }[]
): NextResponse {
  const map: Record<string, string> = {
    logo_trt: "/trt-logo.png",
    logo_trt_world: "/trt-world-logo.png",
    logo_email: "/logo.png",
  };
  const updatedMap: Record<string, string | null> = {};

  for (const row of rows) {
    const key = row.key;
    const val = row.value;
    const updatedAt = row.updated_at ?? null;
    const baseUrl = toLogoUrl(val) || map[key];
    map[key] = baseUrl;
    updatedMap[key] = updatedAt;
  }

    const result: Record<string, string> = {};
    for (const k of ["logo_trt", "logo_trt_world", "logo_email"] as const) {
      result[k] = addCacheBust(map[k], updatedMap[k] ?? null);
    }
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}
