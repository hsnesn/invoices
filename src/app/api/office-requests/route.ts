/**
 * Office requests: list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CATEGORIES = ["furniture", "it_equipment", "office_supplies", "maintenance", "software", "training", "other"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export async function GET(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const mine = searchParams.get("mine") === "true";

    let query = supabase
      .from("office_requests")
      .select(`
        id,
        title,
        description,
        category,
        priority,
        status,
        requester_user_id,
        approved_by,
        approved_at,
        rejected_by,
        rejected_at,
        rejection_reason,
        cost_estimate,
        created_at,
        updated_at,
        office_request_todos(id, assignee_user_id, due_date, status, completed_at, completion_notes),
        project_id,
        vendor_id,
        linked_invoice_id
      `)
      .order("created_at", { ascending: false });

    if (profile.role !== "admin" && profile.role !== "operations") {
      query = query.eq("requester_user_id", session.user.id);
    } else if (mine) {
      query = query.eq("requester_user_id", session.user.id);
    }
    if (status) query = query.eq("status", status);

    const { data: rows, error } = await query;
    if (error) throw error;

    const userIds = new Set<string>();
    for (const r of rows ?? []) {
      const o = r as { requester_user_id?: string; approved_by?: string; office_request_todos?: { assignee_user_id?: string }[] };
      if (o.requester_user_id) userIds.add(o.requester_user_id);
      if (o.approved_by) userIds.add(o.approved_by);
      const todo = Array.isArray(o.office_request_todos) ? o.office_request_todos[0] : o.office_request_todos;
      if (todo?.assignee_user_id) userIds.add(todo.assignee_user_id);
    }
    const { data: profiles } = userIds.size > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", Array.from(userIds))
      : { data: [] };
    const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || p.id]));

    const enriched = (rows ?? []).map((r) => {
      const o = r as Record<string, unknown>;
      return {
        ...o,
        requester_name: profileMap[(o.requester_user_id as string) ?? ""] ?? o.requester_user_id,
        approved_by_name: o.approved_by ? profileMap[o.approved_by as string] ?? o.approved_by : null,
        assignee_name: (() => {
          const todo = Array.isArray(o.office_request_todos) ? o.office_request_todos[0] : o.office_request_todos;
          const aid = (todo as { assignee_user_id?: string })?.assignee_user_id;
          return aid ? profileMap[aid] ?? aid : null;
        })(),
      };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const role = profile.role;
    if (role !== "admin" && role !== "operations" && role !== "manager" && role !== "submitter" && role !== "finance" && role !== "viewer") {
      const allowed = profile.allowed_pages?.includes("office_requests");
      if (!allowed && (profile.allowed_pages?.length ?? 0) > 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const category = CATEGORIES.includes((body.category as (typeof CATEGORIES)[number]) ?? "other") ? body.category : "other";
    const priority = PRIORITIES.includes((body.priority as (typeof PRIORITIES)[number]) ?? "normal") ? body.priority : "normal";
    const costEstimate = typeof body.cost_estimate === "number" ? body.cost_estimate : null;
    const projectId = typeof body.project_id === "string" && body.project_id.trim() ? body.project_id.trim() : null;
    const vendorId = typeof body.vendor_id === "string" && body.vendor_id.trim() ? body.vendor_id.trim() : null;

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("office_requests")
      .insert({
        title,
        description: description || null,
        category,
        priority,
        cost_estimate: costEstimate,
        project_id: projectId,
        vendor_id: vendorId,
        requester_user_id: session.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
