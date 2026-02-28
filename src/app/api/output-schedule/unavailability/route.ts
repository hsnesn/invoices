/**
 * Unavailability (blackout): days contractor cannot work.
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

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("output_schedule_unavailability")
      .select("date")
      .eq("user_id", profile.id)
      .gte("date", start)
      .lte("date", end)
      .order("date");

    if (error) throw error;
    const dates = (data ?? []).map((r: { date: string }) => r.date);
    return NextResponse.json({ dates });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const body = await request.json();
    const { dates } = body as { dates: string[] };

    if (!Array.isArray(dates)) {
      return NextResponse.json({ error: "dates must be an array of YYYY-MM-DD strings." }, { status: 400 });
    }

    const valid = dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid dates provided." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const rows = valid.map((date) => ({ user_id: profile.id, date }));
    const { error } = await supabase.from("output_schedule_unavailability").upsert(rows, {
      onConflict: "user_id,date",
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, count: valid.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const body = await request.json();
    const { month, dates } = body as { month: string; dates: string[] };

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }
    if (!Array.isArray(dates)) {
      return NextResponse.json({ error: "dates must be an array." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
    const valid = dates.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));

    const supabase = createAdminClient();
    await supabase
      .from("output_schedule_unavailability")
      .delete()
      .eq("user_id", profile.id)
      .gte("date", start)
      .lte("date", end);

    if (valid.length > 0) {
      const rows = valid.map((date) => ({ user_id: profile.id, date }));
      const { error } = await supabase.from("output_schedule_unavailability").insert(rows);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, count: valid.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("output_schedule_unavailability")
      .delete()
      .eq("user_id", profile.id)
      .eq("date", date);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
