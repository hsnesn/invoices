/**
 * Contractor availability assignments: list, save, approve, cancel.
 * Admin, operations, manager can manage; users see own.
 * Approval: admin always; operations/manager only if in contractor_approval_user_ids.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const APPROVAL_KEY = "contractor_approval_user_ids";

function canManage(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

async function getCanApprove(
  supabase: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  profile: { id: string; role: string }
): Promise<boolean> {
  if (profile.role === "admin") return true;
  if (!["operations", "manager"].includes(profile.role)) return false;
  const { data } = await supabase.from("app_settings").select("value").eq("key", APPROVAL_KEY).single();
  const val = (data as { value?: unknown } | null)?.value;
  const ids = Array.isArray(val) ? val.filter((x): x is string => typeof x === "string") : [];
  return ids.includes(profile.id);
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const userId = searchParams.get("userId");
    const departmentId = searchParams.get("department_id") || undefined;
    const programId = searchParams.get("program_id") || undefined;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, m, 0).toISOString().slice(0, 10);

    let query = supabase
      .from("output_schedule_assignments")
      .select("id, user_id, date, role, status, department_id, program_id")
      .gte("date", start)
      .lte("date", end)
      .order("date");

    if (departmentId && /^[0-9a-f-]{36}$/i.test(departmentId)) {
      query = query.eq("department_id", departmentId);
      if (programId && /^[0-9a-f-]{36}$/i.test(programId)) {
        query = query.eq("program_id", programId);
      } else {
        query = query.is("program_id", null);
      }
    }

    const isManager = canManage(profile.role);
    if (!isManager) {
      query = query.eq("user_id", profile.id);
    } else if (userId) {
      query = query.eq("user_id", userId);
    } else if (!departmentId) {
      // Manager on My Availability form: show own bookings only
      query = query.eq("user_id", profile.id);
    }
    // else: manager with department_id → show all assignments for that department

    const { data, error } = await query;
    if (error) throw error;

    const monthLabel = new Date(year, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
    const canApprove = canManage(profile.role) ? await getCanApprove(supabase, profile) : false;
    const canRunAiSuggest = profile.role === "admin" || profile.role === "operations";
    return NextResponse.json({ assignments: data ?? [], monthLabel, canApprove, canRunAiSuggest });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const supabase = createAdminClient();
    const allowed = await getCanApprove(supabase, profile);
    if (!allowed) {
      return NextResponse.json({ error: "You do not have permission to approve or save assignments." }, { status: 403 });
    }

    const body = await request.json();
    const { action, month, assignments, user_id: cancelUserId, date: cancelDate, department_id: departmentId, program_id: programId } = body as {
      action?: "approve" | "save" | "cancel";
      month?: string;
      assignments?: { user_id: string; date: string; role?: string }[];
      user_id?: string;
      date?: string;
      department_id?: string;
      program_id?: string;
    };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }
    const deptId = departmentId && /^[0-9a-f-]{36}$/i.test(departmentId) ? departmentId : null;
    const progId = programId && /^[0-9a-f-]{36}$/i.test(programId) ? programId : null;

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);

    if (action === "cancel" && cancelUserId && cancelDate && /^\d{4}-\d{2}-\d{2}$/.test(cancelDate)) {
      const { error: delErr } = await supabase
        .from("output_schedule_assignments")
        .delete()
        .eq("user_id", cancelUserId)
        .eq("date", cancelDate)
        .gte("date", start)
        .lte("date", end);
      if (delErr) throw delErr;
      return NextResponse.json({ ok: true, cancelled: true });
    }

    if (action === "approve") {
      let pendingQuery = supabase
        .from("output_schedule_assignments")
        .select("id, user_id, date, role")
        .gte("date", start)
        .lte("date", end)
        .eq("status", "pending");
      if (deptId) {
        pendingQuery = pendingQuery.eq("department_id", deptId);
        if (progId) pendingQuery = pendingQuery.eq("program_id", progId);
        else pendingQuery = pendingQuery.is("program_id", null);
      }
      const { data: pending } = await pendingQuery;

      if (!pending || pending.length === 0) {
        return NextResponse.json({ error: "No pending assignments to approve." }, { status: 400 });
      }

      const ids = pending.map((r: { id: string }) => r.id);
      const { error: updErr } = await supabase
        .from("output_schedule_assignments")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (updErr) throw updErr;

      const byUser = new Map<string, { datesWithRole: { date: string; role: string }[] }>();
      for (const a of pending as { user_id: string; date: string; role: string | null }[]) {
        if (!byUser.has(a.user_id)) byUser.set(a.user_id, { datesWithRole: [] });
        byUser.get(a.user_id)!.datesWithRole.push({ date: a.date, role: a.role?.trim() || "—" });
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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const calendarUrl = `${appUrl}/api/contractor-availability/export/ical?month=${month}`;
      const { sendContractorAssignmentConfirmedEmail, sendContractorAssignmentConfirmedToLondonOps } = await import("@/lib/email");

      const byPersonForLondon: { name: string; email: string; datesWithRole: { date: string; role: string }[] }[] = [];
      for (const [uid, { datesWithRole }] of Array.from(byUser.entries())) {
        const email = emailMap.get(uid);
        const name = nameMap.get(uid) ?? "Unknown";
        if (email && datesWithRole.length > 0) {
          const sorted = [...datesWithRole].sort((a, b) => a.date.localeCompare(b.date));
          await sendContractorAssignmentConfirmedEmail({
            to: email,
            personName: name,
            monthLabel,
            datesWithRole: sorted,
            calendarUrl,
          });
          byPersonForLondon.push({ name, email, datesWithRole: sorted });
        }
      }

      if (byPersonForLondon.length > 0) {
        await sendContractorAssignmentConfirmedToLondonOps({ monthLabel, byPerson: byPersonForLondon });
      }

      return NextResponse.json({ ok: true, approved: ids.length });
    }

    if (action === "save" && Array.isArray(assignments)) {
      let existingQuery = supabase
        .from("output_schedule_assignments")
        .select("id")
        .gte("date", start)
        .lte("date", end)
        .eq("status", "pending");
      if (deptId) {
        existingQuery = existingQuery.eq("department_id", deptId);
        if (progId) existingQuery = existingQuery.eq("program_id", progId);
        else existingQuery = existingQuery.is("program_id", null);
      }
      const { data: existing } = await existingQuery;
      const existingIds = (existing ?? []).map((r: { id: string }) => r.id);
      if (existingIds.length > 0) {
        await supabase.from("output_schedule_assignments").delete().in("id", existingIds);
      }

      let confirmedQuery = supabase
        .from("output_schedule_assignments")
        .select("user_id, date")
        .gte("date", start)
        .lte("date", end)
        .eq("status", "confirmed");
      if (deptId) {
        confirmedQuery = confirmedQuery.eq("department_id", deptId);
        if (progId) confirmedQuery = confirmedQuery.eq("program_id", progId);
        else confirmedQuery = confirmedQuery.is("program_id", null);
      }
      const { data: confirmed } = await confirmedQuery;
      const confirmedKeys = new Set((confirmed ?? []).map((r: { user_id: string; date: string }) => `${r.user_id}|${r.date}`));

      const valid = assignments.filter(
        (a): a is { user_id: string; date: string; role?: string } =>
          a && typeof a.user_id === "string" && typeof a.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.date)
      );
      const seen = new Set<string>();
      const deduped = valid.filter((a) => {
        const key = `${a.user_id}|${a.date}`;
        if (seen.has(key) || confirmedKeys.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (deduped.length > 0 && deptId) {
        const rows = deduped.map((a) => ({
          user_id: a.user_id,
          date: a.date,
          role: a.role?.trim() || null,
          department_id: deptId,
          program_id: progId,
          status: "pending",
        }));
        const { error: insErr } = await supabase.from("output_schedule_assignments").insert(rows);
        if (insErr) throw insErr;
      }
      return NextResponse.json({ ok: true, count: deduped.length });
    }

    return NextResponse.json({ error: "Invalid action or body." }, { status: 400 });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
