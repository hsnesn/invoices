/**
 * Guest requests a new invoice link (when current link is used or expired).
 * Notifies producer by email. Public endpoint - no auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { batchGetUserEmails } from "@/lib/email-settings";
import { sendGuestRequestedNewLinkEmail } from "@/lib/post-recording-emails";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }

    const body = await request.json().catch(() => ({}));
    const token = (body.token as string)?.trim();

    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("guest_invoice_submit_tokens")
      .select("id, producer_guest_id, expires_at, used_at")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const t = tokenRow as { producer_guest_id: string; expires_at: string; used_at: string | null };
    const isUsed = !!t.used_at;
    const isExpired = new Date(t.expires_at) < new Date();

    if (!isUsed && !isExpired) {
      return NextResponse.json({ error: "Link is still valid. You can use it to submit." }, { status: 400 });
    }

    const { data: guest, error: guestErr } = await supabase
      .from("producer_guests")
      .select("id, guest_name, email, program_name, producer_user_id")
      .eq("id", t.producer_guest_id)
      .single();

    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const g = guest as { id: string; guest_name: string; email: string | null; program_name: string | null; producer_user_id: string };
    const producerEmailMap = await batchGetUserEmails([g.producer_user_id]);
    const producerEmail = producerEmailMap.get(g.producer_user_id)?.trim();

    if (!producerEmail) {
      return NextResponse.json({ error: "Producer could not be reached. Please contact them directly." }, { status: 500 });
    }

    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", g.producer_user_id)
      .single();
    const producerName = producerProfile?.full_name?.trim() || "The Producer";
    const programName = g.program_name?.trim() || "the programme";

    await sendGuestRequestedNewLinkEmail({
      to: producerEmail,
      producerName,
      guestName: g.guest_name,
      guestEmail: g.email,
      programName,
      producerGuestId: g.id,
    });

    return NextResponse.json({
      success: true,
      message: "We have notified the producer. They will send you a new link soon.",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
