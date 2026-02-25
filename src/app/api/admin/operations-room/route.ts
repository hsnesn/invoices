import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrOperations } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdminOrOperations();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("operations_room_members")
      .select("id, user_id, created_at")
      .order("created_at");
    if (error) throw error;

    const userIds = (data ?? []).map((r) => r.user_id);
    const profiles: { id: string; full_name: string | null }[] = [];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profiles.push(...(profs ?? []));
    }

    const profMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? p.id]));
    const result = (data ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      full_name: profMap[r.user_id] ?? r.user_id,
      created_at: r.created_at,
    }));
    return NextResponse.json(result);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const body = await request.json();
    const { user_id } = body;
    if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("operations_room_members")
      .insert({ user_id })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "User already in Operations Room" }, { status: 400 });
      throw error;
    }
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const user_id = searchParams.get("user_id");
    const supabase = createAdminClient();
    if (id) {
      const { error } = await supabase.from("operations_room_members").delete().eq("id", id);
      if (error) throw error;
    } else if (user_id) {
      const { error } = await supabase.from("operations_room_members").delete().eq("user_id", user_id);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: "id or user_id is required" }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
