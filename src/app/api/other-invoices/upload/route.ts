/**
 * Bulk upload for "other" invoices. Any file type (PDF, DOCX, XLSX, etc.).
 * AI extracts all info. Status starts as ready_for_payment.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditEvent } from "@/lib/audit";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";

const BUCKET = "invoices";
const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg"];
const MAX_FILES = 20;
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

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit(request);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "finance" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const files: File[] = [];
    const allFiles = formData.getAll("file") as (File | string)[];
    for (const f of allFiles) {
      if (f instanceof File && f.size > 0) files.push(f);
    }
    for (let i = 0; i < MAX_FILES; i++) {
      const f = formData.get(`file_${i}`) as File | null;
      if (f && f.size > 0) files.push(f);
    }
    const singleFile = formData.get("file") as File | null;
    if (singleFile && singleFile.size > 0 && !files.some((x) => x === singleFile)) files.push(singleFile);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files. Select one or more files to upload." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const results: { id: string; fileName: string; error?: string }[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXT.includes(ext)) {
        results.push({ id: "", fileName: file.name, error: `Unsupported: ${ext}` });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        results.push({ id: "", fileName: file.name, error: `File too large. Max ${MAX_FILE_SIZE / (1024 * 1024)} MB.` });
        continue;
      }

      const invoiceId = crypto.randomUUID();
      const storagePath = `${session.user.id}/other-${invoiceId}-${safeStem(file.name)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: invError } = await supabase.from("invoices").insert({
        id: invoiceId,
        submitter_user_id: session.user.id,
        department_id: null,
        program_id: null,
        service_description: `Other invoice: ${file.name}`,
        currency: "GBP",
        storage_path: storagePath,
        invoice_type: "other",
      });

      if (invError) {
        results.push({ id: "", fileName: file.name, error: invError.message });
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        await supabase.from("invoices").delete().eq("id", invoiceId);
        results.push({ id: "", fileName: file.name, error: uploadError.message });
        continue;
      }

      await supabase.from("invoice_workflows").insert({
        invoice_id: invoiceId,
        status: "ready_for_payment",
        manager_user_id: null,
      });

      await supabase.from("invoice_files").insert({
        invoice_id: invoiceId,
        storage_path: storagePath,
        file_name: file.name,
        sort_order: 0,
      });

      await supabase.from("invoice_extracted_fields").upsert(
        {
          invoice_id: invoiceId,
          invoice_number: file.name.replace(/\.[^.]+$/, ""),
          needs_review: true,
          manager_confirmed: true,
          raw_json: { source_file: file.name },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "invoice_id" }
      );

      try {
        await runInvoiceExtraction(invoiceId, session.user.id);
      } catch {
        // Keep invoice even if extraction fails
      }

      await createAuditEvent({
        invoice_id: invoiceId,
        actor_user_id: session.user.id,
        event_type: "invoice_submitted",
        from_status: null,
        to_status: "ready_for_payment",
        payload: { source: "other_upload", storage_path: storagePath, file_name: file.name },
      });

      results.push({ id: invoiceId, fileName: file.name });
    }

    return NextResponse.json({ results });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
