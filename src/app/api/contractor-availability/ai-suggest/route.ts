/**
 * AI suggestion: use requirements + availability to suggest assignments.
 * Admin, operations, manager only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { getMergedRequirements } from "@/lib/contractor-requirements";

export const dynamic = "force-dynamic";

/** Only admin and operations can run AI suggest. Manager can only request (enter demand). */
function canRunAiSuggest(role: string) {
  return role === "admin" || role === "operations";
}

/** Fair assignment: fill each (date, role) slot from available people.
 * Uses preference list (most assigned first) when multiple people available, then minimizes variance in shifts. */
function suggestAssignments(
  requirements: { date: string; role: string; count_needed: number }[],
  availability: { user_id: string; date: string; role: string | null }[],
  preferenceByRole: Map<string, Map<string, number>>
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

    const prefMap = preferenceByRole.get(req.role);

    const sorted = Array.from(available).sort((a, b) => {
      const prefA = prefMap?.get(a) ?? 0;
      const prefB = prefMap?.get(b) ?? 0;
      if (prefB !== prefA) return prefB - prefA;
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
    const departmentId = body.department_id as string | undefined;
    const programId = body.program_id as string | undefined;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }
    if (!departmentId || !/^[0-9a-f-]{36}$/i.test(departmentId)) {
      return NextResponse.json({ error: "department_id is required." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    const progId = programId && /^[0-9a-f-]{36}$/i.test(programId) ? programId : null;

    const supabase = createAdminClient();

    const requirements = await getMergedRequirements(supabase, start, end, departmentId, progId);
    if (requirements.length === 0) {
      return NextResponse.json({ error: "No requirements set for this month. Set daily requirements first." }, { status: 400 });
    }

    let availQuery = supabase
      .from("output_schedule_availability")
      .select("user_id, date, role")
      .eq("department_id", departmentId)
      .gte("date", start)
      .lte("date", end);
    if (progId) availQuery = availQuery.eq("program_id", progId);
    else availQuery = availQuery.is("program_id", null);
    const { data: availRows } = await availQuery;
    const availability = (availRows ?? []) as { user_id: string; date: string; role: string | null }[];

    let prefQuery = supabase
      .from("output_schedule_assignments")
      .select("user_id, role")
      .eq("department_id", departmentId);
    if (progId) prefQuery = prefQuery.eq("program_id", progId);
    else prefQuery = prefQuery.is("program_id", null);
    const { data: prefRows } = await prefQuery;
    const preferenceByRole = new Map<string, Map<string, number>>();
    for (const r of prefRows ?? []) {
      const uid = (r as { user_id: string }).user_id;
      const roleKey = ((r as { role: string | null }).role ?? "").trim();
      if (!roleKey) continue;
      if (!preferenceByRole.has(roleKey)) preferenceByRole.set(roleKey, new Map());
      const m = preferenceByRole.get(roleKey)!;
      m.set(uid, (m.get(uid) ?? 0) + 1);
    }

    const suggested = suggestAssignments(requirements, availability, preferenceByRole);
    const suggestedSeen = new Set<string>();
    const suggestedDeduped = suggested.filter((s) => {
      const key = `${s.user_id}|${s.date}`;
      if (suggestedSeen.has(key)) return false;
      suggestedSeen.add(key);
      return true;
    });

    let existingQuery = supabase
      .from("output_schedule_assignments")
      .select("id, user_id, date")
      .eq("department_id", departmentId)
      .gte("date", start)
      .lte("date", end)
      .eq("status", "pending");
    if (progId) existingQuery = existingQuery.eq("program_id", progId);
    else existingQuery = existingQuery.is("program_id", null);
    const { data: existing } = await existingQuery;
    const existingIds = (existing ?? []).map((r: { id: string }) => r.id);
    const existingKeys = new Set((existing ?? []).map((r: { user_id: string; date: string }) => `${r.user_id}|${r.date}`));

    if (existingIds.length > 0) {
      await supabase.from("output_schedule_assignments").delete().in("id", existingIds);
    }

    let confirmedQuery = supabase
      .from("output_schedule_assignments")
      .select("user_id, date")
      .eq("department_id", departmentId)
      .gte("date", start)
      .lte("date", end)
      .eq("status", "confirmed");
    if (progId) confirmedQuery = confirmedQuery.eq("program_id", progId);
    else confirmedQuery = confirmedQuery.is("program_id", null);
    const { data: confirmed } = await confirmedQuery;
    for (const r of confirmed ?? []) {
      existingKeys.add(`${(r as { user_id: string }).user_id}|${(r as { date: string }).date}`);
    }

    const deduped = suggestedDeduped.filter((s) => !existingKeys.has(`${s.user_id}|${s.date}`));
    if (deduped.length > 0) {
      const rows = deduped.map((s) => ({
        user_id: s.user_id,
        date: s.date,
        role: s.role,
        department_id: departmentId,
        program_id: progId,
        status: "pending",
      }));
      const { error: insErr } = await supabase.from("output_schedule_assignments").insert(rows);
      if (insErr) throw insErr;

      const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      const nameMap = new Map<string, string>();
      for (const p of profiles ?? []) {
        nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
      }
      const assignmentsForEmail = [...deduped]
        .sort((a, b) => a.date.localeCompare(b.date) || a.role.localeCompare(b.role))
        .map((s) => ({
          personName: nameMap.get(s.user_id) ?? "Unknown",
          date: s.date,
          role: s.role,
        }));
      const { sendContractorAssignmentsPendingEmail } = await import("@/lib/email");
      await sendContractorAssignmentsPendingEmail({
        to: "london.operations@trtworld.com",
        monthLabel,
        count: deduped.length,
        reviewUrl: `${appUrl}/contractor-availability?tab=assignments&month=${month}`,
        assignments: assignmentsForEmail,
      });
    }

    return NextResponse.json({ ok: true, count: deduped.length, assignments: deduped });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
