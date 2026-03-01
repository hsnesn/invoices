/**
 * Resend inbound email webhook.
 * When emails are forwarded to invoices@quaifla.resend.app (or invoices@invoices.clari.uk),
 * Resend sends email.received events. We download PDF/DOCX/XLSX attachments and create Other Invoices.
 */
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuditEvent } from "@/lib/audit";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";

const BUCKET = "invoices";
const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function safeStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "invoice";
}

async function getSubmitterUserId(): Promise<string> {
  const envUserId = process.env.RESEND_INBOUND_SUBMITTER_USER_ID;
  if (envUserId) return envUserId;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "finance", "operations"])
    .limit(1)
    .single();

  if (data?.id) return data.id;
  throw new Error("No admin/finance/operations user found. Set RESEND_INBOUND_SUBMITTER_USER_ID.");
}

async function createOtherInvoiceFromBuffer(
  buffer: Buffer,
  fileName: string,
  submitterUserId: string
): Promise<{ id: string } | { error: string }> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) {
    return { error: `Unsupported: ${ext}` };
  }
  if (buffer.length > MAX_FILE_SIZE) {
    return { error: `File too large. Max ${MAX_FILE_SIZE / (1024 * 1024)} MB.` };
  }

  const supabase = createAdminClient();
  const invoiceId = crypto.randomUUID();
  const storagePath = `${submitterUserId}/other-${invoiceId}-${safeStem(fileName)}.${ext}`;

  const { error: invError } = await supabase.from("invoices").insert({
    id: invoiceId,
    submitter_user_id: submitterUserId,
    department_id: null,
    program_id: null,
    service_description: `Other invoice: ${fileName} (from email)`,
    currency: "GBP",
    storage_path: storagePath,
    invoice_type: "other",
  });

  if (invError) return { error: invError.message };

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    await supabase.from("invoices").delete().eq("id", invoiceId);
    return { error: uploadError.message };
  }

  await supabase.from("invoice_workflows").insert({
    invoice_id: invoiceId,
    status: "ready_for_payment",
    manager_user_id: null,
  });

  await supabase.from("invoice_files").insert({
    invoice_id: invoiceId,
    storage_path: storagePath,
    file_name: fileName,
    sort_order: 0,
  });

  await supabase.from("invoice_extracted_fields").upsert(
    {
      invoice_id: invoiceId,
      invoice_number: fileName.replace(/\.[^.]+$/, ""),
      needs_review: true,
      manager_confirmed: true,
      raw_json: { source: "resend_inbound", source_file: fileName },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "invoice_id" }
  );

  try {
    await runInvoiceExtraction(invoiceId, submitterUserId);
  } catch {
    // Keep invoice even if extraction fails
  }

  await createAuditEvent({
    invoice_id: invoiceId,
    actor_user_id: submitterUserId,
    event_type: "invoice_submitted",
    from_status: null,
    to_status: "ready_for_payment",
    payload: { source: "resend_inbound", storage_path: storagePath, file_name: fileName },
  });

  return { id: invoiceId };
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Resend inbound] RESEND_WEBHOOK_SECRET not set");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const payload = await request.text();
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
    }

    let event: { type: string; data?: { email_id?: string; attachments?: { id: string; filename?: string }[] } };
    try {
      const wh = new Webhook(secret);
      event = wh.verify(payload, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as typeof event;
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    if (event.type !== "email.received") {
      return NextResponse.json({ received: true });
    }

    const emailId = event.data?.email_id;
    if (!emailId) {
      return NextResponse.json({ error: "Missing email_id" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
    }

    const attachmentsRes = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}/attachments`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!attachmentsRes.ok) {
      console.error("[Resend inbound] Attachments API error:", attachmentsRes.status, await attachmentsRes.text());
      return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 502 });
    }

    const attachmentsData = (await attachmentsRes.json()) as {
      data?: { id: string; filename?: string; download_url?: string; size?: number }[];
    };
    const attachments = attachmentsData.data ?? [];

    const submitterUserId = await getSubmitterUserId();
    const results: { fileName: string; invoiceId?: string; error?: string }[] = [];

    for (const att of attachments) {
      const filename = att.filename ?? `attachment-${att.id}`;
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXT.includes(ext)) {
        results.push({ fileName: filename, error: `Skipped: unsupported type ${ext}` });
        continue;
      }

      let downloadUrl = att.download_url;
      if (!downloadUrl) {
        const getRes = await fetch(
          `https://api.resend.com/emails/receiving/${emailId}/attachments/${att.id}`,
          { headers: { Authorization: `Bearer ${apiKey}` } }
        );
        if (!getRes.ok) {
          results.push({ fileName: filename, error: "Failed to get download URL" });
          continue;
        }
        const getData = (await getRes.json()) as { download_url?: string };
        downloadUrl = getData.download_url;
      }

      if (!downloadUrl) {
        results.push({ fileName: filename, error: "No download URL" });
        continue;
      }

      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        results.push({ fileName: filename, error: "Failed to download file" });
        continue;
      }

      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const result = await createOtherInvoiceFromBuffer(buffer, filename, submitterUserId);

      if ("id" in result) {
        results.push({ fileName: filename, invoiceId: result.id });
      } else {
        results.push({ fileName: filename, error: result.error });
      }
    }

    return NextResponse.json({
      received: true,
      email_id: emailId,
      processed: results.filter((r) => r.invoiceId).length,
      results,
    });
  } catch (e) {
    console.error("[Resend inbound] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
