/**
 * Admin/operations: clear monthly demands (requirements) and/or availability.
 * When clearing availability, affected contractors receive an email notification.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { sendAvailabilityClearedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function canClear(role: string) {
  return role === "admin" || role === "operations";
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canClear(profile.role)) {
      return NextResponse.json({ error: "Admin or operations only." }, { status: 403 });
    }

    const body = await request.json();
    const { month, type, department_id, program_id } = body as {
      month: string;
      type: "availability" | "requirements" | "both";
      department_id?: string;
      program_id?: string;
    };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }
    const validType = type === "availability" || type === "requirements" || type === "both";
    if (!validType) {
      return NextResponse.json({ error: "type must be availability, requirements, or both." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
    const supabase = createAdminClient();

    const deptId = typeof department_id === "string" && /^[0-9a-f-]{36}$/i.test(department_id) ? department_id : null;
    const progId = typeof program_id === "string" && /^[0-9a-f-]{36}$/i.test(program_id) ? program_id : null;

    let availabilityDeleted = 0;
    let requirementsDeleted = 0;
    const affectedUserIds = new Set<string>();

    if (type === "availability" || type === "both") {
      let selectQuery = supabase
        .from("output_schedule_availability")
        .select("user_id")
        .gte("date", start)
        .lte("date", end);
      if (deptId) selectQuery = selectQuery.eq("department_id", deptId);
      if (progId) selectQuery = selectQuery.eq("program_id", progId);
      else if (deptId) selectQuery = selectQuery.is("program_id", null);

      const { data: availRows, error: selErr } = await selectQuery;
      if (selErr) throw selErr;

      for (const r of availRows ?? []) {
        affectedUserIds.add((r as { user_id: string }).user_id);
      }

      let deleteQuery = supabase
        .from("output_schedule_availability")
        .delete()
        .gte("date", start)
        .lte("date", end);
      if (deptId) deleteQuery = deleteQuery.eq("department_id", deptId);
      if (progId) deleteQuery = deleteQuery.eq("program_id", progId);
      else if (deptId) deleteQuery = deleteQuery.is("program_id", null);

      const { data: delData, error: delErr } = await deleteQuery.select("id");
      if (delErr) throw delErr;
      availabilityDeleted = (delData ?? []).length;
    }

    if (type === "requirements" || type === "both") {
      let deleteReq = supabase
        .from("contractor_availability_requirements")
        .delete()
        .gte("date", start)
        .lte("date", end);
      if (deptId) deleteReq = deleteReq.eq("department_id", deptId);
      if (progId) deleteReq = deleteReq.eq("program_id", progId);
      else if (deptId) deleteReq = deleteReq.is("program_id", null);

      const { data: reqDelData, error: reqDelErr } = await deleteReq.select("id");
      if (reqDelErr) throw reqDelErr;
      requirementsDeleted = (reqDelData ?? []).length;
    }

    let emailsSent = 0;
    if (affectedUserIds.size > 0 && (type === "availability" || type === "both")) {
      for (const uid of affectedUserIds) {
        try {
          const { data: user } = await supabase.auth.admin.getUserById(uid);
          const email = user?.user?.email;
          if (email && email.includes("@")) {
            const res = await sendAvailabilityClearedEmail({ to: email, monthLabel });
            if (res.success) emailsSent++;
          }
        } catch {
          // skip failed emails
        }
      }
    }

    return NextResponse.json({
      ok: true,
      availabilityDeleted,
      requirementsDeleted,
      emailsSent,
      affectedUsers: affectedUserIds.size,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
