import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    let fullName = profile.full_name;
    const { data: authUser } = await supabase.auth.admin.getUserById(session.user.id);
    const email = authUser?.user?.email ?? null;
    if (!fullName) fullName = email?.split("@")[0] ?? null;

    let departmentName: string | null = null;
    if (profile.department_id) {
      const { data: dept } = await supabase.from("departments").select("name").eq("id", profile.department_id).single();
      departmentName = dept?.name ?? null;
    }

    return NextResponse.json({
      id: profile.id,
      full_name: fullName,
      email,
      role: profile.role,
      department_id: profile.department_id,
      department_name: departmentName,
      is_active: profile.is_active,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const body = (await request.json()) as { full_name?: string };

    if (body.full_name === undefined) {
      return NextResponse.json({ error: "full_name is required" }, { status: 400 });
    }

    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    if (fullName.length > 255) {
      return NextResponse.json({ error: "Name must be at most 255 characters" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName || null, updated_at: new Date().toISOString() })
      .eq("id", session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, full_name: fullName || null });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
