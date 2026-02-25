import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

const BUCKET = "invoices";

async function canAccessInvoice(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  userId: string,
  overrideProfile?: { role: string; department_id: string | null; program_ids: string[] | null }
): Promise<boolean> {
  const profile = overrideProfile ?? await (async () => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("role, department_id, program_ids")
      .eq("id", userId)
      .eq("is_active", true)
      .single();
    return data;
  })();

  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "operations") return true;

  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("submitter_user_id, department_id, program_id")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return false;
  if (invoice.submitter_user_id === userId) return true;

  const { data: wf } = await supabaseAdmin
    .from("invoice_workflows")
    .select("manager_user_id, status")
    .eq("invoice_id", invoiceId)
    .single();

  if (profile.role === "manager") {
    return wf?.manager_user_id === userId;
  }

  if (profile.role === "finance") {
    return wf?.status
      ? ["ready_for_payment", "paid", "archived"].includes(wf.status)
      : false;
  }

  const { data: or } = await supabaseAdmin.from("operations_room_members").select("id").eq("user_id", userId).single();
  if (or) return true;

  return false;
}

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
      { role: profile.role, department_id: profile.department_id, program_ids: profile.program_ids }
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

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
