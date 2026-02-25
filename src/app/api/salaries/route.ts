import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/salaries - List salaries (admin, operations, finance) */
export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const supabase = createAdminClient();
    let query = supabase
      .from("salaries")
      .select("*, employees(full_name, email_address, bank_account_number, sort_code, badge_color)")
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (month) query = query.eq("payment_month", month);
    if (year) query = query.eq("payment_year", parseInt(year, 10));

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/salaries - Add salary (manual, status = Pending) */
export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const employee_name = (body.employee_name as string)?.trim();
    if (!employee_name) {
      return NextResponse.json({ error: "Employee name is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: employees } = await supabase
      .from("employees")
      .select("id, full_name, ni_number, bank_account_number, sort_code, email_address")
      .ilike("full_name", `%${employee_name.split(" ")[0]}%`);

    const matched = (employees ?? []).find(
      (e) => e.full_name?.toLowerCase() === employee_name.toLowerCase()
    ) ?? (employees ?? [])[0];

    const { data: inserted, error } = await supabase
      .from("salaries")
      .insert({
        employee_id: matched?.id ?? null,
        employee_name,
        ni_number: matched?.ni_number ?? null,
        bank_account_number: matched?.bank_account_number ?? null,
        sort_code: matched?.sort_code ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { createSalaryAuditEvent } = await import("@/lib/salary-extraction");
    await createSalaryAuditEvent({
      salary_id: inserted.id,
      actor_user_id: session.user.id,
      event_type: "salary_added",
      payload: { employee_name },
    });

    return NextResponse.json(inserted);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
