/**
 * Bulk operations for contractor requirements: copy from previous month, clear month, copy to next month.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canManage(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const body = await request.json();
    const { action, from_month, to_month, department_id, program_id, role, items } = body as {
      action: "copy_from_prev" | "clear" | "clear_role" | "clear_roles_bulk" | "copy_to_next";
      from_month?: string;
      to_month?: string;
      department_id?: string;
      program_id?: string;
      role?: string;
      items?: { to_month: string; department_id: string; program_id?: string; role: string }[];
    };

    const deptId = department_id && /^[0-9a-f-]{36}$/i.test(department_id) ? department_id : null;
    const progId = program_id && /^[0-9a-f-]{36}$/i.test(program_id) ? program_id : null;

    const supabase = createAdminClient();

    if (action === "clear_roles_bulk" && Array.isArray(items) && items.length > 0) {
      let cleared = 0;
      const allZeroRows: { date: string; role: string; count_needed: number; department_id: string; program_id: string | null }[] = [];
      for (const it of items) {
        const toMonth = it?.to_month;
        const deptIdIt = it?.department_id;
        const progIdIt = it?.program_id;
        const roleIt = it?.role;
        if (!toMonth || !/^\d{4}-\d{2}$/.test(toMonth) || !deptIdIt || !/^[0-9a-f-]{36}$/i.test(deptIdIt) || !roleIt || typeof roleIt !== "string" || !roleIt.trim()) continue;
        const [y, m] = toMonth.split("-").map(Number);
        const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
        const end = new Date(y, m, 0).toISOString().slice(0, 10);
        let delQuery = supabase
          .from("contractor_availability_requirements")
          .delete()
          .eq("department_id", deptIdIt)
          .eq("role", roleIt.trim())
          .gte("date", start)
          .lte("date", end);
        if (progIdIt && /^[0-9a-f-]{36}$/i.test(progIdIt)) delQuery = delQuery.eq("program_id", progIdIt);
        else delQuery = delQuery.is("program_id", null);
        const { error } = await delQuery;
        if (error) throw error;
        const progIdVal = progIdIt && /^[0-9a-f-]{36}$/i.test(progIdIt) ? progIdIt : null;
        for (let d = new Date(y, m - 1, 1); d <= new Date(y, m, 0); d.setDate(d.getDate() + 1)) {
          allZeroRows.push({
            date: d.toISOString().slice(0, 10),
            role: roleIt.trim(),
            count_needed: 0,
            department_id: deptIdIt,
            program_id: progIdVal,
          });
        }
        cleared++;
      }
      if (allZeroRows.length > 0) {
        const { error: insErr } = await supabase.from("contractor_availability_requirements").upsert(allZeroRows, {
          onConflict: "date,role,department_id,program_id",
        });
        if (insErr) throw insErr;
      }
      return NextResponse.json({ ok: true, count: cleared });
    }

    if (!deptId) {
      return NextResponse.json({ error: "department_id is required." }, { status: 400 });
    }

    if (action === "clear_role" && to_month && /^\d{4}-\d{2}$/.test(to_month) && role && typeof role === "string" && role.trim()) {
      const [y, m] = to_month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      let delQuery = supabase
        .from("contractor_availability_requirements")
        .delete()
        .eq("department_id", deptId)
        .eq("role", role.trim())
        .gte("date", start)
        .lte("date", end);
      if (progId) delQuery = delQuery.eq("program_id", progId);
      else delQuery = delQuery.is("program_id", null);
      const { error } = await delQuery;
      if (error) throw error;
      // Insert explicit count_needed=0 to override recurring requirements for this month
      const zeroRows: { date: string; role: string; count_needed: number; department_id: string; program_id: string | null }[] = [];
      for (let d = new Date(y, m - 1, 1); d <= new Date(y, m, 0); d.setDate(d.getDate() + 1)) {
        zeroRows.push({
          date: d.toISOString().slice(0, 10),
          role: role.trim(),
          count_needed: 0,
          department_id: deptId,
          program_id: progId,
        });
      }
      if (zeroRows.length > 0) {
        const { error: insErr } = await supabase.from("contractor_availability_requirements").upsert(zeroRows, {
          onConflict: "date,role,department_id,program_id",
        });
        if (insErr) throw insErr;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "clear" && to_month && /^\d{4}-\d{2}$/.test(to_month)) {
      const [y, m] = to_month.split("-").map(Number);
      const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      let delQuery = supabase
        .from("contractor_availability_requirements")
        .delete()
        .eq("department_id", deptId)
        .gte("date", start)
        .lte("date", end);
      if (progId) delQuery = delQuery.eq("program_id", progId);
      else delQuery = delQuery.is("program_id", null);
      const { error } = await delQuery;
      if (error) throw error;
      return NextResponse.json({ ok: true, count: 0 });
    }

    if (action === "copy_from_prev" && from_month && to_month && /^\d{4}-\d{2}$/.test(from_month) && /^\d{4}-\d{2}$/.test(to_month)) {
      const [fy, fm] = from_month.split("-").map(Number);
      const [ty, tm] = to_month.split("-").map(Number);
      const fromStart = new Date(fy, fm - 1, 1).toISOString().slice(0, 10);
      const fromEnd = new Date(fy, fm, 0).toISOString().slice(0, 10);
      const toStart = new Date(ty, tm - 1, 1).toISOString().slice(0, 10);
      const toEnd = new Date(ty, tm, 0).toISOString().slice(0, 10);

      let fromQuery = supabase
        .from("contractor_availability_requirements")
        .select("date, role, count_needed")
        .eq("department_id", deptId)
        .gte("date", fromStart)
        .lte("date", fromEnd);
      if (progId) fromQuery = fromQuery.eq("program_id", progId);
      else fromQuery = fromQuery.is("program_id", null);
      const { data: fromRows } = await fromQuery;
      if (!fromRows || fromRows.length === 0) {
        return NextResponse.json({ ok: true, count: 0 });
      }

      const fromDays = new Date(fy, fm, 0).getDate();
      const toDays = new Date(ty, tm, 0).getDate();
      const dayOffset = Math.min(fromDays, toDays);

      const rows: { date: string; role: string; count_needed: number; department_id: string; program_id: string | null }[] = [];
      for (const r of fromRows) {
        const fromDate = new Date((r as { date: string }).date);
        const dayNum = fromDate.getDate();
        if (dayNum > toDays) continue;
        const toDate = new Date(ty, tm - 1, dayNum);
        const toDateStr = toDate.toISOString().slice(0, 10);
        if (toDateStr < toStart || toDateStr > toEnd) continue;
        rows.push({
          date: toDateStr,
          role: (r as { role: string }).role,
          count_needed: (r as { count_needed: number }).count_needed,
          department_id: deptId,
          program_id: progId,
        });
      }

      if (rows.length > 0) {
        for (const row of rows) {
          let delQuery = supabase.from("contractor_availability_requirements").delete()
            .eq("date", row.date).eq("role", row.role).eq("department_id", deptId);
          if (progId) delQuery = delQuery.eq("program_id", progId);
          else delQuery = delQuery.is("program_id", null);
          await delQuery;
        }
        const { error: insErr } = await supabase.from("contractor_availability_requirements").insert(rows);
        if (insErr) throw insErr;
      }
      return NextResponse.json({ ok: true, count: rows.length });
    }

    if (action === "copy_to_next" && from_month && /^\d{4}-\d{2}$/.test(from_month)) {
      const [fy, fm] = from_month.split("-").map(Number);
      const nextMonth = fm === 12 ? `${fy + 1}-01` : `${fy}-${String(fm + 1).padStart(2, "0")}`;
      const [ty, tm] = nextMonth.split("-").map(Number);
      const fromStart = new Date(fy, fm - 1, 1).toISOString().slice(0, 10);
      const fromEnd = new Date(fy, fm, 0).toISOString().slice(0, 10);
      const toStart = new Date(ty, tm - 1, 1).toISOString().slice(0, 10);
      const toEnd = new Date(ty, tm, 0).toISOString().slice(0, 10);

      let fromQuery = supabase
        .from("contractor_availability_requirements")
        .select("date, role, count_needed")
        .eq("department_id", deptId)
        .gte("date", fromStart)
        .lte("date", fromEnd);
      if (progId) fromQuery = fromQuery.eq("program_id", progId);
      else fromQuery = fromQuery.is("program_id", null);
      const { data: fromRows } = await fromQuery;
      if (!fromRows || fromRows.length === 0) {
        return NextResponse.json({ ok: true, count: 0 });
      }

      const fromDays = new Date(fy, fm, 0).getDate();
      const toDays = new Date(ty, tm, 0).getDate();
      const maxDay = Math.min(fromDays, toDays);

      const rows: { date: string; role: string; count_needed: number; department_id: string; program_id: string | null }[] = [];
      for (const r of fromRows) {
        const fromDate = new Date((r as { date: string }).date);
        const dayNum = fromDate.getDate();
        if (dayNum > maxDay) continue;
        const toDate = new Date(ty, tm - 1, dayNum);
        const toDateStr = toDate.toISOString().slice(0, 10);
        rows.push({
          date: toDateStr,
          role: (r as { role: string }).role,
          count_needed: (r as { count_needed: number }).count_needed,
          department_id: deptId,
          program_id: progId,
        });
      }

      if (rows.length > 0) {
        for (const row of rows) {
          let delQuery = supabase.from("contractor_availability_requirements").delete()
            .eq("date", row.date).eq("role", row.role).eq("department_id", deptId);
          if (progId) delQuery = delQuery.eq("program_id", progId);
          else delQuery = delQuery.is("program_id", null);
          await delQuery;
        }
        const { error: insErr } = await supabase.from("contractor_availability_requirements").insert(rows);
        if (insErr) throw insErr;
      }
      return NextResponse.json({ ok: true, count: rows.length });
    }

    return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
