/**
 * Output schedule availability: submit and fetch available days.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { getCompanySettingsAsync } from "@/lib/company-settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const all = searchParams.get("all") === "true" && (profile.role === "admin" || profile.role === "operations");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0);

    const departmentId = searchParams.get("department_id") || undefined;
    const programId = searchParams.get("program_id") || undefined;

    let query = supabase
      .from("output_schedule_availability")
      .select("user_id, date, role, department_id, program_id")
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));

    if (!all) {
      query = query.eq("user_id", profile.id);
    }
    if (departmentId) query = query.eq("department_id", departmentId);
    if (programId) query = query.eq("program_id", programId);

    const { data, error } = await query.order("date");

    if (error) throw error;

    const dates = (data ?? []).map((r: { date: string }) => r.date);
    const roles = (data ?? []).map((r: { date: string; role?: string }) => r.role).filter(Boolean);
    const role = roles[0] ?? null;
    const deptId = (data ?? [])[0] ? (data as { department_id?: string }[])[0]?.department_id ?? null : null;
    const progId = (data ?? [])[0] ? (data as { program_id?: string }[])[0]?.program_id ?? null : null;
    const byUser = all
      ? (data ?? []).reduce((acc: Record<string, { dates: string[]; role?: string; department_id?: string; program_id?: string }>, r: { user_id: string; date: string; role?: string; department_id?: string; program_id?: string }) => {
          if (!acc[r.user_id]) acc[r.user_id] = { dates: [], role: r.role ?? undefined, department_id: r.department_id, program_id: r.program_id };
          acc[r.user_id].dates.push(r.date);
          if (r.role) acc[r.user_id].role = r.role;
          return acc;
        }, {})
      : null;

    return NextResponse.json(all ? { byUser, dates, department_id: deptId, program_id: progId } : { dates, role, department_id: deptId, program_id: progId });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const body = await request.json();
    const { dates, role, department_id, program_id } = body as { dates: string[]; role?: string; department_id?: string; program_id?: string };

    if (!Array.isArray(dates)) {
      return NextResponse.json({ error: "dates must be an array of YYYY-MM-DD strings." }, { status: 400 });
    }

    const valid = dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid dates provided." }, { status: 400 });
    }

    const roleVal = typeof role === "string" && role.trim() ? role.trim() : null;
    if (!roleVal) {
      return NextResponse.json({ error: "Role is required. Please select a role." }, { status: 400 });
    }

    const deptId = typeof department_id === "string" && /^[0-9a-f-]{36}$/i.test(department_id) ? department_id : null;
    if (!deptId) {
      return NextResponse.json({ error: "Department is required." }, { status: 400 });
    }

    const progId = typeof program_id === "string" && /^[0-9a-f-]{36}$/i.test(program_id) ? program_id : null;

    const supabase = createAdminClient();

    const minDate = valid.reduce((a, b) => (a < b ? a : b));
    const maxDate = valid.reduce((a, b) => (a > b ? a : b));
    let deleteQuery = supabase
      .from("output_schedule_availability")
      .delete()
      .eq("user_id", profile.id)
      .eq("department_id", deptId)
      .gte("date", minDate)
      .lte("date", maxDate);
    if (progId) {
      deleteQuery = deleteQuery.eq("program_id", progId);
    } else {
      deleteQuery = deleteQuery.is("program_id", null);
    }
    await deleteQuery;

    if (valid.length > 0) {
      const rows = valid.map((date) => ({
        user_id: profile.id,
        date,
        role: roleVal,
        department_id: deptId,
        program_id: progId,
      }));
      const { error: insErr } = await supabase.from("output_schedule_availability").insert(rows);
      if (insErr) throw insErr;
    }

    const userEmail = (session.user as { email?: string }).email;
    if (userEmail && valid.length > 0) {
      const [y, m] = minDate.split("-").map(Number);
      const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
      const company = await getCompanySettingsAsync();
      const { sendContractorAvailabilitySubmittedEmail } = await import("@/lib/email");
      await sendContractorAvailabilitySubmittedEmail({
        to: company.email_operations,
        replyTo: userEmail,
        personName: profile.full_name ?? "Unknown",
        personEmail: userEmail,
        role: roleVal ?? "",
        monthLabel,
        dates: valid.sort(),
      });
    }

    return NextResponse.json({ ok: true, count: valid.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
