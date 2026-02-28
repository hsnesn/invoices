/**
 * Contractor availability list - admin sees all, users see own.
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

    const isAdminOrOps = ["admin", "operations", "manager"].includes(profile.role);

    let query = supabase
      .from("output_schedule_availability")
      .select("id, user_id, date, role, created_at")
      .order("date");

    if (!isAdminOrOps) {
      query = query.eq("user_id", profile.id);
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      query = query.gte("date", start).lte("date", end);
    }

    const { data: rows, error } = await query;

    if (error) throw error;

    if (!isAdminOrOps) {
      const monthLabel = month
        ? new Date(parseInt(month.slice(0, 4), 10), parseInt(month.slice(5, 7), 10) - 1).toLocaleString("en-GB", {
            month: "long",
            year: "numeric",
          })
        : null;
      return NextResponse.json({ month: month ?? null, monthLabel, records: rows ?? [] });
    }

    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email);
    }

    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name || "Unknown");
    }

    const byUser: Record<string, { name: string; email: string; role: string; dates: string[] }> = {};
    for (const r of rows ?? []) {
      const uid = (r as { user_id: string }).user_id;
      if (!byUser[uid]) {
        byUser[uid] = {
          name: nameMap.get(uid) ?? "Unknown",
          email: emailMap.get(uid) ?? "",
          role: (r as { role?: string }).role ?? "",
          dates: [],
        };
      }
      byUser[uid].dates.push((r as { date: string }).date);
      if ((r as { role?: string }).role && !byUser[uid].role) byUser[uid].role = (r as { role: string }).role;
    }

    for (const u of Object.values(byUser)) {
      u.dates.sort();
    }

    const monthLabel = month
      ? new Date(parseInt(month.slice(0, 4), 10), parseInt(month.slice(5, 7), 10) - 1).toLocaleString("en-GB", {
          month: "long",
          year: "numeric",
        })
      : null;

    let requirements: { date: string; role: string; count_needed: number }[] = [];
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      const { data: reqRows } = await supabase
        .from("contractor_availability_requirements")
        .select("date, role, count_needed")
        .gte("date", start)
        .lte("date", end);
      requirements = (reqRows ?? []) as { date: string; role: string; count_needed: number }[];
    }

    return NextResponse.json({
      month: month ?? null,
      monthLabel,
      requirements,
      records: rows ?? [],
      byUser: Object.entries(byUser).map(([id, v]) => ({ userId: id, ...v })),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
