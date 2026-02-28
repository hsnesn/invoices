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

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("contractor_availability_requirements")
      .select("id, date, role, count_needed")
      .gte("date", start)
      .lte("date", end)
      .order("date")
      .order("role");

    if (error) throw error;

    const byDate: Record<string, { role: string; count_needed: number }[]> = {};
    for (const r of data ?? []) {
      const d = (r as { date: string }).date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({
        role: (r as { role: string }).role,
        count_needed: (r as { count_needed: number }).count_needed,
      });
    }

    return NextResponse.json({
      month,
      monthLabel: new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" }),
      requirements: data ?? [],
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
    const { date, role, count_needed } = body as { date: string; role: string; count_needed: number };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
    }
    if (!role || typeof role !== "string" || !role.trim()) {
      return NextResponse.json({ error: "Role is required." }, { status: 400 });
    }
    const count = Math.max(0, Math.min(99, Math.floor(Number(count_needed) || 0)));

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("contractor_availability_requirements")
      .upsert(
        { date, role: role.trim(), count_needed: count, updated_at: new Date().toISOString() },
        { onConflict: "date,role" }
      )
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
    const date = searchParams.get("date");
    const role = searchParams.get("role");

    if (!date || !role) {
      return NextResponse.json({ error: "date and role are required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("contractor_availability_requirements")
      .delete()
      .eq("date", date)
      .eq("role", role);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
