/**
 * Guest generates invoice via submit link (no upload). Uses producer-filled data.
 * Public endpoint - no auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSubmissionEmail } from "@/lib/email";
import { buildGuestEmailDetails } from "@/lib/guest-email-details";
import { isEmailStageEnabled, isRecipientEnabled, getFilteredEmailsForUserIds } from "@/lib/email-settings";
import { createAuditEvent } from "@/lib/audit";
import { pickManagerForGuestInvoice } from "@/lib/manager-assignment";
import { runGuestContactSearch } from "@/lib/guest-contact-search";
import { generateGuestInvoicePdf, type GuestInvoiceAppearance } from "@/lib/guest-invoice-pdf";

const BUCKET = "invoices";
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

    const body = await request.json();
    const token = (body.token as string)?.trim();
    const accountName = (body.account_name as string)?.trim();
    const accountNumber = (body.account_number as string)?.trim();
    const sortCode = (body.sort_code as string)?.trim();
    const bankName = (body.bank_name as string)?.trim() || undefined;
    const bankAddress = (body.bank_address as string)?.trim() || undefined;
    const paypal = (body.paypal as string)?.trim() || undefined;

    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }
    if (!accountName || !accountNumber || !sortCode) {
      return NextResponse.json({ error: "Account name, account number and sort code are required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("guest_invoice_submit_tokens")
      .select("id, producer_guest_id, expires_at, used_at")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Link not found or expired" }, { status: 404 });
    }

    const t = tokenRow as { id: string; producer_guest_id: string; expires_at: string; used_at: string | null };
    if (t.used_at) {
      return NextResponse.json({ error: "This link has already been used" }, { status: 410 });
    }
    if (new Date(t.expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 });
    }

    const { data: guest, error: guestErr } = await supabase
      .from("producer_guests")
      .select("id, guest_name, email, title, program_name, recording_date, recording_topic, payment_amount, payment_currency, producer_user_id")
      .eq("id", t.producer_guest_id)
      .single();

    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const g = guest as {
      guest_name: string;
      email: string | null;
      title: string | null;
      program_name: string | null;
      recording_date: string | null;
      recording_topic: string | null;
      payment_amount: number | null;
      payment_currency: string | null;
      producer_user_id: string;
    };

    const amount = Math.max(0, g.payment_amount ?? 0);
    const currency = ((g.payment_currency as "GBP" | "EUR" | "USD") ?? "GBP");
    const recordingDate = g.recording_date || new Date().toISOString().slice(0, 10);
    const recordingTopic = g.recording_topic || "the programme";

    let deptId: string | null = null;
    let progId: string | null = null;
    if (g.program_name?.trim()) {
      const { data: programs } = await supabase.from("programs").select("id, name, department_id");
      const match = (programs ?? []).find((p) => (p.name ?? "").toLowerCase() === g.program_name!.toLowerCase());
      if (match) {
        progId = match.id;
        deptId = match.department_id;
      }
    }

    if (!deptId || !progId) {
      return NextResponse.json({ error: "Could not resolve program. Please contact the producer." }, { status: 400 });
    }

    const managerUserId = await pickManagerForGuestInvoice(supabase, deptId, progId);
    const submitterUserId = g.producer_user_id;

    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", submitterUserId)
      .single();
    const producerName = producerProfile?.full_name?.trim() || "The Producer";

    const { data: prog } = await supabase.from("programs").select("name").eq("id", progId).single();
    const progName = prog?.name ?? g.program_name ?? "";

    const invNo = `GUEST-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const invoiceDate = new Date().toISOString().slice(0, 10);

    const appearances: GuestInvoiceAppearance[] = [{
      programmeName: progName,
      topic: recordingTopic,
      date: recordingDate,
      amount,
    }];

    const pdfData = {
      invNo,
      invoiceDate,
      currency,
      guestName: g.guest_name,
      guestEmail: g.email ?? undefined,
      appearances,
      expenses: [],
      totalAmount: amount,
      paypal,
      accountName,
      bankName,
      accountNumber,
      sortCode,
      bankAddress,
    };

    const pdfBuffer = generateGuestInvoicePdf(pdfData);
    const invoiceId = crypto.randomUUID();
    const pdfPath = `guest-submit/${t.id}/${invoiceId}-generated.pdf`;

    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(pdfPath, Buffer.from(pdfBuffer), {
      contentType: "application/pdf",
      upsert: false,
    });
    if (uploadErr) {
      return NextResponse.json({ error: "Failed to create invoice: " + uploadErr.message }, { status: 500 });
    }

    const serviceDesc = [
      `Guest Name: ${g.guest_name}`,
      `Title: ${g.title ?? ""}`,
      `Guest Email: ${g.email ?? ""}`,
      `Producer: ${producerName}`,
      `Topic: ${recordingTopic}`,
      `Programme Name: ${progName}`,
      `Invoice Date: ${invoiceDate}`,
      `TX Date: ${recordingDate}`,
      `Payment Type: paid_guest`,
      `Source: Guest-generated via submit link`,
    ].join("\n");

    const { error: invError } = await supabase.from("invoices").insert({
      id: invoiceId,
      submitter_user_id: submitterUserId,
      producer_user_id: submitterUserId,
      department_id: deptId,
      program_id: progId,
      service_description: serviceDesc,
      service_date_from: recordingDate,
      service_date_to: recordingDate,
      currency,
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
      pending_manager_since: invoiceDate,
    });
    await supabase.from("invoice_extracted_fields").insert({
      invoice_id: invoiceId,
      invoice_number: invNo,
      extracted_currency: currency,
      needs_review: true,
      manager_confirmed: false,
      raw_json: { source: "guest_generated", guest_name: g.guest_name },
    });

    await supabase
      .from("guest_invoice_submit_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", t.id);

    await supabase
      .from("producer_guests")
      .update({ matched_invoice_id: invoiceId, matched_at: new Date().toISOString() })
      .eq("id", t.producer_guest_id);

    if (g.guest_name && g.guest_name.length >= 2) {
      runGuestContactSearch(g.guest_name).catch(() => {});
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: submitterUserId,
      event_type: "invoice_submitted",
      from_status: null,
      to_status: "pending_manager",
      payload: { source: "guest_generate_link", storage_path: pdfPath, producer_guest_id: t.producer_guest_id },
    });

    const enabled = await isEmailStageEnabled("submission");
    if (enabled && g.email) {
      const [sendSubmitter, sendDeptEp] = await Promise.all([
        isRecipientEnabled("submission", "submitter"),
        isRecipientEnabled("submission", "dept_ep"),
      ]);
      const managerEmails: string[] = [];
      if (sendDeptEp && managerUserId) {
        const filtered = await getFilteredEmailsForUserIds([managerUserId]);
        if (filtered.length > 0) managerEmails.push(filtered[0]);
      }
      const submitterEmails = sendSubmitter ? await getFilteredEmailsForUserIds([submitterUserId]) : [];
      const submitterEmail = submitterEmails[0];
      if (submitterEmail || managerEmails.length > 0) {
        const deptName = deptId ? ((await supabase.from("departments").select("name").eq("id", deptId).single()).data?.name ?? "—") : "—";
        const guestDetails = buildGuestEmailDetails(serviceDesc, deptName, progName, { invoice_number: invNo, gross_amount: amount });
        await sendSubmissionEmail({
          submitterEmail: submitterEmail ?? "",
          managerEmails,
          invoiceId,
          invoiceNumber: invNo,
          guestName: g.guest_name,
          guestDetails,
        });
      }
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoiceId,
      message: "Invoice generated successfully. Thank you!",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
