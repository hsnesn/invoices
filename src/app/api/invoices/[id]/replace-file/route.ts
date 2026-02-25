import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";

const BUCKET = "invoices";

const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls"];

function safeFileStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "invoice";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, storage_path, submitter_user_id")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const isOwner = invoice.submitter_user_id === session.user.id;
    if (!isOwner && profile.role !== "admin" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(fileExt)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PDF, DOCX, DOC, XLSX, XLS" },
        { status: 400 }
      );
    }

    if (invoice.storage_path) {
      await supabase.storage.from(BUCKET).remove([invoice.storage_path]);
    }

    const sourceStem = safeFileStem(file.name);
    const storagePath = `${session.user.id}/${invoiceId}-${sourceStem}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      const msg = uploadError.message;
      const hint = msg.includes("fetch") || msg.includes("network")
        ? "Cannot connect to Supabase Storage. Check Supabase URL and bucket settings."
        : "";
      return NextResponse.json(
        { error: "Upload failed: " + msg + hint },
        { status: 500 }
      );
    }

    await supabase
      .from("invoices")
      .update({ storage_path: storagePath })
      .eq("id", invoiceId);

    await supabase.from("invoice_extracted_fields").upsert(
      {
        invoice_id: invoiceId,
        invoice_number: file.name.replace(/\.[^.]+$/, ""),
        needs_review: true,
        manager_confirmed: false,
        raw_json: { source_file_name: file.name },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "invoice_id" }
    );

    try {
      await runInvoiceExtraction(invoiceId, session.user.id);
    } catch {
      // extraction failure is non-fatal
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "file_replaced",
      payload: { new_storage_path: storagePath, file_name: file.name },
    });

    return NextResponse.json({ success: true, storage_path: storagePath });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
