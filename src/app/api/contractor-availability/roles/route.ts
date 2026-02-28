/**
 * Contractor availability roles - list for dropdown (all users) or CRUD (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("freelancer_setup_items")
      .select("id, value, sort_order")
      .eq("category", "contractor_availability_role")
      .order("sort_order")
      .order("value");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Admin or operations only." }, { status: 403 });
    }

    const body = await request.json();
    const { value } = body as { value: string };
    if (!value?.trim()) return NextResponse.json({ error: "value is required" }, { status: 400 });

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("freelancer_setup_items")
      .select("id")
      .eq("category", "contractor_availability_role")
      .eq("value", value.trim())
      .maybeSingle();

    if (existing) return NextResponse.json({ error: "Role already exists" }, { status: 400 });

    const { data: max } = await supabase
      .from("freelancer_setup_items")
      .select("sort_order")
      .eq("category", "contractor_availability_role")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = ((max as { sort_order?: number })?.sort_order ?? 0) + 1;
    const { data, error } = await supabase
      .from("freelancer_setup_items")
      .insert({ category: "contractor_availability_role", value: value.trim(), sort_order: sortOrder })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Admin or operations only." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("freelancer_setup_items")
      .delete()
      .eq("id", id)
      .eq("category", "contractor_availability_role");

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
