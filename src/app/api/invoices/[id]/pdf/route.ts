import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";

const BUCKET = "invoices";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireAuth();
    const { id: invoiceId } = await params;
    const pathParam = request.nextUrl.searchParams.get("path"); // optional: specific file path when multiple files

    const supabaseAdmin = createAdminClient();
    let storagePath: string | null = pathParam;

    if (!storagePath) {
      const { data: files } = await supabaseAdmin
        .from("invoice_files")
        .select("storage_path")
        .eq("invoice_id", invoiceId)
        .order("sort_order", { ascending: true })
        .limit(1);
      if (files?.[0]) storagePath = files[0].storage_path;
    }
    if (!storagePath) {
      const { data: invoice } = await supabaseAdmin.from("invoices").select("storage_path").eq("id", invoiceId).single();
      storagePath = invoice?.storage_path ?? null;
    }

    if (!storagePath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { profile } = await requireAuth();
    const allowed = await canAccessInvoice(
      supabaseAdmin,
      invoiceId,
      session.user.id,
      { role: profile.role, department_id: profile.department_id, program_ids: profile.program_ids, full_name: profile.full_name ?? null, allowed_pages: profile.allowed_pages ?? undefined }
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600); // 1 hour

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate URL" },
        { status: 500 }
      );
    }

    // When redirect=1, serve PDF inline so browser displays it (not download)
    if (request.nextUrl.searchParams.get("redirect") === "1") {
      const pdfRes = await fetch(data.signedUrl);
      if (!pdfRes.ok) {
        return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
      }
      const blob = await pdfRes.arrayBuffer();
      return new NextResponse(blob, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "inline; filename=invoice.pdf",
        },
      });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
