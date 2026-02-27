/**
 * Guest titles - list and add (for dropdown)
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
      .from("guest_titles")
      .select("id, name")
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
    await requireAuth();
    const body = (await request.json()) as { name: string };
    const name = body.name?.trim();
    if (!name || name.length < 1) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: existing } = await supabase.from("guest_titles").select("id, name").eq("name", name).maybeSingle();
    if (existing) return NextResponse.json(existing);

    const { data, error } = await supabase.from("guest_titles").insert({ name }).select().single();
    if (error) {
      if (error.code === "23505") {
        const { data: dup } = await supabase.from("guest_titles").select("id, name").eq("name", name).single();
        return NextResponse.json(dup ?? { name });
      }
      throw error;
    }
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
