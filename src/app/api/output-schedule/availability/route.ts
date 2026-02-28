/**
 * Output schedule availability: submit and fetch available days.
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
    const all = searchParams.get("all") === "true" && (profile.role === "admin" || profile.role === "operations");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0);

    let query = supabase
      .from("output_schedule_availability")
      .select("user_id, date, role")
      .gte("date", start.toISOString().slice(0, 10))
      .lte("date", end.toISOString().slice(0, 10));

    if (!all) {
      query = query.eq("user_id", profile.id);
    }

    const { data, error } = await query.order("date");

    if (error) throw error;

    const dates = (data ?? []).map((r: { date: string }) => r.date);
    const roles = (data ?? []).map((r: { date: string; role?: string }) => r.role).filter(Boolean);
    const role = roles[0] ?? null; // same role for all in a submission
    const byUser = all
      ? (data ?? []).reduce((acc: Record<string, { dates: string[]; role?: string }>, r: { user_id: string; date: string; role?: string }) => {
          if (!acc[r.user_id]) acc[r.user_id] = { dates: [], role: r.role ?? undefined };
          acc[r.user_id].dates.push(r.date);
          if (r.role) acc[r.user_id].role = r.role;
          return acc;
        }, {})
      : null;

    return NextResponse.json(all ? { byUser, dates } : { dates, role });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const body = await request.json();
    const { dates, role } = body as { dates: string[]; role?: string };

    if (!Array.isArray(dates)) {
      return NextResponse.json({ error: "dates must be an array of YYYY-MM-DD strings." }, { status: 400 });
    }

    const valid = dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid dates provided." }, { status: 400 });
    }

    const roleVal = typeof role === "string" && role.trim() ? role.trim() : null;

    const supabase = createAdminClient();

    const minDate = valid.reduce((a, b) => (a < b ? a : b));
    const maxDate = valid.reduce((a, b) => (a > b ? a : b));
    await supabase
      .from("output_schedule_availability")
      .delete()
      .eq("user_id", profile.id)
      .gte("date", minDate)
      .lte("date", maxDate);

    if (valid.length > 0) {
      const rows = valid.map((date) => ({ user_id: profile.id, date, role: roleVal }));
      const { error: insErr } = await supabase.from("output_schedule_availability").insert(rows);
      if (insErr) throw insErr;
    }

    const userEmail = (session.user as { email?: string }).email;
    if (userEmail && valid.length > 0) {
      const [y, m] = minDate.split("-").map(Number);
      const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
      const { sendContractorAvailabilitySubmittedEmail } = await import("@/lib/email");
      await sendContractorAvailabilitySubmittedEmail({
        to: "london.operations@trtworld.com",
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
