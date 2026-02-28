/**
 * Dashboard stats: pending assignments count, slots short this week.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { getMergedRequirements } from "@/lib/contractor-requirements";

export const dynamic = "force-dynamic";

function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export async function GET() {
  try {
    const { profile } = await requireAuth();
    const canManage = ["admin", "operations", "manager"].includes(profile.role);
    if (!canManage) {
      return NextResponse.json({ pendingCount: 0, slotsShort: 0 });
    }

    const supabase = createAdminClient();
    const { start, end } = getWeekRange();

    const { count: pendingCount } = await supabase
      .from("output_schedule_assignments")
      .select("id", { count: "exact", head: true })
      .gte("date", start)
      .lte("date", end)
      .eq("status", "pending");

    const requirements = await getMergedRequirements(supabase, start, end);

    const { data: assignRows } = await supabase
      .from("output_schedule_assignments")
      .select("date, role")
      .gte("date", start)
      .lte("date", end)
      .in("status", ["pending", "confirmed"]);
    const filledByKey = new Map<string, number>();
    for (const a of assignRows ?? []) {
      const key = `${(a as { date: string }).date}|${(a as { role: string }).role || ""}`;
      filledByKey.set(key, (filledByKey.get(key) ?? 0) + 1);
    }
    let slotsShort = 0;
    for (const r of requirements) {
      const key = `${r.date}|${r.role}`;
      const filled = filledByKey.get(key) ?? 0;
      if (filled < r.count_needed) slotsShort += r.count_needed - filled;
    }

    return NextResponse.json({
      pendingCount: pendingCount ?? 0,
      slotsShort,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
