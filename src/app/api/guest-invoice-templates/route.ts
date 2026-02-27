import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const { session } = await requireAuth();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("guest_invoice_templates")
      .select("id, name, title, guest_name, guest_address, guest_phone, guest_email, account_name, bank_name, account_number, sort_code, bank_address, paypal, department_id, program_id")
      .eq("creator_user_id", session.user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireAuth();
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
      department_id,
      program_id,
    } = body;
    if (!name?.trim()) return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("guest_invoice_templates")
      .insert({
        creator_user_id: session.user.id,
        name: name.trim(),
        title: title?.trim() || null,
        guest_name: guest_name?.trim() || null,
        guest_address: guest_address?.trim() || null,
        guest_phone: guest_phone?.trim() || null,
        guest_email: guest_email?.trim() || null,
        account_name: account_name?.trim() || null,
        bank_name: bank_name?.trim() || null,
        account_number: account_number?.trim() || null,
        sort_code: sort_code?.trim() || null,
        bank_address: bank_address?.trim() || null,
        paypal: paypal?.trim() || null,
        department_id: department_id || null,
        program_id: program_id || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
