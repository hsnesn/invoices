/**
 * Check if a guest with same name+email already exists for this producer.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function GET(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const name = request.nextUrl.searchParams.get("name")?.trim();
    const email = request.nextUrl.searchParams.get("email")?.trim();

    if (!name || name.length < 2) {
      return NextResponse.json({ exists: false });
    }

    const supabase = createAdminClient();
    const nameNorm = normalize(name);
    const emailNorm = (email ?? "").toLowerCase().trim();

    let query = supabase
      .from("producer_guests")
      .select("id, guest_name, email")
      .eq("producer_user_id", session.user.id);

    const { data: rows } = await query;
    const exists = (rows ?? []).some((r) => {
      const rName = normalize((r as { guest_name?: string }).guest_name ?? "");
      const rEmail = ((r as { email?: string | null }).email ?? "").toLowerCase().trim();
      if (rName !== nameNorm) return false;
      if (!emailNorm) return true;
      return rEmail === emailNorm;
    });

    return NextResponse.json({ exists });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ exists: false });
  }
}
