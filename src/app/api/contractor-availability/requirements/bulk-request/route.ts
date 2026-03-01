/**
 * Bulk freelancer request: create requirements from a pattern (e.g. "4 outputs every weekday in March")
 * and email London Operations. Same effect as manual selection.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { parseFreelancerRequest } from "@/lib/parse-freelancer-request";
import { getCompanySettingsAsync } from "@/lib/company-settings";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function canManage(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canManage(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const text = (body.text as string)?.trim();
    const departmentId = (body.department_id as string)?.trim();
    const programId = (body.program_id as string)?.trim() || undefined;

    if (!departmentId || !/^[0-9a-f-]{36}$/i.test(departmentId)) {
      return NextResponse.json({ error: "department_id is required." }, { status: 400 });
    }

    const progId = programId && /^[0-9a-f-]{36}$/i.test(programId) ? programId : null;

    let parsed: { month: string; role: string; count_per_day: number; days_of_week: number[] };

    if (text) {
      const supabase = createAdminClient();
      const { data: rolesData } = await supabase.from("contractor_availability_roles").select("value").order("sort_order");
      const availableRoles = (rolesData ?? []).map((r) => (r as { value: string }).value);

      const aiParsed = await parseFreelancerRequest(text, availableRoles);
      if (!aiParsed) {
        return NextResponse.json(
          { error: "Could not parse request. Try: '4 outputs every weekday in March' or use the form below." },
          { status: 400 }
        );
      }
      parsed = aiParsed;

      const roleMatch = availableRoles.find((r) => r.toLowerCase() === parsed.role.toLowerCase());
      if (roleMatch) parsed.role = roleMatch;
    } else {
      const month = (body.month as string)?.trim();
      const role = (body.role as string)?.trim();
      const count_per_day = Math.max(1, Math.min(20, Math.floor(Number(body.count_per_day) || 1)));
      const days_of_week = Array.isArray(body.days_of_week)
        ? (body.days_of_week as number[]).filter((d) => d >= 0 && d <= 6)
        : [1, 2, 3, 4, 5];

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
      }
      if (!role) {
        return NextResponse.json({ error: "Role is required." }, { status: 400 });
      }
      parsed = { month, role, count_per_day, days_of_week: days_of_week.length ? days_of_week : [1, 2, 3, 4, 5] };
    }

    const [y, m] = parsed.month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);

    const toInsert: { date: string; role: string; count_needed: number; department_id: string; program_id: string | null }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (!parsed.days_of_week.includes(d.getDay())) continue;
      toInsert.push({
        date: d.toISOString().slice(0, 10),
        role: parsed.role,
        count_needed: parsed.count_per_day,
        department_id: departmentId,
        program_id: progId,
      });
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ error: "No matching dates in that month for the selected days." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const rows = toInsert.map((x) => ({
      date: x.date,
      role: x.role,
      count_needed: x.count_needed,
      department_id: x.department_id,
      program_id: x.program_id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("contractor_availability_requirements").upsert(rows, {
      onConflict: "date,role,department_id,program_id",
    });

    if (error) throw error;

    const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
    const requesterName = (profile as { full_name?: string }).full_name ?? "A user";

    const company = await getCompanySettingsAsync();
    const { sendFreelancerRequestToLondonOps } = await import("@/lib/email");
    sendFreelancerRequestToLondonOps({
      to: company.email_operations,
      monthLabel,
      requesterName,
      requirements: toInsert.map((x) => ({ date: x.date, role: x.role, count_needed: x.count_needed })),
    }).catch((err) => console.error("[bulk-request] Email failed:", err));

    return NextResponse.json({
      ok: true,
      count: toInsert.length,
      month: parsed.month,
      monthLabel,
      message: `Created ${toInsert.length} requirements for ${monthLabel}. London Operations has been notified.`,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
