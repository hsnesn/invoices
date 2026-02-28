/**
 * Slots short overview: all months, departments, programs, positions in one list.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { getMergedRequirements } from "@/lib/contractor-requirements";

export const dynamic = "force-dynamic";

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
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 0);

    const { data: departments } = await supabase.from("departments").select("id, name").order("name");
    const { data: programs } = await supabase.from("programs").select("id, name, department_id").order("name");
    const deptMap = new Map((departments ?? []).map((d: { id: string; name: string }) => [d.id, d.name]));
    const progMap = new Map((programs ?? []).map((p: { id: string; name: string; department_id: string }) => [p.id, { name: p.name, department_id: p.department_id }]));

    type Row = { month: string; monthLabel: string; department_id: string; department: string; program_id: string | null; program: string; role: string; slots_short: number };
    const rows: Row[] = [];

    for (let m = new Date(startMonth); m <= endMonth; m.setMonth(m.getMonth() + 1)) {
      const y = m.getFullYear();
      const mo = m.getMonth() + 1;
      const monthKey = `${y}-${String(mo).padStart(2, "0")}`;
      const monthLabel = m.toLocaleString("en-GB", { month: "long", year: "numeric" });
      const start = new Date(y, mo - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, mo, 0).toISOString().slice(0, 10);

      for (const dept of departments ?? []) {
        const deptId = (dept as { id: string }).id;
        const progsForDept = (programs ?? []).filter((p: { department_id: string }) => (p as { department_id: string }).department_id === deptId);
        for (const prog of progsForDept) {
          if ((prog as { department_id: string }).department_id !== deptId) continue;
          const progId = (prog as { id: string }).id;
          const requirements = await getMergedRequirements(supabase, start, end, deptId, progId);
          if (requirements.length === 0) continue;

          let assignQuery = supabase
            .from("output_schedule_assignments")
            .select("date, role")
            .gte("date", start)
            .lte("date", end)
            .in("status", ["pending", "confirmed"])
            .eq("department_id", deptId)
            .eq("program_id", progId);
          const { data: assignRows } = await assignQuery;
          const filledByKey = new Map<string, number>();
          for (const a of assignRows ?? []) {
            const key = `${(a as { date: string }).date}|${(a as { role: string }).role || ""}`;
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
          for (const [role, slotsShort] of shortByRole) {
            if (slotsShort > 0) {
              rows.push({
                month: monthKey,
                monthLabel,
                department_id: deptId,
                department: deptMap.get(deptId) ?? "—",
                program_id: progId,
                program: (progMap.get(progId) as { name: string } | undefined)?.name ?? "—",
                role,
                slots_short: slotsShort,
              });
            }
          }
        }
        const requirementsAllProg = await getMergedRequirements(supabase, start, end, deptId, null);
        if (requirementsAllProg.length === 0) continue;

        let assignQuery = supabase
          .from("output_schedule_assignments")
          .select("date, role")
          .gte("date", start)
          .lte("date", end)
          .in("status", ["pending", "confirmed"])
          .eq("department_id", deptId)
          .is("program_id", null);
        const { data: assignRows } = await assignQuery;
        const filledByKey = new Map<string, number>();
        for (const a of assignRows ?? []) {
          const key = `${(a as { date: string }).date}|${(a as { role: string }).role || ""}`;
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
        for (const [role, slotsShort] of shortByRole) {
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
