/**
 * Cron: Send reminder to guests who haven't submitted within 3 days of link creation.
 * Call via Vercel Cron: 0 10 * * * (daily at 10:00 UTC) or similar.
 * Requires CRON_SECRET in env to prevent unauthorized calls.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { batchGetUserEmails } from "@/lib/email-settings";
import { sendGuestInvoiceReminderEmail } from "@/lib/post-recording-emails";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: tokens, error: tokenErr } = await supabase
      .from("guest_invoice_submit_tokens")
      .select("id, token, producer_guest_id, created_at")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .lt("created_at", threeDaysAgo.toISOString());

    if (tokenErr || !tokens?.length) {
      return NextResponse.json({ sent: 0, message: "No reminders to send" });
    }

    const producerIds = Array.from(new Set(tokens.map((t) => (t as { producer_guest_id: string }).producer_guest_id)));
    const { data: guests } = await supabase
      .from("producer_guests")
      .select("id, guest_name, email, program_name, producer_user_id")
      .in("id", producerIds);

    const guestMap = new Map((guests ?? []).map((g) => [g.id, g]));
    const producerIdsForEmail = Array.from(new Set((guests ?? []).map((g) => (g as { producer_user_id: string }).producer_user_id)));
    const producerEmailMap = await batchGetUserEmails(producerIdsForEmail);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", producerIdsForEmail);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    let sent = 0;
    for (const t of tokens) {
      const g = guestMap.get((t as { producer_guest_id: string }).producer_guest_id);
      if (!g?.email?.includes("@")) continue;

      const producerName = profileMap.get((g as { producer_user_id: string }).producer_user_id)?.full_name?.trim() || "The Producer";
      const submitLink = `${APP_URL}/submit/guest/${(t as { token: string }).token}`;

      try {
        await sendGuestInvoiceReminderEmail({
          to: (g as { email: string }).email,
          guestName: (g as { guest_name: string }).guest_name,
          programName: (g as { program_name: string | null }).program_name || "the programme",
          submitLink,
          producerName,
        });
        sent++;
      } catch (e) {
        console.error("[Guest reminder] Failed for token:", t.id, e);
      }
    }

    return NextResponse.json({ sent, total: tokens.length });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
