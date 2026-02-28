/**
 * Copy requirements from previous month to current month.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canManage(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
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
    const prev = new Date(y, m - 2, 1);
    const prevStart = new Date(prev.getFullYear(), prev.getMonth(), 1).toISOString().slice(0, 10);
    const prevEnd = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).toISOString().slice(0, 10);
    const currStart = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const currEnd = new Date(y, m, 0).toISOString().slice(0, 10);

    const supabase = createAdminClient();
    let prevQuery = supabase
      .from("contractor_availability_requirements")
      .select("date, role, count_needed")
      .eq("department_id", departmentId)
      .gte("date", prevStart)
      .lte("date", prevEnd);
    if (programId) {
      prevQuery = prevQuery.eq("program_id", programId);
    } else {
      prevQuery = prevQuery.is("program_id", null);
    }
    const { data: prevReqs } = await prevQuery;

    if (!prevReqs || prevReqs.length === 0) {
      return NextResponse.json({ error: "No requirements in previous month to copy." }, { status: 400 });
    }

    const prevDays = new Set(prevReqs.map((r: { date: string }) => r.date));
    const dayOffsets = new Map<string, number>();
    const sortedPrev = Array.from(prevDays).sort();
    const sortedCurr: string[] = [];
    for (let d = new Date(currStart); d <= new Date(currEnd); d.setDate(d.getDate() + 1)) {
      sortedCurr.push(d.toISOString().slice(0, 10));
    }
    for (let i = 0; i < Math.min(sortedPrev.length, sortedCurr.length); i++) {
      dayOffsets.set(sortedPrev[i], i);
    }

    const progId = programId && /^[0-9a-f-]{36}$/i.test(programId) ? programId : null;
    const toInsert: { date: string; role: string; count_needed: number; department_id: string; program_id: string | null }[] = [];
    for (const r of prevReqs as { date: string; role: string; count_needed: number }[]) {
      const idx = sortedPrev.indexOf(r.date);
      if (idx >= 0 && idx < sortedCurr.length) {
        toInsert.push({
          date: sortedCurr[idx],
          role: r.role,
          count_needed: r.count_needed,
          department_id: departmentId,
          program_id: progId,
        });
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("contractor_availability_requirements")
        .upsert(
          toInsert.map((x) => ({ ...x, updated_at: new Date().toISOString() })),
          { onConflict: "date,role,department_id,program_id" }
        );
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, count: toInsert.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
