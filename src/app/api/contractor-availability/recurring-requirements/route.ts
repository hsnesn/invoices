/**
 * Recurring requirements: e.g. every Monday 2 Output.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function canManage(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("department_id") || undefined;
    const programId = searchParams.get("program_id") || undefined;
    const supabase = createAdminClient();
    let query = supabase
      .from("contractor_availability_recurring")
      .select("id, day_of_week, role, count_needed, department_id, program_id")
      .order("day_of_week")
      .order("role");
    if (departmentId) {
      query = query.eq("department_id", departmentId);
      if (programId) {
        query = query.eq("program_id", programId);
      } else {
        query = query.is("program_id", null);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    const items = (data ?? []).map((r: { id: string; day_of_week: number; role: string; count_needed: number }) => ({
      ...r,
      dayLabel: DAYS[r.day_of_week] ?? `Day ${r.day_of_week}`,
    }));
    return NextResponse.json(items);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }
    const body = await request.json();
    const { day_of_week, role, count_needed, department_id, program_id } = body as { day_of_week: number; role: string; count_needed: number; department_id?: string; program_id?: string };
    if (typeof day_of_week !== "number" || day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: "day_of_week must be 0-6." }, { status: 400 });
    }
    if (!role?.trim()) return NextResponse.json({ error: "role is required." }, { status: 400 });
    const deptId = typeof department_id === "string" && /^[0-9a-f-]{36}$/i.test(department_id) ? department_id : null;
    if (!deptId) return NextResponse.json({ error: "department_id is required." }, { status: 400 });
    const progId = typeof program_id === "string" && /^[0-9a-f-]{36}$/i.test(program_id) ? program_id : null;
    const count = Math.max(0, Math.min(99, Math.floor(Number(count_needed) || 0)));

    const supabase = createAdminClient();
    const row = { day_of_week, role: role.trim(), count_needed: count, department_id: deptId, program_id: progId, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("contractor_availability_recurring")
      .upsert(row, { onConflict: "day_of_week,role,department_id,program_id" })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
    const supabase = createAdminClient();
    const { error } = await supabase.from("contractor_availability_recurring").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
