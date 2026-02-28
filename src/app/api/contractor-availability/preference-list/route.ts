/**
 * Preference list: people sorted by most assigned (most requested) for a given
 * department, program, and role. Used for manual assignment and AI suggest.
 * Optional date filter: only return people available on that date.
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
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("department_id");
    const programId = searchParams.get("program_id") || undefined;
    const role = searchParams.get("role");
    const date = searchParams.get("date");

    if (!departmentId || !/^[0-9a-f-]{36}$/i.test(departmentId)) {
      return NextResponse.json({ error: "department_id is required." }, { status: 400 });
    }
    if (!role || !role.trim()) {
      return NextResponse.json({ error: "role is required." }, { status: 400 });
    }
    const progId = programId && /^[0-9a-f-]{36}$/i.test(programId) ? programId : null;
    const dateStr = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;

    const supabase = createAdminClient();

    // Count assignments per user for (department_id, program_id, role)
    // program_id: match exact or null when progId is null
    let assignQuery = supabase
      .from("output_schedule_assignments")
      .select("user_id")
      .eq("department_id", departmentId)
      .eq("role", role.trim());

    if (progId) {
      assignQuery = assignQuery.eq("program_id", progId);
    } else {
      assignQuery = assignQuery.is("program_id", null);
    }

    const { data: assignRows } = await assignQuery;
    const countByUser = new Map<string, number>();
    for (const r of assignRows ?? []) {
      const uid = (r as { user_id: string }).user_id;
      countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
    }

    // Sort by count DESC (most requested first)
    let sortedUserIds = Array.from(countByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([uid]) => uid);

    // Fallback: when no one has been assigned yet, use people from availability
    if (sortedUserIds.length === 0) {
      let availQuery = supabase
        .from("output_schedule_availability")
        .select("user_id")
        .eq("department_id", departmentId);
      if (progId) availQuery = availQuery.eq("program_id", progId);
      else availQuery = availQuery.is("program_id", null);
      const { data: availRows } = await availQuery;
      const roleTrim = role.trim();
      const fromAvail = new Set(
        (availRows ?? [])
          .filter((r: { role?: string | null }) => {
            const rRole = (r as { role?: string | null }).role?.trim() ?? "";
            return rRole === roleTrim || rRole === "";
          })
          .map((r: { user_id: string }) => r.user_id)
      );
      sortedUserIds = Array.from(fromAvail);
    }

    if (sortedUserIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Optionally filter to people available on date (and role)
    let userIds = sortedUserIds;
    if (dateStr) {
      let availQuery = supabase
        .from("output_schedule_availability")
        .select("user_id, role")
        .eq("department_id", departmentId)
        .eq("date", dateStr);
      if (progId) {
        availQuery = availQuery.eq("program_id", progId);
      } else {
        availQuery = availQuery.is("program_id", null);
      }
      const { data: availRows } = await availQuery;
      const roleTrim = role.trim();
      const availableIds = new Set(
        (availRows ?? [])
          .filter((r: { role?: string | null }) => {
            const rRole = r.role?.trim() ?? "";
            return rRole === roleTrim || rRole === "";
          })
          .map((r: { user_id: string }) => r.user_id)
      );
      userIds = sortedUserIds.filter((id) => availableIds.has(id));
    }

    if (userIds.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
    }

    const users = userIds.map((user_id) => ({
      user_id,
      full_name: nameMap.get(user_id) ?? "Unknown",
      assignment_count: countByUser.get(user_id) ?? 0,
    }));

    return NextResponse.json({ users });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
