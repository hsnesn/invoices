/**
 * AI suggestion: use requirements + availability to suggest assignments.
 * Admin, operations, manager only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Only admin and operations can run AI suggest. Manager can only request (enter demand). */
function canRunAiSuggest(role: string) {
  return role === "admin" || role === "operations";
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
    if (!canRunAiSuggest(profile.role)) {
      return NextResponse.json({ error: "Only admin or operations can run AI suggest." }, { status: 403 });
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
    const suggestedSeen = new Set<string>();
    const suggestedDeduped = suggested.filter((s) => {
      const key = `${s.user_id}|${s.date}`;
      if (suggestedSeen.has(key)) return false;
      suggestedSeen.add(key);
      return true;
    });

    const { data: existing } = await supabase
      .from("output_schedule_assignments")
      .select("id, user_id, date")
      .gte("date", start)
      .lte("date", end)
      .eq("status", "pending");
    const existingIds = (existing ?? []).map((r: { id: string }) => r.id);
    const existingKeys = new Set((existing ?? []).map((r: { user_id: string; date: string }) => `${r.user_id}|${r.date}`));

    if (existingIds.length > 0) {
      await supabase.from("output_schedule_assignments").delete().in("id", existingIds);
    }

    const { data: confirmed } = await supabase
      .from("output_schedule_assignments")
      .select("user_id, date")
      .gte("date", start)
      .lte("date", end)
      .eq("status", "confirmed");
    for (const r of confirmed ?? []) {
      existingKeys.add(`${(r as { user_id: string }).user_id}|${(r as { date: string }).date}`);
    }

    const deduped = suggestedDeduped.filter((s) => !existingKeys.has(`${s.user_id}|${s.date}`));
    if (deduped.length > 0) {
      const rows = deduped.map((s) => ({
        user_id: s.user_id,
        date: s.date,
        role: s.role,
        status: "pending",
      }));
      const { error: insErr } = await supabase.from("output_schedule_assignments").insert(rows);
      if (insErr) throw insErr;

      const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { sendContractorAssignmentsPendingEmail } = await import("@/lib/email");
      await sendContractorAssignmentsPendingEmail({
        to: "london.operations@trtworld.com",
        monthLabel,
        count: deduped.length,
        reviewUrl: `${appUrl}/contractor-availability?tab=assignments&month=${month}`,
      });
    }

    return NextResponse.json({ ok: true, count: deduped.length, assignments: deduped });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
