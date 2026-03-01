/**
 * Send invoice submit link to a guest (standalone, not from mark-accepted).
 * Creates producer_guest, token, and sends email. Form fields must be filled before sending.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPostRecordingPaidRequestInvoice } from "@/lib/post-recording-emails";
import { getOrCreateGuestSubmitLink } from "@/lib/guest-submit-token";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const canSend = ["admin", "operations", "manager", "submitter"].includes(profile.role);
    if (!canSend) {
      return NextResponse.json({ error: "Not allowed to send invoice links" }, { status: 403 });
    }

    const body = await request.json();
    const guestName = (body.guest_name as string)?.trim();
    const email = (body.email as string)?.trim();
    const programName = (body.program_name as string)?.trim();
    const recordingDate = (body.recording_date as string)?.trim();
    const recordingTopic = (body.recording_topic as string)?.trim();
    const paymentAmount = typeof body.payment_amount === "number" ? body.payment_amount : parseFloat(body.payment_amount) || 0;
    const paymentCurrency = (body.payment_currency as string)?.trim() || "GBP";

    if (!guestName || guestName.length < 2) {
      return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!programName || programName.length < 2) {
      return NextResponse.json({ error: "Program name is required" }, { status: 400 });
    }
    if (!recordingDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordingDate)) {
      return NextResponse.json({ error: "Recording date is required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!recordingTopic || recordingTopic.length < 2) {
      return NextResponse.json({ error: "Recording topic is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const amountStr = `${paymentCurrency === "GBP" ? "£" : paymentCurrency === "EUR" ? "€" : "$"}${Math.max(0, paymentAmount).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();
    const producerName = producerProfile?.full_name?.trim() || "The Producer";

    const { data: guest, error: insertErr } = await supabase
      .from("producer_guests")
      .insert({
        producer_user_id: session.user.id,
        guest_name: guestName,
        email,
        program_name: programName,
        recording_date: recordingDate,
        recording_topic: recordingTopic,
        payment_received: true,
        payment_amount: Math.max(0, paymentAmount),
        payment_currency: paymentCurrency,
        accepted: true,
        invited_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr || !guest) {
      return NextResponse.json({ error: "Failed to create guest record: " + (insertErr?.message ?? "Unknown") }, { status: 500 });
    }

    let submitLink: string | undefined;
    try {
      submitLink = await getOrCreateGuestSubmitLink(supabase, guest.id);
    } catch {
      submitLink = undefined;
    }

    await sendPostRecordingPaidRequestInvoice({
      to: email,
      guestName,
      programName,
      amount: amountStr,
      currency: paymentCurrency,
      recordingDate,
      recordingTopic,
      producerName,
      submitLink,
    });

    return NextResponse.json({
      success: true,
      message: "Invoice submit link sent to guest.",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
