/**
 * Update or delete producer guest / guest invitation.
 * Delete only removes from producer_guests or guest_invitations; guest_contacts (contact list) is never touched.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await params;
    const supabase = createAdminClient();

    const isAdmin = profile.role === "admin";

    // Try producer_guests first
    let query = supabase.from("producer_guests").select("id").eq("id", id);
    if (!isAdmin) query = query.eq("producer_user_id", session.user.id);
    const { data: pgRow } = await query.single();
    if (pgRow) {
      const { error } = await supabase.from("producer_guests").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // Try guest_invitations (from Guest Contacts bulk email)
    let invQuery = supabase.from("guest_invitations").select("id, producer_user_id").eq("id", id);
    if (!isAdmin) {
      invQuery = invQuery.or(`producer_user_id.eq.${session.user.id},producer_user_id.is.null`);
    }
    const { data: invRow } = await invQuery.single();
    if (invRow) {
      const { error } = await supabase.from("guest_invitations").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await params;
    const supabase = createAdminClient();

    const body = (await request.json()) as {
      accepted?: boolean | null;
      email?: string | null;
      title?: string | null;
      program_name?: string | null;
      notes?: string | null;
      is_favorite?: boolean | null;
    };

    const isAdmin = profile.role === "admin";
    let query = supabase.from("producer_guests").select("producer_user_id").eq("id", id);
    if (!isAdmin) {
      query = query.eq("producer_user_id", session.user.id);
    }
    const { data: existing, error: fetchErr } = await query.single();
    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.accepted !== undefined) updates.accepted = body.accepted;
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.title !== undefined) updates.title = body.title?.trim() || null;
    if (body.program_name !== undefined) updates.program_name = body.program_name?.trim() || null;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    if (body.is_favorite !== undefined) updates.is_favorite = body.is_favorite;

    const { data, error } = await supabase
      .from("producer_guests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
