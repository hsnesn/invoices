import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("producer_colors")
      .select("producer_name, color_hex")
      .order("producer_name");
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
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const producer_name = (body.producer_name as string)?.trim();
    const color_hex = (body.color_hex as string)?.trim();
    if (!producer_name) {
      return NextResponse.json(
        { error: "producer_name is required" },
        { status: 400 }
      );
    }
    if (!color_hex || !/^#[0-9A-Fa-f]{6}$/.test(color_hex)) {
      return NextResponse.json(
        { error: "color_hex must be a valid hex color (e.g. #3A626A)" },
        { status: 400 }
      );
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("producer_colors")
      .upsert(
        {
          producer_name,
          color_hex,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "producer_name" }
      )
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
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const producer_name = searchParams.get("producer_name");
    if (!producer_name) {
      return NextResponse.json(
        { error: "producer_name is required" },
        { status: 400 }
      );
    }
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("producer_colors")
      .delete()
      .eq("producer_name", producer_name);
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
