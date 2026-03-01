/**
 * Guest invoice upload via submit link (token). No auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSubmissionEmail } from "@/lib/email";
import { buildGuestEmailDetails } from "@/lib/guest-email-details";
import { isEmailStageEnabled, isRecipientEnabled, getFilteredEmailsForUserIds } from "@/lib/email-settings";
import { createAuditEvent } from "@/lib/audit";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";
import { pickManagerForGuestInvoice } from "@/lib/manager-assignment";
import { runGuestContactSearch } from "@/lib/guest-contact-search";
import { sendGuestSubmissionConfirmation } from "@/lib/post-recording-emails";
import { batchGetUserEmails } from "@/lib/email-settings";

const BUCKET = "invoices";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeFileStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "invoice";
}

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined }
      );
    }

    const formData = await request.formData();
    const token = formData.get("token") as string | null;
    const file = formData.get("file") as File | null;
    const currency = (formData.get("currency") as string) || "GBP";

    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    const ALLOWED_MIME: Record<string, string> = {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "application/vnd.ms-excel": "xls",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
    };
    const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg"];
    const fileExtFromName = file?.name?.split(".").pop()?.toLowerCase() ?? "";

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (!file || (!ALLOWED_MIME[file.type] && !ALLOWED_EXT.includes(fileExtFromName))) {
      return NextResponse.json(
        { error: "Invalid or missing file. Supported: PDF, DOCX, DOC, XLSX, XLS, JPEG" },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.` },
        { status: 413 }
      );
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
      .select("id, guest_name, email, program_name, recording_date, recording_topic, producer_user_id")
      .eq("id", t.producer_guest_id)
      .single();

    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const g = guest as { guest_name: string; email: string | null; program_name: string | null; recording_date: string | null; recording_topic: string | null; producer_user_id: string };
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

    const managerUserId = await pickManagerForGuestInvoice(supabase, deptId, progId);
    const submitterUserId = g.producer_user_id;

    const service_description = [
      `Guest: ${g.guest_name}`,
      g.program_name ? `Program: ${g.program_name}` : null,
      g.recording_date ? `Recording date: ${g.recording_date}` : null,
      g.recording_topic ? `Topic: ${g.recording_topic}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const invoiceId = crypto.randomUUID();
    const ext = file.name.split(".").pop() ?? "pdf";
    const sourceStem = safeFileStem(file.name);
    const storagePath = `guest-submit/${t.id}/${invoiceId}-${sourceStem}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    const seedInvNumber = file.name.replace(/\.[^.]+$/, "");
    const { error: txError } = await supabase.rpc("create_invoice_with_workflow", {
      p_id: invoiceId,
      p_submitter: submitterUserId,
      p_dept: deptId,
      p_prog: progId,
      p_desc: service_description,
      p_date_from: g.recording_date ?? "",
      p_date_to: g.recording_date ?? "",
      p_currency: currency,
      p_path: storagePath,
      p_type: "guest",
      p_manager: managerUserId,
      p_filename: seedInvNumber,
      p_currency_extracted: currency,
    });

    if (txError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: "Invoice creation failed: " + txError.message },
        { status: 500 }
      );
    }

    const { error: usedErr } = await supabase
      .from("guest_invoice_submit_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    if (usedErr) {
      console.error("[Guest invoice upload] Failed to mark token as used:", usedErr);
      return NextResponse.json({ error: "Failed to complete submission. Please contact the producer." }, { status: 500 });
    }

    await supabase
      .from("producer_guests")
      .update({ matched_invoice_id: invoiceId, matched_at: new Date().toISOString() })
      .eq("id", t.producer_guest_id);

    try {
      await runInvoiceExtraction(invoiceId, submitterUserId);
    } catch {
      // Keep upload successful even if extraction fails
    }

    if (g.guest_name && g.guest_name.length >= 2) {
      runGuestContactSearch(g.guest_name).catch(() => {});
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: submitterUserId,
      event_type: "invoice_submitted",
      from_status: null,
      to_status: "pending_manager",
      payload: { source: "guest_submit_link", storage_path: storagePath, producer_guest_id: t.producer_guest_id },
    });

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const statusToken = crypto.randomUUID();
    const { error: statusTokenErr } = await supabase.from("guest_invoice_status_tokens").insert({
      invoice_id: invoiceId,
      token: statusToken,
      guest_email: g.email || null,
      guest_name: g.guest_name,
      program_name: g.program_name || null,
    });

    if (statusTokenErr) {
      console.error("[Guest upload] Status token insert failed:", statusTokenErr);
      return NextResponse.json(
        { error: "Could not create status link. Please contact support. (Migration 00102 may need to be applied.)" },
        { status: 500 }
      );
    }

    if (g.email?.includes("@")) {
      const submittedEnabled = await isEmailStageEnabled("guest_invoice_submitted");
      const sendToGuest = await isRecipientEnabled("guest_invoice_submitted", "guest");
      if (submittedEnabled && sendToGuest) {
        const { data: producerProfile } = await supabase.from("profiles").select("full_name").eq("id", g.producer_user_id).single();
        const producerName = producerProfile?.full_name?.trim() || "The Producer";
        const progName = g.program_name?.trim() || "the programme";
        const statusLink = `${APP_URL}/submit/status/${statusToken}`;
        try {
          await sendGuestSubmissionConfirmation({
            to: g.email,
            guestName: g.guest_name,
            programName: progName,
            invoiceNumber: seedInvNumber || invoiceId.slice(0, 8),
            statusLink,
            producerName,
          });
        } catch (emErr) {
          console.error("[Guest upload] Confirmation email failed:", emErr);
        }
      }
    }

    const enabled = await isEmailStageEnabled("submission");
    if (enabled) {
      const sendSubmitter = await isRecipientEnabled("submission", "submitter");
      const submitterEmails = sendSubmitter ? await getFilteredEmailsForUserIds([submitterUserId]) : [];
      const submitterEmail = submitterEmails[0];
      if (submitterEmail) {
        const deptName = deptId ? ((await supabase.from("departments").select("name").eq("id", deptId).single()).data?.name ?? "—") : "—";
        const progName = progId ? ((await supabase.from("programs").select("name").eq("id", progId).single()).data?.name ?? "—") : "—";
        const guestDetails = buildGuestEmailDetails(service_description, deptName, progName, { invoice_number: seedInvNumber || null, gross_amount: null });
        await sendSubmissionEmail({
          submitterEmail,
          managerEmails: [],
          invoiceId,
          invoiceNumber: seedInvNumber || undefined,
          guestName: g.guest_name,
          guestDetails,
        });
      }
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoiceId,
      status_token: statusToken,
      invoice_number: seedInvNumber || invoiceId.slice(0, 8),
      message: "Invoice submitted successfully. Thank you!",
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
