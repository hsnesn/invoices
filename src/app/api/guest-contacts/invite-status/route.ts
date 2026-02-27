/**
 * Get latest invite status per guest (from producer_guests).
 * Used by guest_contacts page to show accepted/rejected/no_response/no_match.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function GET() {
  try {
    const { profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_contacts"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("producer_guests")
      .select("guest_name, invited_at, accepted, matched_at")
      .order("invited_at", { ascending: false });

    if (error) throw error;

    const byKey = new Map<string, { accepted: boolean | null; invited_at: string | null; matched_at: string | null }>();
    for (const r of rows ?? []) {
      const key = normalizeName(r.guest_name ?? "");
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, {
          accepted: r.accepted ?? null,
          invited_at: r.invited_at ?? null,
          matched_at: r.matched_at ?? null,
        });
      }
    }

    const result: Record<string, { accepted: boolean | null; invited_at: string | null; matched_at: string | null }> = {};
    for (const [k, v] of byKey) {
      result[k] = v;
    }
    return NextResponse.json(result);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
