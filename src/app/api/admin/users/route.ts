import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { createAuditEvent } from "@/lib/audit";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const withEmails = await Promise.all(
      (data ?? []).map(async (p) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(p.id);
        return { ...p, email: authUser?.user?.email ?? null };
      })
    );
    return NextResponse.json(withEmails);
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
    const { profile } = await requireAdmin();
    const body = await request.json();
    const { user_id, role, is_active, department_id, program_ids, allowed_pages } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    if (user_id === profile.id && (role !== profile.role || is_active === false)) {
      return NextResponse.json(
        { error: "Cannot change your own role or deactivate yourself" },
        { status: 400 }
      );
    }

    const validRoles = ["submitter", "manager", "admin", "finance", "viewer", "operations"];
    if (role !== undefined && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (department_id !== undefined) updates.department_id = department_id;
    if (program_ids !== undefined) updates.program_ids = program_ids;
    if (allowed_pages !== undefined) updates.allowed_pages = allowed_pages;

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user_id)
      .select()
      .single();

    if (error) {
      const msg = error.message?.includes("app_role") || error.message?.includes("enum")
        ? `${error.message}. Run migration 00020_add_operations_role.sql in Supabase SQL Editor.`
        : error.message;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    await createAuditEvent({
      actor_user_id: profile.id,
      event_type: "user_updated",
      payload: { user_id, updates },
    });

    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
