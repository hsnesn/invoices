/**
 * Cron: Send reminder emails when next_due_date is today.
 * Call daily (e.g. 8am) via Vercel Cron or external scheduler.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReminderDueEmail } from "@/lib/email";
import { validateCronAuth } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const supabase = createAdminClient();

    const { data: reminders, error } = await supabase
      .from("reminders")
      .select("id, title, description, next_due_date, assignee_user_id")
      .eq("is_active", true)
      .eq("next_due_date", today);

    if (error) throw error;

    let sent = 0;
    const errors: string[] = [];

    for (const r of reminders ?? []) {
      const assigneeId = (r as { assignee_user_id?: string | null }).assignee_user_id;
      const userIds = assigneeId ? [assigneeId] : [];
      if (userIds.length === 0) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "admin")
          .eq("is_active", true);
        for (const a of admins ?? []) userIds.push((a as { id: string }).id);
      }
      for (const uid of userIds) {
        const { data: user } = await supabase.auth.admin.getUserById(uid);
        const email = user?.user?.email;
        if (email && email.includes("@")) {
          const result = await sendReminderDueEmail({
            to: email,
            title: (r as { title: string }).title,
            description: (r as { description?: string | null }).description,
            nextDueDate: (r as { next_due_date: string }).next_due_date,
            link: `${APP_URL}/office-requests`,
          });
          if (result.success) sent++;
          else errors.push(`${(r as { title: string }).title}: ${String(result.error)}`);
        }
      }
      await supabase
        .from("reminders")
        .update({ last_notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", (r as { id: string }).id);
    }

    return NextResponse.json({
      ok: true,
      remindersDue: reminders?.length ?? 0,
      emailsSent: sent,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    console.error("[Cron] reminders failed:", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
