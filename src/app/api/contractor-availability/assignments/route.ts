/**
 * Contractor availability assignments: list, save, approve.
 * Admin, operations, manager can manage; users see own.
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
    const userId = searchParams.get("userId");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, m, 0).toISOString().slice(0, 10);

    let query = supabase
      .from("output_schedule_assignments")
      .select("id, user_id, date, role, status")
      .gte("date", start)
      .lte("date", end)
      .order("date");

    const isManager = canManage(profile.role);
    if (!isManager || !userId) {
      query = query.eq("user_id", profile.id);
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const monthLabel = new Date(year, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
    return NextResponse.json({ assignments: data ?? [], monthLabel });
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
    const { action, month, assignments } = body as {
      action?: "approve" | "save";
      month?: string;
      assignments?: { user_id: string; date: string; role?: string }[];
    };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    const supabase = createAdminClient();

    if (action === "approve") {
      const { data: pending } = await supabase
        .from("output_schedule_assignments")
        .select("id, user_id, date, role")
        .gte("date", start)
        .lte("date", end)
        .eq("status", "pending");

      if (!pending || pending.length === 0) {
        return NextResponse.json({ error: "No pending assignments to approve." }, { status: 400 });
      }

      const ids = pending.map((r: { id: string }) => r.id);
      const { error: updErr } = await supabase
        .from("output_schedule_assignments")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (updErr) throw updErr;

      const byUser = new Map<string, { dates: string[] }>();
      for (const a of pending as { user_id: string; date: string }[]) {
        if (!byUser.has(a.user_id)) byUser.set(a.user_id, { dates: [] });
        byUser.get(a.user_id)!.dates.push(a.date);
      }

      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const emailMap = new Map<string, string>();
      for (const u of authData?.users ?? []) {
        if (u.email) emailMap.set(u.id, u.email);
      }
      const { data: profiles } = await supabase.from("profiles").select("id, full_name");
      const nameMap = new Map<string, string>();
      for (const p of profiles ?? []) {
        nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
      }

      const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
      const { sendContractorAssignmentConfirmedEmail } = await import("@/lib/email");

      for (const [uid, { dates }] of Array.from(byUser.entries())) {
        const email = emailMap.get(uid);
        if (email && dates.length > 0) {
          await sendContractorAssignmentConfirmedEmail({
            to: email,
            personName: nameMap.get(uid) ?? "",
            monthLabel,
            dates: dates.sort(),
          });
        }
      }

      return NextResponse.json({ ok: true, approved: ids.length });
    }

    if (action === "save" && Array.isArray(assignments)) {
      const { data: existing } = await supabase
        .from("output_schedule_assignments")
        .select("id")
        .gte("date", start)
        .lte("date", end)
        .eq("status", "pending");
      const existingIds = (existing ?? []).map((r: { id: string }) => r.id);
      if (existingIds.length > 0) {
        await supabase.from("output_schedule_assignments").delete().in("id", existingIds);
      }

      const valid = assignments.filter(
        (a): a is { user_id: string; date: string; role?: string } =>
          a && typeof a.user_id === "string" && typeof a.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
      );
      if (valid.length > 0) {
        const rows = valid.map((a) => ({
          user_id: a.user_id,
          date: a.date,
          role: a.role?.trim() || null,
          status: "pending",
        }));
        const { error: insErr } = await supabase.from("output_schedule_assignments").insert(rows);
        if (insErr) throw insErr;
      }
      return NextResponse.json({ ok: true, count: valid.length });
    }

    return NextResponse.json({ error: "Invalid action or body." }, { status: 400 });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
