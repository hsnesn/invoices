/**
 * Contractor Preference Pool: users eligible for "My Preference List" dropdown.
 * Admin manages this in Setup. When populated, only these users appear.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrOperations } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdminOrOperations();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("contractor_preference_pool")
      .select("id, user_id, sort_order, created_at")
      .order("sort_order")
      .order("created_at");

    if (error) throw error;

    const rows = (data ?? []) as { id: string; user_id: string; sort_order: number; created_at: string }[];
    const userIds = rows.map((r) => r.user_id);

    if (userIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      profMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
    }

    const result = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      full_name: profMap.get(r.user_id) ?? r.user_id,
      sort_order: r.sort_order,
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
      .from("contractor_preference_pool")
      .insert({ user_id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "User already in contractor pool" }, { status: 400 });
      }
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
      const { error } = await supabase.from("contractor_preference_pool").delete().eq("id", id);
      if (error) throw error;
    } else if (user_id) {
      const { error } = await supabase.from("contractor_preference_pool").delete().eq("user_id", user_id);
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
