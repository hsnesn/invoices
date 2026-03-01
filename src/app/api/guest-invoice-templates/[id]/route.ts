import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

async function getTemplateAndVerify(id: string, userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guest_invoice_templates")
    .select("*")
    .eq("id", id)
    .eq("creator_user_id", userId)
    .single();
  if (error || !data) return null;
  return data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireAuth();
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const existing = await getTemplateAndVerify(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    const body = await request.json();
    const {
      name,
      title,
      guest_name,
      guest_address,
      guest_phone,
      guest_email,
      account_name,
      bank_name,
      account_number,
      sort_code,
      bank_address,
      paypal,
      bank_type,
      iban,
      swift_bic,
      department_id,
      program_id,
    } = body;
    const supabase = createAdminClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = name?.trim() || "";
    if (title !== undefined) update.title = title?.trim() || null;
    if (guest_name !== undefined) update.guest_name = guest_name?.trim() || null;
    if (guest_address !== undefined) update.guest_address = guest_address?.trim() || null;
    if (guest_phone !== undefined) update.guest_phone = guest_phone?.trim() || null;
    if (guest_email !== undefined) update.guest_email = guest_email?.trim() || null;
    if (account_name !== undefined) update.account_name = account_name?.trim() || null;
    if (bank_name !== undefined) update.bank_name = bank_name?.trim() || null;
    if (account_number !== undefined) update.account_number = account_number?.trim() || null;
    if (sort_code !== undefined) update.sort_code = sort_code?.trim() || null;
    if (bank_address !== undefined) update.bank_address = bank_address?.trim() || null;
    if (paypal !== undefined) update.paypal = paypal?.trim() || null;
    if (bank_type !== undefined) update.bank_type = bank_type === "international" ? "international" : "uk";
    if (iban !== undefined) update.iban = iban?.trim() || null;
    if (swift_bic !== undefined) update.swift_bic = swift_bic?.trim() || null;
    if (department_id !== undefined) update.department_id = department_id || null;
    if (program_id !== undefined) update.program_id = program_id || null;
    const { data, error } = await supabase
      .from("guest_invoice_templates")
      .update(update)
      .eq("id", id)
      .eq("creator_user_id", session.user.id)
      .select()
      .single();
    if (error) throw error;
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
    const { session } = await requireAuth();
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("guest_invoice_templates")
      .delete()
      .eq("id", id)
      .eq("creator_user_id", session.user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
