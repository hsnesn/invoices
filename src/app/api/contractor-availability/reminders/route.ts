/**
 * Send reminder emails 1 day before booked days.
 * Call via cron (e.g. Vercel Cron) daily.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanySettingsAsync } from "@/lib/company-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const reqAuth = request.headers.get("authorization");
    if (process.env.CRON_SECRET && reqAuth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const supabase = createAdminClient();
    const { data: assignments } = await supabase
      .from("output_schedule_assignments")
      .select("user_id, role")
      .eq("date", dateStr)
      .eq("status", "confirmed");

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, date: dateStr });
    }

    const byUser = new Map<string, string>();
    for (const a of assignments as { user_id: string; role: string | null }[]) {
      byUser.set(a.user_id, a.role?.trim() || "—");
    }
    const userIds = Array.from(byUser.keys());
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email);
    }
    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
    }

    const dateLabel = tomorrow.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const company = await getCompanySettingsAsync();
    const { isEmailStageEnabled, isRecipientEnabled } = await import("@/lib/email-settings");
    const stageEnabled = await isEmailStageEnabled("assignment_reminder");
    const sendToContractor = await isRecipientEnabled("assignment_reminder", "contractor");

    let sent = 0;
    if (stageEnabled && sendToContractor) {
      const { sendContractorReminderEmail } = await import("@/lib/email");
      for (const uid of userIds) {
        const email = emailMap.get(uid);
        if (email) {
          await sendContractorReminderEmail({
            to: email,
            personName: nameMap.get(uid) ?? "",
            dateLabel,
            role: byUser.get(uid) ?? "—",
            replyTo: company.email_operations,
          });
          sent++;
        }
      }
    }

    return NextResponse.json({ ok: true, sent, date: dateStr });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
