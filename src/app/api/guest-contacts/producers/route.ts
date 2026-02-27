/**
 * List producers (active profiles with email) for guest invite emails.
 * Reply-to will use the producer's registered email.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");

    if (error) throw error;

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email);
    }

    const producers = (profiles ?? [])
      .map((p) => ({
        id: p.id,
        full_name: p.full_name || "Unknown",
        email: emailMap.get(p.id) ?? null,
      }))
      .filter((p) => p.email);

    return NextResponse.json(producers);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
