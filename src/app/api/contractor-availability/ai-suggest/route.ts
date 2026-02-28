/**
 * AI suggestion: use requirements + availability to suggest assignments.
 * Admin, operations, manager only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canManage(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

/** Fair assignment: fill each (date, role) slot from available people, minimizing variance in shifts per person. */
function suggestAssignments(
  requirements: { date: string; role: string; count_needed: number }[],
  availability: { user_id: string; date: string; role: string | null }[]
): { user_id: string; date: string; role: string }[] {
  const availByDateRole = new Map<string, Set<string>>();
  for (const a of availability) {
    const role = a.role?.trim() || "";
    const key = `${a.date}|${role}`;
    if (!availByDateRole.has(key)) availByDateRole.set(key, new Set());
    availByDateRole.get(key)!.add(a.user_id);
  }
  const shiftsPerUser = new Map<string, number>();

  const result: { user_id: string; date: string; role: string }[] = [];

  for (const req of requirements) {
    if (req.count_needed <= 0) continue;
    const key = `${req.date}|${req.role}`;
    const available = availByDateRole.get(key);
    if (!available || available.size === 0) continue;

    const sorted = Array.from(available).sort((a, b) => {
      const sa = shiftsPerUser.get(a) ?? 0;
      const sb = shiftsPerUser.get(b) ?? 0;
      return sa - sb;
    });

    let taken = 0;
    for (const uid of sorted) {
      if (taken >= req.count_needed) break;
      result.push({ user_id: uid, date: req.date, role: req.role });
      shiftsPerUser.set(uid, (shiftsPerUser.get(uid) ?? 0) + 1);
      taken++;
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const month = (body.month as string) ?? new URL(request.url).searchParams.get("month");
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);

    const supabase = createAdminClient();

    const { data: reqRows } = await supabase
      .from("contractor_availability_requirements")
      .select("date, role, count_needed")
      .gte("date", start)
      .lte("date", end);
    const requirements = (reqRows ?? []) as { date: string; role: string; count_needed: number }[];
    if (requirements.length === 0) {
      return NextResponse.json({ error: "No requirements set for this month. Set daily requirements first." }, { status: 400 });
    }

    const { data: availRows } = await supabase
      .from("output_schedule_availability")
      .select("user_id, date, role")
      .gte("date", start)
      .lte("date", end);
    const availability = (availRows ?? []) as { user_id: string; date: string; role: string | null }[];

    const suggested = suggestAssignments(requirements, availability);

    const { data: existing } = await supabase
      .from("output_schedule_assignments")
      .select("id")
      .gte("date", start)
      .lte("date", end)
      .eq("status", "pending");
    const existingIds = (existing ?? []).map((r: { id: string }) => r.id);

    if (existingIds.length > 0) {
      await supabase.from("output_schedule_assignments").delete().in("id", existingIds);
    }

    if (suggested.length > 0) {
      const rows = suggested.map((s) => ({
        user_id: s.user_id,
        date: s.date,
        role: s.role,
        status: "pending",
      }));
      const { error: insErr } = await supabase.from("output_schedule_assignments").insert(rows);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true, count: suggested.length, assignments: suggested });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
