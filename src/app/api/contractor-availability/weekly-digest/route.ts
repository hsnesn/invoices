/**
 * Weekly digest: every Friday morning, send next week's requirements summary.
 * Sent only when there are requirements for multiple days AND multiple roles.
 * Recipients: London Operations + operations/manager users.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LONDON_OPS_EMAIL = "london.operations@trtworld.com";

export async function GET(request: Request) {
  try {
    const reqAuth = request.headers.get("authorization");
    if (process.env.CRON_SECRET && reqAuth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const nextMonday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);

    const start = nextMonday.toISOString().slice(0, 10);
    const end = nextSunday.toISOString().slice(0, 10);

    const supabase = createAdminClient();
    const { data: reqRows } = await supabase
      .from("contractor_availability_requirements")
      .select("date, role, count_needed")
      .gte("date", start)
      .lte("date", end);

    const requirements = (reqRows ?? []) as { date: string; role: string; count_needed: number }[];
    const uniqueDates = new Set(requirements.map((r) => r.date));
    const uniqueRoles = new Set(requirements.map((r) => r.role));

    if (uniqueDates.size < 2 || uniqueRoles.size < 2) {
      return NextResponse.json({ ok: true, sent: 0, reason: "Need multiple days and multiple roles" });
    }

    const weekLabel = `${nextMonday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${nextSunday.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

    const { sendWeeklyRequirementsDigestEmail } = await import("@/lib/email");

    const recipients: string[] = [LONDON_OPS_EMAIL];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["operations", "manager"])
      .eq("is_active", true);
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email);
    }
    for (const p of profiles ?? []) {
      const email = emailMap.get((p as { id: string }).id);
      if (email && !recipients.includes(email)) recipients.push(email);
    }

    for (const to of recipients) {
      await sendWeeklyRequirementsDigestEmail({ to, weekLabel, requirements });
    }

    return NextResponse.json({ ok: true, sent: recipients.length, weekLabel });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
