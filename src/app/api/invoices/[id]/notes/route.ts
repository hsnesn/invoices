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

    const { data: notes } = await supabase
      .from("invoice_notes")
      .select("id, content, author_user_id, created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    const authorIds = Array.from(new Set((notes ?? []).map((n) => n.author_user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds.length > 0 ? authorIds : ["_"]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.id]));

    return NextResponse.json(
      (notes ?? []).map((n) => ({
        ...n,
        author_name: profileMap.get(n.author_user_id) ?? n.author_user_id,
      }))
    );
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireAuth();
    const { id: invoiceId } = await params;
    const { content } = (await request.json()) as { content: string };

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const allowed = await canAccess(supabase, invoiceId, session.user.id);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("invoice_notes")
      .insert({
        invoice_id: invoiceId,
        author_user_id: session.user.id,
        content: content.trim(),
      })
      .select("id, content, author_user_id, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .single();

    return NextResponse.json({
      ...data,
      author_name: prof?.full_name || session.user.id,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
