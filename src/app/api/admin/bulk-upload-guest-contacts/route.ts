import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";
import { getOrCreateTitleCategory, getOrCreateTopicCategory } from "@/lib/guest-contact-categorize";

export const maxDuration = 120;

const BUCKET = "invoices";
const MAX_FILES = 10;
const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg"];

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
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const supabase = createAdminClient();

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const validFiles = files.filter(
      (f) => f && f instanceof File && f.size > 0 && ALLOWED_EXT.includes((f.name.split(".").pop() ?? "").toLowerCase())
    );

    if (validFiles.length === 0) {
      return NextResponse.json({ error: "No valid files. Supported: PDF, DOCX, DOC, XLSX, XLS, JPEG" }, { status: 400 });
    }
    if (validFiles.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files per upload` }, { status: 400 });
    }

    const results: { file: string; guest_name: string | null; status: "ok" | "skip" | "error"; message?: string }[] = [];
    let contactsAdded = 0;

    for (const file of validFiles) {
      const fileName = file.name;
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "pdf";
      const invoiceId = crypto.randomUUID();
      const sourceStem = safeFileStem(fileName);
      const storagePath = `${session.user.id}/contact-scan/${invoiceId}-${sourceStem}.${ext}`;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type || "application/octet-stream";

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

        if (uploadError) {
          results.push({ file: fileName, guest_name: null, status: "error", message: uploadError.message });
          continue;
        }

        const { error: invError } = await supabase.from("invoices").insert({
          id: invoiceId,
          submitter_user_id: session.user.id,
          storage_path: storagePath,
          invoice_type: "guest_contact_scan",
        });

        if (invError) {
          await supabase.storage.from(BUCKET).remove([storagePath]);
          results.push({ file: fileName, guest_name: null, status: "error", message: invError.message });
          continue;
        }

        const { error: wfError } = await supabase.from("invoice_workflows").insert({
          invoice_id: invoiceId,
          status: "archived",
          manager_user_id: session.user.id,
        });

        if (wfError) {
          await supabase.from("invoices").delete().eq("id", invoiceId);
          await supabase.storage.from(BUCKET).remove([storagePath]);
          results.push({ file: fileName, guest_name: null, status: "error", message: wfError.message });
          continue;
        }

        await supabase.from("invoice_extracted_fields").upsert(
          {
            invoice_id: invoiceId,
            raw_json: { source_file_name: fileName },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "invoice_id" }
        );

        try {
          await runInvoiceExtraction(invoiceId, session.user.id);
        } catch {
          // Continue even if extraction fails - we may get regex results
        }

        const { data: ext } = await supabase
          .from("invoice_extracted_fields")
          .select("raw_json")
          .eq("invoice_id", invoiceId)
          .single();

        const raw = (ext?.raw_json as Record<string, unknown>) ?? {};
        const guestName =
          (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name.trim() : null) || null;
        const phone = (typeof raw.guest_phone === "string" ? raw.guest_phone.trim() : null) || null;
        const email = (typeof raw.guest_email === "string" ? raw.guest_email.trim() : null) || null;
        const title = (typeof raw.title === "string" ? raw.title.trim() : null) || null;
        const topic =
          (typeof raw.topic === "string" ? raw.topic.trim() : null) ||
          (typeof raw.description === "string" ? raw.description.trim() : null) ||
          (typeof raw.service_description === "string" ? raw.service_description.trim() : null) ||
          null;

        await supabase.storage.from(BUCKET).remove([storagePath]);
        await supabase.from("invoices").delete().eq("id", invoiceId);

        if (!guestName) {
          results.push({ file: fileName, guest_name: null, status: "skip", message: "No guest name found" });
          continue;
        }

        const key = guestName.toLowerCase().trim();
        const { data: existing } = await supabase
          .from("guest_contacts")
          .select("id, phone, email, title, topic")
          .eq("guest_name_key", key)
          .maybeSingle();

        const rawTitle = title || (existing?.title as string) || null;
        const rawTopic = topic || (existing?.topic as string) || null;
        const [titleCategory, topicCategory] = await Promise.all([
          rawTitle ? getOrCreateTitleCategory(rawTitle) : Promise.resolve(null),
          rawTopic ? getOrCreateTopicCategory(rawTopic) : Promise.resolve(null),
        ]);

        const merged = {
          guest_name: guestName,
          phone: phone || (existing?.phone as string) || null,
          email: email || (existing?.email as string) || null,
          title: rawTitle,
          topic: rawTopic,
          title_category: titleCategory,
          topic_category: topicCategory,
          source: "bulk_upload",
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          await supabase.from("guest_contacts").update(merged).eq("id", existing.id);
        } else {
          await supabase.from("guest_contacts").insert(merged);
        }

        contactsAdded++;
        results.push({ file: fileName, guest_name: guestName, status: "ok" });
      } catch (e) {
        results.push({
          file: fileName,
          guest_name: null,
          status: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      total: validFiles.length,
      contactsAdded,
      results,
      message: `Processed ${validFiles.length} files. ${contactsAdded} contacts added or updated.`,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
