import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const supabase = createAdminClient();
    let query = supabase.from("freelancer_setup_items").select("id, category, value, sort_order").order("sort_order").order("value");
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
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
    const { category, value } = body;
    if (!category || !value?.trim()) return NextResponse.json({ error: "category and value are required" }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("freelancer_setup_items").insert({ category, value: value.trim() }).select().single();
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
    const { id, value } = body;
    if (!id || !value?.trim()) return NextResponse.json({ error: "id and value are required" }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("freelancer_setup_items").update({ value: value.trim() }).eq("id", id).select().single();
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
    const { error } = await supabase.from("freelancer_setup_items").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
