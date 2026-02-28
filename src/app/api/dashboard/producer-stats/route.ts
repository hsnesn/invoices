/**
 * Producer dashboard stats: Your guests this month, most frequent guests, response rate.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const { data: guests, error } = await supabase
      .from("producer_guests")
      .select("id, guest_name, email, invited_at, accepted, created_at")
      .eq("producer_user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const guestsThisMonth = (guests ?? []).filter((g) => {
      const invited = (g as { invited_at?: string | null }).invited_at;
      return invited && invited >= thisMonthStart;
    }).length;

    const invitedWithResponse = (guests ?? []).filter((g) => {
      const inv = (g as { invited_at?: string | null }).invited_at;
      const acc = (g as { accepted?: boolean | null }).accepted;
      return inv && acc !== null;
    });
    const acceptedCount = invitedWithResponse.filter((g) => (g as { accepted?: boolean | null }).accepted === true).length;
    const responseRate =
      invitedWithResponse.length > 0 ? Math.round((acceptedCount / invitedWithResponse.length) * 100) : null;

    const byGuest = new Map<string, { displayName: string; count: number }>();
    for (const g of guests ?? []) {
      const raw = ((g as { guest_name?: string }).guest_name ?? "").trim();
      const key = raw.toLowerCase();
      if (!key) continue;
      const existing = byGuest.get(key);
      if (existing) {
        existing.count++;
      } else {
        byGuest.set(key, { displayName: raw, count: 1 });
      }
    }
    const mostFrequent = Array.from(byGuest.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ displayName, count }) => ({ guest_name: displayName, count }));

    return NextResponse.json({
      guests_this_month: guestsThisMonth,
      response_rate: responseRate,
      most_frequent_guests: mostFrequent,
      total_invited: (guests ?? []).filter((g) => (g as { invited_at?: string | null }).invited_at).length,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
