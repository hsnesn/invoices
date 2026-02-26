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

    const { data: files } = await supabase
      .from("invoice_files")
      .select("id, storage_path, file_name, sort_order")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    if (files && files.length > 0) {
      return NextResponse.json(files.map((f) => ({ storage_path: f.storage_path, file_name: f.file_name })));
    }

    const { data: inv } = await supabase.from("invoices").select("storage_path").eq("id", invoiceId).single();
    if (inv?.storage_path) {
      const name = inv.storage_path.split("/").pop() ?? inv.storage_path;
      return NextResponse.json([{ storage_path: inv.storage_path, file_name: name }]);
    }

    return NextResponse.json([]);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
