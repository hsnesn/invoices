/**
 * Per-user preference list: each person saves who they prefer to work with.
 * AI suggest prefers people who appear in more users' lists (when available).
 * Same access as Request page: admin, operations, manager.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canAccess(role: string) {
  return ["admin", "operations", "manager"].includes(role);
}

export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (!canAccess(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("contractor_preference_per_user")
      .select("id, preferred_user_id, sort_order, department_id, program_id, role")
      .eq("user_id", profile.id)
      .order("sort_order");

    const rows = (data ?? []) as { id: string; preferred_user_id: string; sort_order: number; department_id: string | null; program_id: string | null; role: string | null }[];
    const ids = Array.from(new Set(rows.map((r) => r.preferred_user_id)));
    if (ids.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameMap.set((p as { id: string }).id, (p as { full_name: string | null }).full_name ?? "Unknown");
    }

    const { data: deptRows } = await supabase.from("departments").select("id, name").in("id", rows.map((r) => r.department_id).filter(Boolean) as string[]);
    const deptMap = new Map<string, string>();
    for (const d of deptRows ?? []) {
      deptMap.set((d as { id: string }).id, (d as { name: string }).name ?? "");
    }

    const progIds = rows.map((r) => r.program_id).filter(Boolean) as string[];
    const { data: progRows } = progIds.length > 0 ? await supabase.from("programs").select("id, name").in("id", progIds) : { data: [] };
    const progMap = new Map<string, string>();
    for (const p of progRows ?? []) {
      progMap.set((p as { id: string }).id, (p as { name: string }).name ?? "");
    }

    const users = rows.map((r) => ({
      id: r.id,
      user_id: r.preferred_user_id,
      full_name: nameMap.get(r.preferred_user_id) ?? "Unknown",
      department_id: r.department_id,
      department_name: r.department_id ? deptMap.get(r.department_id) ?? "" : null,
      program_id: r.program_id,
      program_name: r.program_id ? progMap.get(r.program_id) ?? "" : null,
      role: r.role?.trim() || null,
    }));

    return NextResponse.json({ users });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (!canAccess(profile.role)) {
      return NextResponse.json({ error: "Admin, operations or manager only." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    let items: unknown[] = [];
    if (Array.isArray(body.items)) {
      items = body.items;
    } else if (Array.isArray(body.user_ids)) {
      items = body.user_ids.map((id: unknown) => ({ preferred_user_id: id }));
    }

    const valid: { preferred_user_id: string; department_id: string | null; program_id: string | null; role: string | null }[] = [];
    for (const it of items) {
      const preferred = typeof it === "object" && it && typeof (it as { preferred_user_id?: unknown }).preferred_user_id === "string"
        ? (it as { preferred_user_id: string }).preferred_user_id
        : typeof it === "string"
          ? it
          : null;
      if (!preferred || !/^[0-9a-f-]{36}$/i.test(preferred)) continue;
      const dept = typeof (it as { department_id?: unknown })?.department_id === "string" && /^[0-9a-f-]{36}$/i.test((it as { department_id: string }).department_id)
        ? (it as { department_id: string }).department_id
        : null;
      const prog = typeof (it as { program_id?: unknown })?.program_id === "string" && /^[0-9a-f-]{36}$/i.test((it as { program_id: string }).program_id)
        ? (it as { program_id: string }).program_id
        : null;
      const role = typeof (it as { role?: unknown })?.role === "string" && (it as { role: string }).role.trim()
        ? (it as { role: string }).role.trim()
        : null;
      valid.push({ preferred_user_id: preferred, department_id: dept, program_id: prog, role });
    }

    const supabase = createAdminClient();

    await supabase.from("contractor_preference_per_user").delete().eq("user_id", profile.id);

    if (valid.length > 0) {
      const rows = valid.map((v, i) => ({
        user_id: profile.id,
        preferred_user_id: v.preferred_user_id,
        department_id: v.department_id,
        program_id: v.program_id,
        role: v.role,
        sort_order: i,
      }));
      const { error } = await supabase.from("contractor_preference_per_user").insert(rows);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
