/**
 * Apply recurring requirements to a month (insert explicit requirements where none exist).
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
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);

    const supabase = createAdminClient();
    let explicitQuery = supabase
      .from("contractor_availability_requirements")
      .select("date, role")
      .eq("department_id", departmentId)
      .gte("date", start)
      .lte("date", end);
    if (programId) {
      explicitQuery = explicitQuery.eq("program_id", programId);
    } else {
      explicitQuery = explicitQuery.is("program_id", null);
    }
    const { data: explicitData } = await explicitQuery;
    const explicitKeys = new Set(
      (explicitData ?? []).map((r: { date: string; role: string }) => `${r.date}|${r.role}`)
    );

    let recurringQuery = supabase
      .from("contractor_availability_recurring")
      .select("day_of_week, role, count_needed")
      .eq("department_id", departmentId);
    if (programId) {
      recurringQuery = recurringQuery.eq("program_id", programId);
    } else {
      recurringQuery = recurringQuery.is("program_id", null);
    }
    const { data: recurringData } = await recurringQuery;
    const recurring = (recurringData ?? []) as { day_of_week: number; role: string; count_needed: number }[];

    const toInsert: { date: string; role: string; count_needed: number }[] = [];
    for (let d = new Date(y, m - 1, 1); d <= new Date(y, m, 0); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      for (const rec of recurring) {
        if (rec.day_of_week !== dow) continue;
        const key = `${dateStr}|${rec.role}`;
        if (!explicitKeys.has(key)) {
          toInsert.push({ date: dateStr, role: rec.role, count_needed: rec.count_needed });
          explicitKeys.add(key);
        }
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase
        .from("contractor_availability_requirements")
        .upsert(
          toInsert.map((x) => ({ ...x, updated_at: new Date().toISOString() })),
          { onConflict: "date,role" }
        );
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, count: toInsert.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
