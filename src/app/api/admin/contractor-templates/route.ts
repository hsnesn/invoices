import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("contractor_templates")
      .select("id, name, name_aliases, account_number, sort_code, beneficiary_name, company_name, sort_order")
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { name, name_aliases, account_number, sort_code, beneficiary_name, company_name } = body;
    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("contractor_templates")
      .insert({
        name: name.trim(),
        name_aliases: Array.isArray(name_aliases) ? name_aliases.filter((s: unknown) => typeof s === "string" && s.trim()) : [],
        account_number: account_number?.trim() || null,
        sort_code: sort_code?.trim() || null,
        beneficiary_name: beneficiary_name?.trim() || null,
        company_name: company_name?.trim() || null,
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

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, name, name_aliases, account_number, sort_code, beneficiary_name, company_name } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const supabase = createAdminClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = name?.trim() || "";
    if (name_aliases !== undefined) update.name_aliases = Array.isArray(name_aliases) ? name_aliases.filter((s: unknown) => typeof s === "string" && s.trim()) : [];
    if (account_number !== undefined) update.account_number = account_number?.trim() || null;
    if (sort_code !== undefined) update.sort_code = sort_code?.trim() || null;
    if (beneficiary_name !== undefined) update.beneficiary_name = beneficiary_name?.trim() || null;
    if (company_name !== undefined) update.company_name = company_name?.trim() || null;
    const { data, error } = await supabase.from("contractor_templates").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const supabase = createAdminClient();
    const { error } = await supabase.from("contractor_templates").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
