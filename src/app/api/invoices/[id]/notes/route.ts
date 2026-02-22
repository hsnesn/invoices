import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: invoiceId } = await params;
    const supabase = createAdminClient();

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
