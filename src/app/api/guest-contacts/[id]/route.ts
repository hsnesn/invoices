import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const body = (await request.json()) as {
      guest_name?: string;
      phone?: string | null;
      email?: string | null;
      title?: string | null;
      is_favorite?: boolean;
      tags?: string[];
    };

    const supabase = createAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.guest_name !== undefined) updates.guest_name = body.guest_name.trim() || null;
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.title !== undefined) updates.title = body.title?.trim() || null;
    if (body.is_favorite !== undefined) updates.is_favorite = body.is_favorite;
    if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];

    const { data, error } = await supabase
      .from("guest_contacts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("guest_contacts").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
