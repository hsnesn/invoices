/**
 * Contractor availability list - admin sees all, users see own.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { getMergedRequirements } from "@/lib/contractor-requirements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const departmentId = searchParams.get("department_id") || undefined;
    const programId = searchParams.get("program_id") || undefined;

    const isAdminOrOps = ["admin", "operations", "manager"].includes(profile.role);

    let query = supabase
      .from("output_schedule_availability")
      .select("id, user_id, date, role, department_id, program_id, created_at")
      .order("date");

    if (!isAdminOrOps) {
      query = query.eq("user_id", profile.id);
    }
    if (departmentId) query = query.eq("department_id", departmentId);
    if (programId) query = query.eq("program_id", programId);

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

    const byUser: Record<string, { name: string; email: string; role: string; dates: string[]; department_id?: string; program_id?: string }> = {};
    for (const r of rows ?? []) {
      const uid = (r as { user_id: string }).user_id;
      if (!byUser[uid]) {
        byUser[uid] = {
          name: nameMap.get(uid) ?? "Unknown",
          email: emailMap.get(uid) ?? "",
          role: (r as { role?: string }).role ?? "",
          dates: [],
          department_id: (r as { department_id?: string }).department_id,
          program_id: (r as { program_id?: string }).program_id,
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
    let assignmentNamesByDateRole: Record<string, string[]> = {};
    let coverage: { slotsFilled: number; slotsShort: number; byDateRole: Record<string, { needed: number; filled: number }> } = {
      slotsFilled: 0,
      slotsShort: 0,
      byDateRole: {},
    };
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      requirements = await getMergedRequirements(supabase, start, end, departmentId || null, programId || null);

      let assignQuery = supabase
        .from("output_schedule_assignments")
        .select("date, role, user_id")
        .gte("date", start)
        .lte("date", end)
        .in("status", ["pending", "confirmed"]);
      if (departmentId) assignQuery = assignQuery.eq("department_id", departmentId);
      if (programId) assignQuery = assignQuery.eq("program_id", programId);
      const { data: assignRows } = await assignQuery;
      const filledByKey = new Map<string, number>();
      const namesByKey = new Map<string, string[]>();
      for (const a of assignRows ?? []) {
        const key = `${(a as { date: string }).date}|${(a as { role: string }).role || ""}`;
        filledByKey.set(key, (filledByKey.get(key) ?? 0) + 1);
        const uid = (a as { user_id: string }).user_id;
        const arr = namesByKey.get(key) ?? [];
        arr.push(nameMap.get(uid) ?? "Unknown");
        namesByKey.set(key, arr);
      }
      assignmentNamesByDateRole = Object.fromEntries(namesByKey);
      let slotsFilled = 0;
      let slotsShort = 0;
      const byDateRole: Record<string, { needed: number; filled: number }> = {};
      for (const r of requirements) {
        const key = `${r.date}|${r.role}`;
        const needed = r.count_needed;
        const filled = filledByKey.get(key) ?? 0;
        byDateRole[key] = { needed, filled };
        slotsFilled += filled;
        if (filled < needed) slotsShort += needed - filled;
      }
      coverage = { slotsFilled, slotsShort, byDateRole };
    }

    return NextResponse.json({
      month: month ?? null,
      monthLabel,
      requirements,
      coverage,
      assignmentNamesByDateRole,
      records: rows ?? [],
      byUser: Object.entries(byUser).map(([id, v]) => ({ userId: id, ...v })),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
