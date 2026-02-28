/**
 * Output schedule assignments: list who is assigned to which days.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const userId = searchParams.get("userId");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, m, 0).toISOString().slice(0, 10);

    let query = supabase
      .from("output_schedule_assignments")
      .select("id, user_id, date, status")
      .gte("date", start)
      .lte("date", end)
      .order("date");

    const isAdminOrOps = profile.role === "admin" || profile.role === "operations";
    if (!isAdminOrOps || !userId) {
      query = query.eq("user_id", profile.id);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ assignments: data ?? [] });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
