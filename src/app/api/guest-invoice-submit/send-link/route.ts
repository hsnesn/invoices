/**
 * Send invoice submit link to a guest (standalone, not from mark-accepted).
 * Saves guest to main contact list (guest_contacts), creates producer_guest linked to program,
 * and sends email. When invoice arrives, it matches to the producer_guest.
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
    const title = (body.title as string)?.trim() || null;
    const phone = (body.phone as string)?.trim() || null;
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

    const guestNameNorm = guestName.trim().replace(/\s+/g, " ");
    const nameKey = guestNameNorm.toLowerCase();
    const now = new Date().toISOString();

    const { data: existingGc } = await supabase
      .from("guest_contacts")
      .select("id")
      .eq("guest_name_key", nameKey)
      .maybeSingle();

    const gcUpdate: Record<string, unknown> = {
      email,
      primary_program: programName,
      topic: recordingTopic,
      last_invited_at: now,
      updated_at: now,
      source: "send_invoice_link",
    };
    if (phone) gcUpdate.phone = phone;
    if (title) gcUpdate.title = title;
    if (existingGc?.id) {
      await supabase.from("guest_contacts").update(gcUpdate).eq("id", existingGc.id);
    } else {
      await supabase.from("guest_contacts").insert({ guest_name: guestNameNorm, phone: phone || undefined, title: title || undefined, ...gcUpdate });
    }

    const { data: gcRow } = await supabase
      .from("guest_contacts")
      .select("id")
      .eq("guest_name_key", nameKey)
      .maybeSingle();

    const { data: guest, error: insertErr } = await supabase
      .from("producer_guests")
      .insert({
        producer_user_id: session.user.id,
        guest_contact_id: gcRow?.id ?? null,
        guest_name: guestName,
        email,
        title: title || undefined,
        program_name: programName,
        recording_date: recordingDate,
        recording_topic: recordingTopic,
        payment_received: true,
        payment_amount: Math.max(0, paymentAmount),
        payment_currency: paymentCurrency,
        accepted: true,
        invited_at: now,
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
