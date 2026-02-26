import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrOperations } from "@/lib/auth";

const NEWSMAKER_KEY = "newsmaker";

export async function GET() {
  try {
    await requireAdminOrOperations();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("program_manager_overrides")
      .select("program_name_key, manager_user_id");
    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json([]);
      }
      throw error;
    }

    const withDetails = await Promise.all(
      (data ?? []).map(async (row) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", row.manager_user_id)
          .single();
        return {
          program_name_key: row.program_name_key,
          manager_user_id: row.manager_user_id,
          manager_name: profile?.full_name ?? "Unknown",
        };
      })
    );
    return NextResponse.json(withDetails);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const body = await request.json();
    const { program_name_key, manager_user_id } = body as {
      program_name_key?: string;
      manager_user_id?: string | null;
    };

    const key = program_name_key ?? NEWSMAKER_KEY;
    if (!key) {
      return NextResponse.json({ error: "program_name_key required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (manager_user_id === null || manager_user_id === "") {
      await supabase.from("program_manager_overrides").delete().eq("program_name_key", key);
      return NextResponse.json({ success: true, cleared: true });
    }

    if (!manager_user_id) {
      return NextResponse.json({ error: "manager_user_id required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("program_manager_overrides")
      .upsert(
        {
          program_name_key: key,
          manager_user_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "program_name_key" }
      );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
