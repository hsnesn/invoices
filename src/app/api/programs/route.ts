import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("department_id");

    const supabase = createAdminClient();
    let query = supabase.from("programs").select("*").order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }
    const { data, error } = await query;
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
