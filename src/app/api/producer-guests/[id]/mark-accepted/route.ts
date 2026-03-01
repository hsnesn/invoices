/**
 * Mark guest as accepted (post-recording) with payment details and optional invoice generation.
 * Sends appropriate thank-you email. If generate_invoice, creates invoice and sends to both producer and guest.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import {
  sendPostRecordingPaidRequestInvoice,
  sendPostRecordingWithInvoice,
  sendPostRecordingNoPayment,
} from "@/lib/post-recording-emails";
import { getOrCreateGuestSubmitLink } from "@/lib/guest-submit-token";
import { generateGuestInvoicePdf, type GuestInvoiceAppearance } from "@/lib/guest-invoice-pdf";
import { pickManagerForGuestInvoice } from "@/lib/manager-assignment";
import { createAuditEvent } from "@/lib/audit";

const BUCKET = "invoices";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await params;
    const supabase = createAdminClient();

    const body = (await request.json()) as {
      payment_received: boolean;
      payment_amount?: number;
      payment_currency?: "GBP" | "EUR" | "USD";
      recording_date?: string;
      recording_topic?: string;
      program_name?: string;
      generate_invoice_for_guest?: boolean;
      invoice_number?: string;
      invoice_date?: string;
      account_name?: string;
      account_number?: string;
      sort_code?: string;
      bank_name?: string;
      bank_address?: string;
      paypal?: string;
    };

    const isAdmin = profile.role === "admin";
    let query = supabase
      .from("producer_guests")
      .select("id, producer_user_id, guest_name, email, title, program_name")
      .eq("id", id);
    if (!isAdmin) query = query.eq("producer_user_id", session.user.id);
    const { data: guest, error: fetchErr } = await query.single();
    if (fetchErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const guestEmail = (guest as { email?: string | null }).email?.trim();
    if (!guestEmail || !guestEmail.includes("@")) {
      return NextResponse.json({ error: "Guest email is required to send post-recording email" }, { status: 400 });
    }

    const recordingDate = body.recording_date?.trim() || new Date().toISOString().slice(0, 10);
    const recordingTopic = body.recording_topic?.trim() || "the programme";
    const programName = body.program_name?.trim() || (guest as { program_name?: string | null }).program_name?.trim() || "our programme";

    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", guest.producer_user_id)
      .single();
    const producerName = producerProfile?.full_name?.trim() || "The Producer";
    const producerEmail = producerProfile?.email?.trim();

    const updates: Record<string, unknown> = {
      accepted: true,
      updated_at: new Date().toISOString(),
      payment_received: body.payment_received,
      payment_amount: body.payment_received && body.payment_amount != null ? body.payment_amount : null,
      payment_currency: body.payment_received && body.payment_currency ? body.payment_currency : null,
      recording_date: recordingDate || null,
      recording_topic: recordingTopic || null,
    };

    const { error: updateErr } = await supabase.from("producer_guests").update(updates).eq("id", id);
    if (updateErr) {
      return NextResponse.json({ error: "Failed to update guest: " + updateErr.message }, { status: 500 });
    }

    await createAuditEvent({
      invoice_id: null,
      actor_user_id: session.user.id,
      event_type: "producer_guest_mark_accepted",
      from_status: null,
      to_status: null,
      payload: {
        producer_guest_id: id,
        guest_name: (guest as { guest_name: string }).guest_name,
        payment_received: body.payment_received,
        generate_invoice: body.generate_invoice_for_guest ?? false,
      },
    });

    let invoiceId: string | null = null;

    if (body.payment_received) {
      const amount = body.payment_amount ?? 0;
      const currency = body.payment_currency ?? "GBP";
      const amountStr = `${currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}${amount.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

      if (body.generate_invoice_for_guest) {
        if (
          !body.account_name?.trim() ||
          !body.account_number?.trim() ||
          !body.sort_code?.trim() ||
          !body.invoice_number?.trim()
        ) {
          return NextResponse.json({
            error: "Account name, account number, sort code and invoice number are required to generate invoice",
          }, { status: 400 });
        }

        const { data: programs } = await supabase
          .from("programs")
          .select("id, name, department_id");
        const prog = (programs ?? []).find((p) => p.name?.trim().toLowerCase() === programName.toLowerCase());
        const programId = prog?.id && UUID_RE.test(prog.id) ? prog.id : null;
        const departmentId = prog?.department_id && UUID_RE.test(String(prog.department_id)) ? prog.department_id : null;

        if (!departmentId || !programId) {
          return NextResponse.json({ error: "Could not resolve program/department. Please ensure the program exists." }, { status: 400 });
        }

        const managerUserId = await pickManagerForGuestInvoice(supabase, departmentId, programId);
        const { data: dept } = await supabase.from("departments").select("name").eq("id", departmentId).single();
        const { data: progData } = await supabase.from("programs").select("name").eq("id", programId).single();
        const deptName = dept?.name ?? "";
        const progName = progData?.name ?? programName;

        const appearances: GuestInvoiceAppearance[] = [{
          programmeName: progName,
          topic: recordingTopic,
          date: recordingDate,
          amount,
        }];

        const pdfData = {
          invNo: body.invoice_number!.trim(),
          invoiceDate: body.invoice_date || new Date().toISOString().slice(0, 10),
          currency,
          guestName: (guest as { guest_name: string }).guest_name,
          guestEmail: guestEmail || undefined,
          appearances,
          expenses: [],
          totalAmount: amount,
          paypal: body.paypal?.trim(),
          accountName: body.account_name!.trim(),
          bankName: body.bank_name?.trim(),
          accountNumber: body.account_number!.trim(),
          sortCode: body.sort_code!.trim(),
          bankAddress: body.bank_address?.trim(),
        };

        const pdfBuffer = generateGuestInvoicePdf(pdfData);
        invoiceId = crypto.randomUUID();
        const safeGuestName = (guest as { guest_name: string }).guest_name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "invoice";
        const pdfPath = `${session.user.id}/${invoiceId}-post-recording-invoice.pdf`;

        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(pdfPath, Buffer.from(pdfBuffer), {
          contentType: "application/pdf",
          upsert: false,
        });
        if (uploadErr) {
          return NextResponse.json({
            error: "PDF upload failed: " + uploadErr.message,
            guest_marked_accepted: true,
            message: "Guest was marked as accepted, but invoice PDF upload failed. Please try again or generate the invoice manually.",
          }, { status: 500 });
        }

        const serviceDesc = [
          `Guest Name: ${(guest as { guest_name: string }).guest_name}`,
          `Title: ${(guest as { title?: string }).title || ""}`,
          `Guest Email: ${guestEmail}`,
          `Producer: ${producerName}`,
          `Topic: ${recordingTopic}`,
          `Department Name: ${deptName}`,
          `Programme Name: ${progName}`,
          `Invoice Date: ${pdfData.invoiceDate}`,
          `TX Date: ${recordingDate}`,
          `Payment Type: paid_guest`,
          `Source: Post-recording (producer-generated)`,
        ].join("\n");

        const { error: invError } = await supabase.from("invoices").insert({
          id: invoiceId,
          submitter_user_id: session.user.id,
          department_id: departmentId,
          program_id: programId,
          service_description: serviceDesc,
          service_date_from: recordingDate,
          service_date_to: recordingDate,
          currency,
          storage_path: pdfPath,
          invoice_type: "guest",
          generated_invoice_data: {
            appearances,
            paypal: body.paypal?.trim() || null,
            guest_name: (guest as { guest_name: string }).guest_name,
            guest_email: guestEmail,
            title: (guest as { title?: string }).title || null,
          },
        });

        if (invError) {
          await supabase.storage.from(BUCKET).remove([pdfPath]);
          return NextResponse.json({
            error: "Invoice creation failed: " + invError.message,
            guest_marked_accepted: true,
            message: "Guest was marked as accepted, but invoice creation failed. Please try again or create the invoice manually.",
          }, { status: 500 });
        }

        const today = new Date().toISOString().slice(0, 10);
        await supabase.from("invoice_workflows").insert({
          invoice_id: invoiceId,
          status: "pending_manager",
          manager_user_id: managerUserId,
          pending_manager_since: today,
        });

        await supabase.from("invoice_extracted_fields").upsert(
          {
            invoice_id: invoiceId,
            invoice_number: body.invoice_number!.trim(),
            beneficiary_name: body.account_name!.trim(),
            account_number: body.account_number!.trim(),
            sort_code: body.sort_code!.trim(),
            gross_amount: amount,
            extracted_currency: currency,
            needs_review: false,
            manager_confirmed: false,
            raw_json: { source: "post_recording_producer_generated" },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "invoice_id" }
        );

        await supabase.from("invoice_files").insert({
          invoice_id: invoiceId,
          storage_path: pdfPath,
          file_name: `Invoice_${body.invoice_number!.trim()}.pdf`,
          sort_order: 0,
        });

        await supabase
          .from("producer_guests")
          .update({ matched_invoice_id: invoiceId, matched_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id);

        await createAuditEvent({
          invoice_id: invoiceId,
          actor_user_id: session.user.id,
          event_type: "invoice_submitted",
          from_status: null,
          to_status: "pending_manager",
          payload: { source: "post_recording_producer_generated", producer_guest_id: id },
        });

        await sendPostRecordingWithInvoice({
          to: guestEmail,
          guestName: (guest as { guest_name: string }).guest_name,
          programName: progName,
          invoiceNumber: body.invoice_number!.trim(),
          pdfBuffer,
          producerName,
        });

        if (producerEmail && producerEmail !== guestEmail) {
          await sendPostRecordingWithInvoice({
            to: producerEmail,
            guestName: (guest as { guest_name: string }).guest_name,
            programName: progName,
            invoiceNumber: body.invoice_number!.trim(),
            pdfBuffer,
            producerName,
          });
        }
      } else {
        const submitLink = await getOrCreateGuestSubmitLink(supabase, id);
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
      }
    } else {
      await sendPostRecordingNoPayment({
        to: guestEmail,
        guestName: (guest as { guest_name: string }).guest_name,
        programName,
        recordingTopic,
        producerName,
      });
    }

    return NextResponse.json({
      success: true,
      message: invoiceId
        ? "Guest marked as accepted. Invoice generated and sent to guest and producer."
        : "Guest marked as accepted. Thank-you email sent.",
      invoice_id: invoiceId,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    const msg = (e as Error).message;
    return NextResponse.json({
      error: msg,
      message: msg.includes("email") ? msg : "An unexpected error occurred. Please try again.",
    }, { status: 500 });
  }
}
