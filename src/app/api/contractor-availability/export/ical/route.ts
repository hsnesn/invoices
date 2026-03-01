/**
 * Export booked days as iCal for calendar apps.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month. Use YYYY-MM." }, { status: 400 });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m, 0).toISOString().slice(0, 10);

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("output_schedule_assignments")
      .select("date, role")
      .eq("user_id", profile.id)
      .eq("status", "confirmed")
      .gte("date", start)
      .lte("date", end)
      .order("date");

    const monthLabel = new Date(y, m - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
    const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "TRT UK Operations Platform";

    let ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//" + escapeIcal(appName) + "//Contractor Schedule//EN",
      "CALSCALE:GREGORIAN",
    ];

    for (const a of data ?? []) {
      const dateStr = (a as { date: string }).date;
      const role = (a as { role: string | null }).role || "";
      const ymd = dateStr.replace(/-/g, "");
      const nextDay = new Date(dateStr + "T12:00:00");
      nextDay.setDate(nextDay.getDate() + 1);
      const endYmd = nextDay.toISOString().slice(0, 10).replace(/-/g, "");
      const summary = role ? `Booked: ${role}` : "Booked";
      ical.push(
        "BEGIN:VEVENT",
        "UID:" + dateStr + "-" + profile.id.slice(0, 8) + "@contractor-schedule",
        "DTSTART;VALUE=DATE:" + ymd,
        "DTEND;VALUE=DATE:" + endYmd,
        "SUMMARY:" + escapeIcal(summary),
        "DESCRIPTION:" + escapeIcal(`${monthLabel} contractor schedule`),
        "END:VEVENT"
      );
    }

    ical.push("END:VCALENDAR");
    const body = ical.join("\r\n");

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="contractor-schedule-${month}.ics"`,
      },
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
