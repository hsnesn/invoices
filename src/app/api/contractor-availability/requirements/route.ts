/**
 * Daily requirements: how many people per role per day.
 * Admin, operations, manager can read/write.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canManage(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const departmentId = searchParams.get("department_id") || undefined;
    const programId = searchParams.get("program_id") || undefined;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }
    if (!departmentId || !/^[0-9a-f-]{36}$/i.test(departmentId)) {
      return NextResponse.json({ error: "Department is required." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);

    let explicitQuery = supabase
      .from("contractor_availability_requirements")
      .select("id, date, role, count_needed, department_id, program_id")
      .eq("department_id", departmentId)
      .gte("date", start)
      .lte("date", end)
      .order("date")
      .order("role");
    if (programId) {
      explicitQuery = explicitQuery.eq("program_id", programId);
    } else {
      explicitQuery = explicitQuery.is("program_id", null);
    }
    const { data: explicitData, error } = await explicitQuery;

    if (error) throw error;

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

    const byDate: Record<string, { role: string; count_needed: number }[]> = {};
    for (const r of explicitData ?? []) {
      const d = (r as { date: string }).date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({
        role: (r as { role: string }).role,
        count_needed: (r as { count_needed: number }).count_needed,
      });
    }

    for (let d = new Date(y, m - 1, 1); d <= new Date(y, m, 0); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      for (const rec of recurring) {
        if (rec.day_of_week !== dow) continue;
        const existing = byDate[dateStr]?.find((x) => x.role === rec.role);
        if (!existing) {
          if (!byDate[dateStr]) byDate[dateStr] = [];
          byDate[dateStr].push({ role: rec.role, count_needed: rec.count_needed });
        }
      }
    }

    const requirements = Object.entries(byDate).flatMap(([date, items]) =>
      items.map((item) => ({ date, role: item.role, count_needed: item.count_needed }))
    );

    return NextResponse.json({
      month,
      monthLabel: new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" }),
      requirements,
      byDate,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const body = await request.json();
    const { date, role, count_needed, department_id, program_id } = body as { date: string; role: string; count_needed: number; department_id?: string; program_id?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
    }
    if (!role || typeof role !== "string" || !role.trim()) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }
    const deptId = typeof department_id === "string" && /^[0-9a-f-]{36}$/i.test(department_id) ? department_id : null;
    if (!deptId) {
      return NextResponse.json({ error: "Department is required." }, { status: 400 });
    }
    const progId = typeof program_id === "string" && /^[0-9a-f-]{36}$/i.test(program_id) ? program_id : null;
    const count = Math.max(0, Math.min(99, Math.floor(Number(count_needed) || 0)));

    const supabase = createAdminClient();
    const roleTrimmed = role.trim();

    // Delete existing row first (avoids upsert conflict issues with nullable program_id)
    let delQuery = supabase
      .from("contractor_availability_requirements")
      .delete()
      .eq("date", date)
      .eq("role", roleTrimmed)
      .eq("department_id", deptId);
    if (progId) {
      delQuery = delQuery.eq("program_id", progId);
    } else {
      delQuery = delQuery.is("program_id", null);
    }
    const { error: delError } = await delQuery;
    if (delError) {
      console.error("[requirements PUT] delete", delError);
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    // Insert new row
    const row = {
      date,
      role: roleTrimmed,
      count_needed: count,
      department_id: deptId,
      program_id: progId,
      updated_at: new Date().toISOString(),
    };
    const { data, error: insError } = await supabase
      .from("contractor_availability_requirements")
      .insert(row)
      .select()
      .single();

    if (insError) {
      console.error("[requirements PUT] insert", insError);
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }
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
    const date = searchParams.get("date");
    const role = searchParams.get("role");
    const departmentId = searchParams.get("department_id");
    const programId = searchParams.get("program_id");

    if (!date || !role) {
      return NextResponse.json({ error: "date and role are required." }, { status: 400 });
    }
    if (!departmentId || !/^[0-9a-f-]{36}$/i.test(departmentId)) {
      return NextResponse.json({ error: "department_id is required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    let deleteQuery = supabase
      .from("contractor_availability_requirements")
      .delete()
      .eq("date", date)
      .eq("role", role)
      .eq("department_id", departmentId);
    if (programId && /^[0-9a-f-]{36}$/i.test(programId)) {
      deleteQuery = deleteQuery.eq("program_id", programId);
    } else {
      deleteQuery = deleteQuery.is("program_id", null);
    }
    const { error } = await deleteQuery;

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
