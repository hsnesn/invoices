import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const allowed = await canAccessInvoice(supabase, invoiceId, session.user.id, {
      role: profile.role,
      department_id: profile.department_id,
      program_ids: profile.program_ids,
      full_name: profile.full_name ?? null,
    });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: inv } = await supabase.from("invoices").select("storage_path").eq("id", invoiceId).single();
    const { data: files } = await supabase
      .from("invoice_files")
      .select("id, storage_path, file_name, sort_order")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    const mainPath = inv?.storage_path ?? null;
    const mainName = mainPath ? mainPath.split("/").pop() ?? "invoice.pdf" : null;

    if (files && files.length > 0) {
      const hasMain = mainPath && files.some((f) => f.storage_path === mainPath);
      const list = files.map((f) => ({ storage_path: f.storage_path, file_name: f.file_name }));
      // Ensure main invoice (Invoice File) is first when it exists but was missing from invoice_files
      if (mainPath && !hasMain) {
        return NextResponse.json([{ storage_path: mainPath, file_name: mainName ?? "invoice.pdf" }, ...list]);
      }
      return NextResponse.json(list);
    }

    if (mainPath) {
      return NextResponse.json([{ storage_path: mainPath, file_name: mainName ?? "invoice.pdf" }]);
    }

    return NextResponse.json([]);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
