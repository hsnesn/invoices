import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrOperations } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdminOrOperations();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("department_managers")
      .select("id, department_id, manager_user_id, sort_order")
      .order("department_id")
      .order("sort_order");
    if (error) throw error;

    const { data: depts } = await supabase.from("departments").select("id, name");
    const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));

    const withDetails = await Promise.all(
      (data ?? []).map(async (row) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(row.manager_user_id);
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", row.manager_user_id).single();
        return {
          ...row,
          department_name: deptMap.get(row.department_id) ?? "",
          manager_name: profile?.full_name ?? authUser?.user?.email ?? "Unknown",
          manager_email: authUser?.user?.email ?? null,
        };
      })
    );
    return NextResponse.json(withDetails);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminOrOperations();
    const body = await request.json();
    const { department_id, manager_user_id } = body;
    if (!department_id || !manager_user_id) {
      return NextResponse.json({ error: "department_id and manager_user_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("department_managers")
      .insert({ department_id, manager_user_id })
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
    await requireAdminOrOperations();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const department_id = searchParams.get("department_id");
    const manager_user_id = searchParams.get("manager_user_id");

    const supabase = createAdminClient();
    let q = supabase.from("department_managers").delete();
    if (id) {
      q = q.eq("id", id);
    } else if (department_id && manager_user_id) {
      q = q.eq("department_id", department_id).eq("manager_user_id", manager_user_id);
    } else {
      return NextResponse.json({ error: "id or (department_id and manager_user_id) required" }, { status: 400 });
    }
    const { error } = await q;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
