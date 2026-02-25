import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** PATCH /api/employees/[id] - Update employee (admin, operations) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const allowedFields = [
      "full_name",
      "ni_number",
      "bank_account_number",
      "sort_code",
      "email_address",
      "badge_color",
      "status",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body && body[key] !== undefined) {
        const v = body[key];
        updates[key] = typeof v === "string" ? v.trim() || null : v;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("employees")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
