import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrOperations } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdminOrOperations();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const body = await request.json();
    const { name } = body;
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }
    const supabase = createAdminClient();
    const { data: maxRow } = await supabase.from("departments").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
    const nextOrder = (maxRow as { sort_order?: number } | null)?.sort_order != null ? (maxRow as { sort_order: number }).sort_order + 1 : 0;
    const { data, error } = await supabase
      .from("departments")
      .insert({ name: name.trim(), sort_order: nextOrder })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const body = await request.json();
    const { id, name } = body;
    if (!id || !name?.trim()) {
      return NextResponse.json(
        { error: "id and name are required" },
        { status: 400 }
      );
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("departments")
      .update({ name: name.trim() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }
    const supabase = createAdminClient();
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
