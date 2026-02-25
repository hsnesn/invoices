import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";

const BUCKET = "invoices";
const ALLOWED_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "jpg", "jpeg"];

function safeFileStem(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "file";
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
      .select("id, submitter_user_id, invoice_type")
      .eq("id", invoiceId)
      .single();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if ((invoice as { invoice_type?: string }).invoice_type !== "freelancer") {
      return NextResponse.json({ error: "Add file is only for freelancer invoices" }, { status: 400 });
    }

    const isOwner = invoice.submitter_user_id === session.user.id;
    if (!isOwner && profile.role !== "admin" && profile.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(fileExt)) {
      return NextResponse.json({ error: "Unsupported file type. Allowed: PDF, DOCX, DOC, XLSX, XLS, JPEG" }, { status: 400 });
    }

    const { data: maxOrder } = await supabase
      .from("invoice_files")
      .select("sort_order")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrder?.sort_order ?? -1) + 1;
    const sourceStem = safeFileStem(file.name);
    const storagePath = `${session.user.id}/${invoiceId}-${sourceStem}-${Date.now()}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    const { data: inv } = await supabase.from("invoices").select("storage_path").eq("id", invoiceId).single();
    const isFirstFile = !inv?.storage_path && nextOrder === 0;
    if (isFirstFile) {
      await supabase.from("invoices").update({ storage_path: storagePath }).eq("id", invoiceId);
    }

    await supabase.from("invoice_files").insert({
      invoice_id: invoiceId,
      storage_path: storagePath,
      file_name: file.name,
      sort_order: nextOrder,
    });

    if (isFirstFile) {
      try {
        await runInvoiceExtraction(invoiceId, session.user.id);
      } catch {
        /* non-fatal */
      }
    }

    await createAuditEvent({
      invoice_id: invoiceId,
      actor_user_id: session.user.id,
      event_type: "file_added",
      payload: { storage_path: storagePath, file_name: file.name },
    });

    return NextResponse.json({ success: true, storage_path: storagePath });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
