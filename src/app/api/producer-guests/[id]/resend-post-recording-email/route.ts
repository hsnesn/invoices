/**
 * Resend post-recording thank-you email to an already accepted guest.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendPostRecordingPaidRequestInvoice,
  sendPostRecordingWithInvoice,
  sendPostRecordingNoPayment,
} from "@/lib/post-recording-emails";
import { getOrCreateGuestSubmitLink } from "@/lib/guest-submit-token";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await params;
    const supabase = createAdminClient();

    const isAdmin = profile.role === "admin";
    let query = supabase
      .from("producer_guests")
      .select("id, producer_user_id, guest_name, email, program_name, accepted, payment_received, payment_amount, payment_currency, recording_date, recording_topic, matched_invoice_id")
      .eq("id", id);
    if (!isAdmin) query = query.eq("producer_user_id", session.user.id);
    const { data: guest, error: fetchErr } = await query.single();
    if (fetchErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    if ((guest as { accepted?: boolean }).accepted !== true) {
      return NextResponse.json({ error: "Guest is not marked as accepted" }, { status: 400 });
    }

    const guestEmail = (guest as { email?: string | null }).email?.trim();
    if (!guestEmail || !guestEmail.includes("@")) {
      return NextResponse.json({ error: "Guest email is required" }, { status: 400 });
    }

    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", guest.producer_user_id)
      .single();
    const producerName = producerProfile?.full_name?.trim() || "The Producer";
    const programName = (guest as { program_name?: string }).program_name?.trim() || "our programme";
    const recordingDate = (guest as { recording_date?: string }).recording_date || new Date().toISOString().slice(0, 10);
    const recordingTopic = (guest as { recording_topic?: string }).recording_topic || "the programme";

    if ((guest as { payment_received?: boolean }).payment_received) {
      const amount = (guest as { payment_amount?: number }).payment_amount ?? 0;
      const currency = (guest as { payment_currency?: string }).payment_currency ?? "GBP";
      const amountStr = `${currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

      const invId = (guest as { matched_invoice_id?: string | null }).matched_invoice_id;
      if (invId) {
        const { data: inv } = await supabase
          .from("invoices")
          .select("storage_path")
          .eq("id", invId)
          .single();
        const path = (inv as { storage_path?: string })?.storage_path;
        if (path) {
          const { data: pdf } = await supabase.storage.from("invoices").download(path);
          if (pdf) {
            const buf = await pdf.arrayBuffer();
            const { data: ext } = await supabase.from("invoice_extracted_fields").select("invoice_number").eq("invoice_id", invId).single();
            const invNo = (ext as { invoice_number?: string })?.invoice_number || "invoice";
            await sendPostRecordingWithInvoice({
              to: guestEmail,
              guestName: (guest as { guest_name: string }).guest_name,
              programName,
              invoiceNumber: invNo,
              pdfBuffer: buf,
              producerName,
            });
            return NextResponse.json({ success: true, message: "Thank-you email with invoice resent." });
          }
        }
      }
      let submitLink: string | undefined;
      try {
        submitLink = await getOrCreateGuestSubmitLink(supabase, guest.id);
      } catch {
        submitLink = undefined;
      }
      await sendPostRecordingPaidRequestInvoice({
        to: guestEmail,
        guestName: (guest as { guest_name: string }).guest_name,
        programName,
        amount: amountStr,
        currency,
        recordingDate,
        recordingTopic,
        producerName,
        submitLink,
      });
    } else {
      await sendPostRecordingNoPayment({
        to: guestEmail,
        guestName: (guest as { guest_name: string }).guest_name,
        programName,
        recordingTopic,
        producerName,
      });
    }

    return NextResponse.json({ success: true, message: "Thank-you email resent." });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
