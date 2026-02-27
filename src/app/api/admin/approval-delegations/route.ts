import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export type ApprovalDelegation = {
  id: string;
  delegator_user_id: string;
  delegate_user_id: string;
  valid_from: string;
  valid_until: string;
  created_at?: string;
};

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("approval_delegations")
      .select("id, delegator_user_id, delegate_user_id, valid_from, valid_until, created_at")
      .order("valid_from", { ascending: false });
    if (error) throw error;

    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const withDetails = (data ?? []).map((row) => ({
      ...row,
      delegator_name: profileMap.get(row.delegator_user_id)?.full_name ?? "—",
      delegator_email: profileMap.get(row.delegator_user_id)?.email ?? null,
      delegate_name: profileMap.get(row.delegate_user_id)?.full_name ?? "—",
      delegate_email: profileMap.get(row.delegate_user_id)?.email ?? null,
    }));

    return NextResponse.json(withDetails);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { delegator_user_id, delegate_user_id, valid_from, valid_until } = body;
    if (!delegator_user_id || !delegate_user_id || !valid_from || !valid_until) {
      return NextResponse.json(
        { error: "delegator_user_id, delegate_user_id, valid_from, and valid_until are required" },
        { status: 400 }
      );
    }
    if (delegator_user_id === delegate_user_id) {
      return NextResponse.json({ error: "Delegator and delegate cannot be the same user" }, { status: 400 });
    }

    const from = new Date(valid_from);
    const until = new Date(valid_until);
    if (isNaN(from.getTime()) || isNaN(until.getTime())) {
      return NextResponse.json({ error: "Invalid date format for valid_from or valid_until" }, { status: 400 });
    }
    if (until < from) {
      return NextResponse.json({ error: "valid_until must be on or after valid_from" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("approval_delegations")
      .insert({
        delegator_user_id,
        delegate_user_id,
        valid_from: valid_from,
        valid_until: valid_until,
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

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, delegator_user_id, delegate_user_id, valid_from, valid_until } = body;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (delegator_user_id === delegate_user_id) {
      return NextResponse.json({ error: "Delegator and delegate cannot be the same user" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (delegator_user_id != null) updates.delegator_user_id = delegator_user_id;
    if (delegate_user_id != null) updates.delegate_user_id = delegate_user_id;
    if (valid_from != null) updates.valid_from = valid_from;
    if (valid_until != null) updates.valid_until = valid_until;

    if (valid_from != null && valid_until != null) {
      const from = new Date(valid_from);
      const until = new Date(valid_until);
      if (isNaN(from.getTime()) || isNaN(until.getTime())) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      }
      if (until < from) {
        return NextResponse.json({ error: "valid_until must be on or after valid_from" }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("approval_delegations")
      .update(updates)
      .eq("id", id)
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
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("approval_delegations").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
