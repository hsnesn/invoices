/**
 * Vendor: update or delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.contact_person !== undefined) updates.contact_person = body.contact_person ? String(body.contact_person).trim() : null;
    if (body.email !== undefined) updates.email = body.email ? String(body.email).trim() : null;
    if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).trim() : null;
    if (body.address !== undefined) updates.address = body.address ? String(body.address).trim() : null;
    if (body.payment_terms !== undefined) updates.payment_terms = body.payment_terms ? String(body.payment_terms).trim() : null;
    if (body.contract_end_date !== undefined) updates.contract_end_date = body.contract_end_date && /^\d{4}-\d{2}-\d{2}$/.test(body.contract_end_date) ? body.contract_end_date : null;
    if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes).trim() : null;
    if (body.is_preferred !== undefined) updates.is_preferred = !!body.is_preferred;

    const supabase = createAdminClient();
    const { error } = await supabase.from("vendors").update(updates).eq("id", id);
    if (error) throw error;
    const { data } = await supabase.from("vendors").select("*").eq("id", id).single();
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const supabase = createAdminClient();
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
