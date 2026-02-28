/**
 * Copy availability from previous month to current month.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const month = (body.month as string) ?? new URL(request.url).searchParams.get("month");
    const department_id = body.department_id as string | undefined;
    const program_id = body.program_id as string | undefined;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }
    if (!department_id || !/^[0-9a-f-]{36}$/i.test(department_id)) {
      return NextResponse.json({ error: "Department is required." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevStart = new Date(prev.getFullYear(), prev.getMonth(), 1).toISOString().slice(0, 10);
    const prevEnd = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).toISOString().slice(0, 10);
    const currStart = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const currEnd = new Date(y, m, 0).toISOString().slice(0, 10);

    const supabase = createAdminClient();
    let prevQuery = supabase
      .from("output_schedule_availability")
      .select("date, role")
      .eq("user_id", profile.id)
      .eq("department_id", department_id)
      .gte("date", prevStart)
      .lte("date", prevEnd);
    if (program_id) {
      prevQuery = prevQuery.eq("program_id", program_id);
    } else {
      prevQuery = prevQuery.is("program_id", null);
    }
    const { data: prevRows } = await prevQuery;

    if (!prevRows || prevRows.length === 0) {
      return NextResponse.json({ error: "No availability in previous month to copy for this department/program." }, { status: 400 });
    }

    const roleVal = (prevRows[0] as { role?: string }).role ?? null;
    const progId = program_id && /^[0-9a-f-]{36}$/i.test(program_id) ? program_id : null;
    const prevDates = Array.from(new Set(prevRows.map((r: { date: string }) => r.date))).sort();
    const dowWeekIndex = (dateStr: string) => {
      const [y, m, day] = dateStr.split("-").map(Number);
      const d = new Date(y, m - 1, day);
      return { dow: d.getDay(), weekIndex: Math.floor((day - 1) / 7) };
    };
    const currMonthDays = new Map<string, string>();
    for (let d = new Date(currStart); d <= new Date(currEnd); d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      const { dow, weekIndex } = dowWeekIndex(ds);
      currMonthDays.set(`${dow}-${weekIndex}`, ds);
    }
    const toInsert: { user_id: string; date: string; role: string | null; department_id: string; program_id: string | null }[] = [];
    for (const pd of prevDates) {
      const { dow, weekIndex } = dowWeekIndex(pd);
      const currDate = currMonthDays.get(`${dow}-${weekIndex}`);
      if (currDate) toInsert.push({ user_id: profile.id, date: currDate, role: roleVal, department_id, program_id: progId });
    }

    let deleteQuery = supabase
      .from("output_schedule_availability")
      .delete()
      .eq("user_id", profile.id)
      .eq("department_id", department_id)
      .gte("date", currStart)
      .lte("date", currEnd);
    if (progId) {
      deleteQuery = deleteQuery.eq("program_id", progId);
    } else {
      deleteQuery = deleteQuery.is("program_id", null);
    }
    await deleteQuery;

    if (toInsert.length > 0) {
      const { error } = await supabase.from("output_schedule_availability").insert(toInsert);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, count: toInsert.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
