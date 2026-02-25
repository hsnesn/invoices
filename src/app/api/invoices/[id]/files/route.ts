import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

async function canAccess(supabase: ReturnType<typeof createAdminClient>, invoiceId: string, userId: string): Promise<boolean> {
  const { data: inv } = await supabase.from("invoices").select("submitter_user_id, department_id, program_id").eq("id", invoiceId).single();
  if (!inv) return false;
  const { data: profile } = await supabase.from("profiles").select("role, department_id, program_ids").eq("id", userId).eq("is_active", true).single();
  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "operations") return true;
  if (inv.submitter_user_id === userId) return true;
  const { data: wf } = await supabase.from("invoice_workflows").select("manager_user_id, status").eq("invoice_id", invoiceId).single();
  if (profile.role === "manager" && (wf?.manager_user_id === userId || (profile.department_id && inv.department_id === profile.department_id))) return true;
  if (profile.role === "finance" && wf?.status && ["ready_for_payment", "paid", "archived"].includes(wf.status)) return true;
  const { data: or } = await supabase.from("operations_room_members").select("id").eq("user_id", userId).single();
  if (or) return true;
  return false;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

    const allowed = await canAccess(supabase, invoiceId, session.user.id);
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
