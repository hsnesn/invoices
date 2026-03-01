/**
 * Bulk mark multiple guests as accepted with shared post-recording details.
 * Sends thank-you emails to each guest. Does not support invoice generation (use single flow for that).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendPostRecordingPaidRequestInvoice,
  sendPostRecordingNoPayment,
} from "@/lib/post-recording-emails";
import { getOrCreateGuestSubmitLink } from "@/lib/guest-submit-token";
import { createAuditEvent } from "@/lib/audit";
import { canSendGuestInvoiceLinks, recordGuestInvoiceLinkSend } from "@/lib/guest-invoice-link-limit";
import { isEmailStageEnabled, isRecipientEnabled } from "@/lib/email-settings";

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const body = (await request.json()) as {
      ids: string[];
      payment_received: boolean;
      payment_amount?: number;
      payment_currency?: "GBP" | "EUR" | "USD";
      recording_date?: string;
      recording_topic?: string;
      program_name?: string;
    };

    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "At least one guest ID is required" }, { status: 400 });
    }

    const isAdmin = profile.role === "admin";
    let query = supabase
      .from("producer_guests")
      .select("id, producer_user_id, guest_name, email, program_name")
      .in("id", ids);
    if (!isAdmin) query = query.eq("producer_user_id", session.user.id);
    const { data: guests, error: fetchErr } = await query;
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const allowed = (guests ?? []).filter((g) => g.producer_user_id === session.user.id || isAdmin);
    if (allowed.length !== ids.length) {
      return NextResponse.json({ error: "Some guests not found or not accessible" }, { status: 403 });
    }

    const recordingDate = body.recording_date?.trim() || new Date().toISOString().slice(0, 10);
    const recordingTopic = body.recording_topic?.trim() || "the programme";
    const programName = body.program_name?.trim() || "our programme";

    if (body.payment_received && !isAdmin) {
      const linksPerProducer = new Map<string, number>();
      for (const g of allowed) {
        const pid = g.producer_user_id;
        linksPerProducer.set(pid, (linksPerProducer.get(pid) ?? 0) + 1);
      }
      for (const [producerId, count] of Array.from(linksPerProducer.entries())) {
        const ok = await canSendGuestInvoiceLinks(supabase, producerId, count);
        if (!ok) {
          return NextResponse.json(
            { error: `Daily limit of 5 invoice links reached for a producer. Try again tomorrow.` },
            { status: 429 }
          );
        }
      }
    }

    const updates = {
      accepted: true,
      updated_at: new Date().toISOString(),
      payment_received: body.payment_received,
      payment_amount: body.payment_received && body.payment_amount != null ? body.payment_amount : null,
      payment_currency: body.payment_received && body.payment_currency ? body.payment_currency : null,
      recording_date: recordingDate,
      recording_topic: recordingTopic,
    };

    const results: { id: string; guest_name: string; email_sent: boolean; error?: string }[] = [];

    for (const g of allowed) {
      const guestEmail = (g as { email?: string | null }).email?.trim();
      const hasEmail = !!guestEmail && guestEmail.includes("@");

      const { error: updateErr } = await supabase
        .from("producer_guests")
        .update(updates)
        .eq("id", g.id);
      if (updateErr) {
        results.push({ id: g.id, guest_name: (g as { guest_name: string }).guest_name, email_sent: false, error: updateErr.message });
        continue;
      }

      await createAuditEvent({
        invoice_id: null,
        actor_user_id: session.user.id,
        event_type: "producer_guest_mark_accepted",
        from_status: null,
        to_status: null,
        payload: {
          producer_guest_id: g.id,
          guest_name: (g as { guest_name: string }).guest_name,
          payment_received: body.payment_received,
          generate_invoice: false,
          bulk: true,
        },
      });

      if (!hasEmail) {
        results.push({ id: g.id, guest_name: (g as { guest_name: string }).guest_name, email_sent: false, error: "No email" });
        continue;
      }

      try {
        const { data: producerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", g.producer_user_id)
          .single();
        const producerName = producerProfile?.full_name?.trim() || "The Producer";

        if (body.payment_received) {
          const amount = body.payment_amount ?? 0;
          const currency = body.payment_currency ?? "GBP";
          const amountStr = `${currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
          let submitLink: string | undefined;
          try {
            submitLink = await getOrCreateGuestSubmitLink(supabase, g.id);
          } catch {
            submitLink = undefined;
          }
          const linkSentEnabled = await isEmailStageEnabled("guest_link_sent");
          const sendToGuest = await isRecipientEnabled("guest_link_sent", "guest");
          if (linkSentEnabled && sendToGuest) {
            await sendPostRecordingPaidRequestInvoice({
              to: guestEmail!,
              guestName: (g as { guest_name: string }).guest_name,
              programName: (g as { program_name?: string }).program_name?.trim() || programName,
              amount: amountStr,
              currency,
              recordingDate,
              recordingTopic,
              producerName,
              submitLink,
            });
          }
          await recordGuestInvoiceLinkSend(supabase, g.producer_user_id);
        } else {
          await sendPostRecordingNoPayment({
            to: guestEmail!,
            guestName: (g as { guest_name: string }).guest_name,
            programName: (g as { program_name?: string }).program_name?.trim() || programName,
            recordingTopic,
            producerName,
          });
        }
        results.push({ id: g.id, guest_name: (g as { guest_name: string }).guest_name, email_sent: true });
      } catch (e) {
        results.push({ id: g.id, guest_name: (g as { guest_name: string }).guest_name, email_sent: false, error: (e as Error).message });
      }
    }

    const sent = results.filter((r) => r.email_sent).length;
    const failed = results.filter((r) => !r.email_sent && r.error);
    return NextResponse.json({
      success: true,
      message: `Marked ${allowed.length} guest(s) as accepted. Emails sent: ${sent}${failed.length ? `, failed: ${failed.length}` : ""}.`,
      results,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
