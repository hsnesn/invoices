/**
 * Slots short overview: all months, departments, programs, positions in one list.
 * Optimized: batch DB queries instead of N+1 per month/dept/program.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ExplicitRow = { date: string; role: string; count_needed: number; department_id: string; program_id: string | null };
type RecurringRow = { day_of_week: number; role: string; count_needed: number; department_id: string; program_id: string | null };
type AssignRow = { date: string; role: string | null; department_id: string; program_id: string | null };

function mergeRequirementsForMonth(
  explicit: ExplicitRow[],
  recurring: RecurringRow[],
  start: string,
  end: string,
  deptId: string,
  progId: string | null
): { date: string; role: string; count_needed: number }[] {
  const [y, m] = start.split("-").map(Number);
  const byKey = new Map<string, number>();

  const deptMatch = (r: { department_id: string }) => r.department_id === deptId;
  const progMatch = (r: { program_id: string | null }) =>
    progId ? r.program_id === progId : r.program_id == null;

  for (const r of explicit) {
    if (!deptMatch(r) || !progMatch(r)) continue;
    byKey.set(`${r.date}|${r.role}`, r.count_needed);
  }

  for (const r of recurring) {
    if (!deptMatch(r) || !progMatch(r)) continue;
    // Will fill in below where not in byKey
  }

  for (let d = new Date(y, m - 1, 1); d <= new Date(y, m, 0); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    for (const rec of recurring) {
      if (!deptMatch(rec) || !progMatch(rec)) continue;
      if (rec.day_of_week !== dow) continue;
      const key = `${dateStr}|${rec.role}`;
      if (!byKey.has(key)) byKey.set(key, rec.count_needed);
    }
  }

  return Array.from(byKey.entries()).map(([key, count_needed]) => {
    const [date, role] = key.split("|");
    return { date, role, count_needed };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!["admin", "operations", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const monthsAhead = Math.min(6, Math.max(1, parseInt(searchParams.get("months") ?? "3", 10) || 3));

    const supabase = createAdminClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekMonday = new Date(now.getFullYear(), now.getMonth(), diff);
    const startDateObj = weekMonday < monthStart ? weekMonday : monthStart;
    const startDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, "0")}-${String(startDateObj.getDate()).padStart(2, "0")}`;
    const endMonth = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 0);
    const endDate = `${endMonth.getFullYear()}-${String(endMonth.getMonth() + 1).padStart(2, "0")}-${String(endMonth.getDate()).padStart(2, "0")}`;

    // Batch fetch: departments, programs, requirements, recurring, assignments
    const [deptRes, progRes, reqRes, recRes, assignRes] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("programs").select("id, name, department_id").order("name"),
      supabase
        .from("contractor_availability_requirements")
        .select("date, role, count_needed, department_id, program_id")
        .gte("date", startDate)
        .lte("date", endDate),
      supabase.from("contractor_availability_recurring").select("day_of_week, role, count_needed, department_id, program_id"),
      supabase
        .from("output_schedule_assignments")
        .select("date, role, department_id, program_id")
        .gte("date", startDate)
        .lte("date", endDate)
        .in("status", ["pending", "confirmed"]),
    ]);

    const departments = (deptRes.data ?? []) as { id: string; name: string }[];
    const programs = (progRes.data ?? []) as { id: string; name: string; department_id: string }[];
    const explicitRows = (reqRes.data ?? []) as ExplicitRow[];
    const recurringRows = (recRes.data ?? []) as RecurringRow[];
    const assignRows = (assignRes.data ?? []) as AssignRow[];

    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    const progMap = new Map(programs.map((p) => [p.id, p.name]));

    type Row = { month: string; monthLabel: string; department_id: string; department: string; program_id: string | null; program: string; role: string; slots_short: number };
    const rows: Row[] = [];
    const loopStartMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), 1);

    for (let m = new Date(loopStartMonth); m <= endMonth; m.setMonth(m.getMonth() + 1)) {
      const y = m.getFullYear();
      const mo = m.getMonth() + 1;
      const monthKey = `${y}-${String(mo).padStart(2, "0")}`;
      const monthLabel = m.toLocaleString("en-GB", { month: "long", year: "numeric" });
      const start = new Date(y, mo - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, mo, 0).toISOString().slice(0, 10);

      // Per-program
      for (const dept of departments) {
        const deptId = dept.id;
        const progsForDept = programs.filter((p) => p.department_id === deptId);
        for (const prog of progsForDept) {
          const progId = prog.id;
          const requirements = mergeRequirementsForMonth(explicitRows, recurringRows, start, end, deptId, progId);
          if (requirements.length === 0) continue;

          const filledByKey = new Map<string, number>();
          for (const a of assignRows) {
            if (a.department_id !== deptId || a.program_id !== progId) continue;
            const d = (a as { date: string }).date;
            if (d < start || d > end) continue;
            const key = `${d}|${(a as { role: string }).role || ""}`;
            filledByKey.set(key, (filledByKey.get(key) ?? 0) + 1);
          }

          const shortByRole = new Map<string, number>();
          for (const r of requirements) {
            const filled = filledByKey.get(`${r.date}|${r.role}`) ?? 0;
            if (filled < r.count_needed) {
              const short = r.count_needed - filled;
              shortByRole.set(r.role, (shortByRole.get(r.role) ?? 0) + short);
            }
          }
          for (const [role, slotsShort] of Array.from(shortByRole.entries())) {
            if (slotsShort > 0) {
              rows.push({
                month: monthKey,
                monthLabel,
                department_id: deptId,
                department: deptMap.get(deptId) ?? "—",
                program_id: progId,
                program: progMap.get(progId) ?? "—",
                role,
                slots_short: slotsShort,
              });
            }
          }
        }

        // All programs (program_id null)
        const requirementsAllProg = mergeRequirementsForMonth(explicitRows, recurringRows, start, end, deptId, null);
        if (requirementsAllProg.length === 0) continue;

        const filledByKey = new Map<string, number>();
        for (const a of assignRows) {
          if (a.department_id !== deptId || a.program_id != null) continue;
          const d = (a as { date: string }).date;
          if (d < start || d > end) continue;
          const key = `${d}|${(a as { role: string }).role || ""}`;
          filledByKey.set(key, (filledByKey.get(key) ?? 0) + 1);
        }

        const shortByRole = new Map<string, number>();
        for (const r of requirementsAllProg) {
          const filled = filledByKey.get(`${r.date}|${r.role}`) ?? 0;
          if (filled < r.count_needed) {
            const short = r.count_needed - filled;
            shortByRole.set(r.role, (shortByRole.get(r.role) ?? 0) + short);
          }
        }
        for (const [role, slotsShort] of Array.from(shortByRole.entries())) {
          if (slotsShort > 0) {
            rows.push({
              month: monthKey,
              monthLabel,
              department_id: deptId,
              department: deptMap.get(deptId) ?? "—",
              program_id: null,
              program: "All programs",
              role,
              slots_short: slotsShort,
            });
          }
        }
      }
    }

    return NextResponse.json({ rows, total: rows.reduce((s, r) => s + r.slots_short, 0) });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
