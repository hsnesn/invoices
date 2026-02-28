/**
 * Delete permissions: which roles can delete invoices.
 * Admin only. Stored in app_settings.roles_can_delete_invoices.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KEY = "roles_can_delete_invoices";

const ALL_ROLES = ["admin", "manager", "finance", "operations", "viewer", "submitter"] as const;

const DEFAULT_ROLES = ["admin", "finance", "operations", "submitter"];

function getRoles(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x) => typeof x === "string" && ALL_ROLES.includes(x as (typeof ALL_ROLES)[number]));
}

/** GET: returns roles that can delete. Any authenticated user can read for UI visibility. */
export async function GET() {
  try {
    await requireAuth();
    const supabase = createAdminClient();
    const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).single();
    const roles = getRoles((data as { value?: unknown } | null)?.value ?? []);
    const effective = roles.length > 0 ? roles : DEFAULT_ROLES;

    const roleList = ALL_ROLES.map((role) => ({
      role,
      label: role.charAt(0).toUpperCase() + role.slice(1),
      canDelete: effective.includes(role),
    }));

    return NextResponse.json({ roles: effective, roleList });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { roles: rolesBody } = body as { roles?: string[] };
    const roles = Array.isArray(rolesBody)
      ? getRoles(rolesBody)
      : [];

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: KEY, value: roles, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;

    return NextResponse.json({ ok: true, roles });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
