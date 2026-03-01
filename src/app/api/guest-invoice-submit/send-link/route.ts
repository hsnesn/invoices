/**
 * Send invoice submit link to a guest (standalone, not from mark-accepted).
 * Saves guest to main contact list (guest_contacts), creates producer_guest linked to program,
 * and sends email. Optionally generates invoice on behalf of guest if they don't have one ready.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPostRecordingPaidRequestInvoice, sendPostRecordingWithInvoice } from "@/lib/post-recording-emails";
import { getOrCreateGuestSubmitLink } from "@/lib/guest-submit-token";
import { generateGuestInvoicePdf, type GuestInvoiceAppearance } from "@/lib/guest-invoice-pdf";
import { pickManagerForGuestInvoice } from "@/lib/manager-assignment";
import { checkGuestInvoiceLinkLimit, recordGuestInvoiceLinkSend } from "@/lib/guest-invoice-link-limit";

const BUCKET = "invoices";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const paymentCurrencyRaw = (body.payment_currency as string)?.trim() || "";
    const paymentCurrency = (paymentCurrencyRaw || "GBP") as "GBP" | "EUR" | "USD";
    const generateInvoice = !!body.generate_invoice_for_guest;

    if (paymentAmount > 0 && !paymentCurrencyRaw) {
      return NextResponse.json({ error: "Currency is required when payment amount is specified" }, { status: 400 });
    }
    if (generateInvoice && !paymentCurrencyRaw) {
      return NextResponse.json({ error: "Currency is required when generating invoice" }, { status: 400 });
    }
    if (!guestName || guestName.length < 2) {
      return NextResponse.json({ error: "Guest name is required" }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (!title || title.length < 2) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
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
    if (generateInvoice) {
      const acc = (body.account_name as string)?.trim();
      const accNum = (body.account_number as string)?.trim();
      const sortCode = (body.sort_code as string)?.trim();
      const invNo = (body.invoice_number as string)?.trim();
      if (!acc || !accNum || !sortCode || !invNo) {
        return NextResponse.json({ error: "Invoice number and bank details are required when generating invoice" }, { status: 400 });
      }
    }

    const supabase = createAdminClient();

    if (!generateInvoice) {
      const limitCheck = await checkGuestInvoiceLinkLimit(supabase, session.user.id);
      if (!limitCheck.ok) {
        return NextResponse.json(
          { error: `You have reached the daily limit of 5 invoice links. You can send more tomorrow.` },
          { status: 429 }
        );
      }
    }

    const amountStr = `${paymentCurrency === "GBP" ? "£" : paymentCurrency === "EUR" ? "€" : "$"}${Math.max(0, paymentAmount).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();
    const producerName = producerProfile?.full_name?.trim() || "The Producer";

    const guestNameNorm = guestName.trim().replace(/\s+/g, " ");
    const nameKey = guestNameNorm.toLowerCase();
    const emailNorm = email.trim().toLowerCase();
    const now = new Date().toISOString();

    const { data: existingGc } = await supabase
      .from("guest_contacts")
      .select("id")
      .eq("guest_name_key", nameKey)
      .maybeSingle();

    const gcUpdate: Record<string, unknown> = {
      email,
      title,
      primary_program: programName,
      topic: recordingTopic,
      last_invited_at: now,
      updated_at: now,
      source: "send_invoice_link",
    };
    if (phone) gcUpdate.phone = phone;
    if (existingGc?.id) {
      await supabase.from("guest_contacts").update(gcUpdate).eq("id", existingGc.id);
    } else {
      await supabase.from("guest_contacts").insert({ guest_name: guestNameNorm, phone: phone || undefined, ...gcUpdate });
    }

    const { data: gcRow } = await supabase
      .from("guest_contacts")
      .select("id")
      .eq("guest_name_key", nameKey)
      .maybeSingle();

    const { data: existingGuests } = await supabase
      .from("producer_guests")
      .select("id, guest_name, email")
      .eq("producer_user_id", session.user.id);

    const existingGuest = (existingGuests ?? []).find(
      (p) =>
        (p.guest_name?.trim().toLowerCase() === nameKey) ||
        (emailNorm && p.email?.trim().toLowerCase() === emailNorm)
    );

    let guestId: string;

    if (existingGuest) {
      guestId = existingGuest.id;
    } else {
      const { data: guest, error: insertErr } = await supabase
        .from("producer_guests")
        .insert({
          producer_user_id: session.user.id,
          guest_contact_id: gcRow?.id ?? null,
          guest_name: guestName,
          email,
          title,
          program_name: programName,
          recording_date: recordingDate,
          recording_topic: recordingTopic,
          payment_received: true,
          payment_amount: Math.max(0, paymentAmount),
          payment_currency: paymentCurrencyRaw || null,
          accepted: true,
          invited_at: now,
        })
        .select("id")
        .single();

      if (insertErr || !guest) {
        return NextResponse.json({ error: "Failed to create guest record: " + (insertErr?.message ?? "Unknown") }, { status: 500 });
      }
      guestId = guest.id;
    }

    let invoiceId: string | null = null;

    if (generateInvoice) {
      const invNo = (body.invoice_number as string)?.trim()!;
      const invoiceDate = (body.invoice_date as string)?.trim() || new Date().toISOString().slice(0, 10);
      const accountName = (body.account_name as string)?.trim()!;
      const bankType = (body.bank_type as string)?.trim() === "international" ? "international" : "uk";
      const accountNumber = (body.account_number as string)?.trim();
      const sortCode = (body.sort_code as string)?.trim();
      const iban = (body.iban as string)?.trim();
      const swiftBic = (body.swift_bic as string)?.trim();
      const bankName = (body.bank_name as string)?.trim() || undefined;
      const bankAddress = (body.bank_address as string)?.trim() || undefined;
      const paypal = (body.paypal as string)?.trim() || undefined;

      if (!accountName) {
        return NextResponse.json({ error: "Account name is required" }, { status: 400 });
      }
      if (bankType === "uk") {
        if (!accountNumber || !sortCode) {
          return NextResponse.json({ error: "Account number and sort code are required for UK bank accounts" }, { status: 400 });
        }
      } else {
        if (!iban || !swiftBic) {
          return NextResponse.json({ error: "IBAN and SWIFT/BIC are required for international transfers" }, { status: 400 });
        }
      }

      const { data: programs } = await supabase.from("programs").select("id, name, department_id");
      const prog = (programs ?? []).find((p) => (p.name ?? "").trim().toLowerCase() === programName.toLowerCase());
      const programId = prog?.id && UUID_RE.test(prog.id) ? prog.id : null;
      const departmentId = prog?.department_id && UUID_RE.test(String(prog.department_id)) ? prog.department_id : null;

      if (!departmentId || !programId) {
        return NextResponse.json({ error: "Could not resolve program. Please ensure the program exists." }, { status: 400 });
      }

      const managerUserId = await pickManagerForGuestInvoice(supabase, departmentId, programId);
      const { data: dept } = await supabase.from("departments").select("name").eq("id", departmentId).single();
      const deptName = dept?.name ?? "";
      const progName = prog?.name ?? programName;

      const appearances: GuestInvoiceAppearance[] = [{
        programmeName: progName,
        topic: recordingTopic,
        date: recordingDate,
        amount: Math.max(0, paymentAmount),
      }];

      const pdfData = {
        invNo,
        invoiceDate,
        currency: paymentCurrency,
        guestName,
        guestEmail: email,
        departmentName: deptName,
        programmeName: progName,
        appearances,
        expenses: [],
        totalAmount: Math.max(0, paymentAmount),
        paypal,
        accountName,
        bankName,
        bankType: bankType as "uk" | "international",
        ...(bankType === "uk" ? { accountNumber: accountNumber!, sortCode: sortCode! } : { iban: iban!, swiftBic: swiftBic! }),
        bankAddress,
      };

      const pdfBuffer = generateGuestInvoicePdf(pdfData);
      invoiceId = crypto.randomUUID();
      const safeGuestName = guestName.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "invoice";
      const pdfPath = `${session.user.id}/${invoiceId}-send-link-invoice.pdf`;

      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(pdfPath, Buffer.from(pdfBuffer), {
        contentType: "application/pdf",
        upsert: false,
      });
      if (uploadErr) {
        return NextResponse.json({ error: "PDF upload failed: " + uploadErr.message }, { status: 500 });
      }

      const serviceDesc = [
        `Guest Name: ${guestName}`,
        `Title: ${title}`,
        `Guest Email: ${email}`,
        `Producer: ${producerName}`,
        `Topic: ${recordingTopic}`,
        `Department Name: ${deptName}`,
        `Programme Name: ${progName}`,
        `Invoice Date: ${invoiceDate}`,
        `TX Date: ${recordingDate}`,
        `Payment Type: paid_guest`,
        `Source: Send invoice link (producer-generated)`,
      ].join("\n");

      const { error: invError } = await supabase.from("invoices").insert({
        id: invoiceId,
        submitter_user_id: session.user.id,
        producer_user_id: session.user.id,
        department_id: departmentId,
        program_id: programId,
        service_description: serviceDesc,
        service_date_from: recordingDate,
        service_date_to: recordingDate,
        currency: paymentCurrency,
        storage_path: pdfPath,
        invoice_type: "guest",
        generated_invoice_data: { appearances },
      });
      if (invError) {
        await supabase.storage.from(BUCKET).remove([pdfPath]);
        return NextResponse.json({ error: "Invoice creation failed: " + invError.message }, { status: 500 });
      }

      await supabase.from("invoice_workflows").insert({
        invoice_id: invoiceId,
        status: "pending_manager",
        manager_user_id: managerUserId,
        pending_manager_since: new Date().toISOString().slice(0, 10),
      });
      await supabase.from("invoice_extracted_fields").insert({
        invoice_id: invoiceId,
        invoice_number: invNo,
        extracted_currency: paymentCurrency,
        needs_review: true,
        manager_confirmed: false,
        raw_json: { source_file_name: `Invoice_${invNo}.pdf` },
      });

      await supabase
        .from("producer_guests")
        .update({
          matched_invoice_id: invoiceId,
          matched_at: now,
          ...(existingGuest && {
            program_name: programName,
            recording_date: recordingDate,
            recording_topic: recordingTopic,
            payment_amount: Math.max(0, paymentAmount),
            payment_currency: paymentCurrencyRaw || null,
          }),
        })
        .eq("id", guestId);

      await sendPostRecordingWithInvoice({
        to: email,
        guestName,
        programName,
        invoiceNumber: invNo,
        pdfBuffer,
        producerName,
      });

      return NextResponse.json({
        success: true,
        message: "Invoice generated and sent to guest.",
      });
    }

    let submitLink: string | undefined;
    try {
      submitLink = existingGuest
        ? await getOrCreateGuestSubmitLink(supabase, guestId, {
            program_name: programName,
            recording_date: recordingDate,
            recording_topic: recordingTopic,
            payment_amount: Math.max(0, paymentAmount),
            payment_currency: paymentCurrencyRaw || undefined,
          })
        : await getOrCreateGuestSubmitLink(supabase, guestId);
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

    if (!generateInvoice) {
      await recordGuestInvoiceLinkSend(supabase, session.user.id);
    }

    return NextResponse.json({
      success: true,
      message: "Invoice submit link sent to guest.",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
