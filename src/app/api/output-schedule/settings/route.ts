/**
 * Output schedule settings: people per day, weekly report recipients, manual match allowed.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getNum(val: unknown): number {
  if (typeof val === "number" && Number.isInteger(val) && val >= 1 && val <= 20) return val;
  if (typeof val === "string") {
    const n = parseInt(val, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 20) return n;
  }
  return 3;
}

function getArr(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x) => typeof x === "string" && x.length > 0);
}

export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Admin or operations only." }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "output_schedule_people_per_day",
        "output_schedule_weekly_report_recipients",
        "output_schedule_manual_match_allowed",
      ]);

    if (error) throw error;

    const map: Record<string, unknown> = {};
    for (const row of data ?? []) {
      const key = (row as { key: string }).key;
      const val = (row as { value: unknown }).value;
      if (key === "output_schedule_people_per_day") map.peoplePerDay = getNum(val);
      if (key === "output_schedule_weekly_report_recipients") map.weeklyReportRecipients = Array.isArray(val) ? val : getArr(val);
      if (key === "output_schedule_manual_match_allowed") {
        const v = typeof val === "string" ? val : String(val ?? "");
        map.manualMatchAllowed = v.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    return NextResponse.json({
      peoplePerDay: (map.peoplePerDay as number) ?? 3,
      weeklyReportRecipients: (map.weeklyReportRecipients as string[]) ?? [],
      manualMatchAllowed: (map.manualMatchAllowed as string[]) ?? ["admin", "operations"],
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Admin or operations only." }, { status: 403 });
    }

    const body = await request.json();
    const { peoplePerDay, weeklyReportRecipients, manualMatchAllowed } = body as {
      peoplePerDay?: number;
      weeklyReportRecipients?: string[];
      manualMatchAllowed?: string[];
    };

    const supabase = createAdminClient();
    const updates: { key: string; value: unknown }[] = [];

    if (peoplePerDay != null) {
      const n = getNum(peoplePerDay);
      updates.push({ key: "output_schedule_people_per_day", value: n });
    }
    if (weeklyReportRecipients != null) {
      updates.push({ key: "output_schedule_weekly_report_recipients", value: getArr(weeklyReportRecipients) });
    }
    if (manualMatchAllowed != null) {
      const arr = getArr(manualMatchAllowed);
      updates.push({ key: "output_schedule_manual_match_allowed", value: arr.join(",") || "admin,operations" });
    }

    for (const u of updates) {
      await supabase
        .from("app_settings")
        .upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
