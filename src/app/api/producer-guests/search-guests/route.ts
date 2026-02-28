/**
 * Search guests for autocomplete - returns matching producer_guests and guest_contacts.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function GET(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const limit = Math.min(20, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10) || 10));

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const supabase = createAdminClient();
    const qNorm = normalize(q);

    const isAdmin = profile.role === "admin";
    let pgQuery = supabase
      .from("producer_guests")
      .select("id, guest_name, email, title, program_name")
      .or(`guest_name.ilike.%${q}%,email.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!isAdmin) pgQuery = pgQuery.eq("producer_user_id", session.user.id);

    const { data: pgRows } = await pgQuery;
    const seen = new Set<string>();
    const results: { guest_name: string; email: string | null; title: string | null; program_name: string | null; source: string }[] = [];

    for (const r of pgRows ?? []) {
      const key = `${normalize((r as { guest_name?: string }).guest_name ?? "")}|${((r as { email?: string }).email ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        guest_name: (r as { guest_name: string }).guest_name,
        email: (r as { email?: string | null }).email ?? null,
        title: (r as { title?: string | null }).title ?? null,
        program_name: (r as { program_name?: string | null }).program_name ?? null,
        source: "invited",
      });
    }

    if (results.length < limit && profile.role === "admin") {
      const { data: gcRows } = await supabase
        .from("guest_contacts")
        .select("guest_name, email, title, primary_program")
        .or(`guest_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(limit - results.length);
      for (const r of gcRows ?? []) {
        const name = (r as { guest_name?: string }).guest_name ?? "";
        const email = (r as { email?: string | null }).email ?? null;
        const key = `${normalize(name)}|${(email ?? "").toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          guest_name: name,
          email,
          title: (r as { title?: string | null }).title ?? null,
          program_name: (r as { primary_program?: string | null }).primary_program ?? null,
          source: "contacts",
        });
      }
    }

    return NextResponse.json(results.slice(0, limit));
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
