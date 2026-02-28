/**
 * Recurring invoice: get, update, or delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

function advanceNextDueDate(currentDate: string, frequency: string): string {
  const d = new Date(currentDate);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await context.params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("recurring_invoices")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "finance" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const supabase = createAdminClient();
    const { data: existing, error: fetchErr } = await supabase
      .from("recurring_invoices")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) return NextResponse.json({ error: "Recurring invoice not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null;
    if (body.beneficiary_name !== undefined) updates.beneficiary_name = body.beneficiary_name ? String(body.beneficiary_name).trim() : null;
    if (body.amount !== undefined) updates.amount = typeof body.amount === "number" ? body.amount : null;
    if (body.currency !== undefined) updates.currency = body.currency ? String(body.currency).trim() : "GBP";
    if (body.frequency !== undefined) updates.frequency = FREQUENCIES.includes(body.frequency as (typeof FREQUENCIES)[number]) ? body.frequency : existing.frequency;
    if (body.is_active !== undefined) updates.is_active = !!body.is_active;

    if (body.advance_next_due_date === true) {
      const freq = (existing as { frequency: string }).frequency || "monthly";
      const current = (existing as { next_due_date: string }).next_due_date;
      updates.next_due_date = advanceNextDueDate(current, freq);
    } else if (body.next_due_date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(body.next_due_date)) {
      updates.next_due_date = body.next_due_date;
    }

    const { error } = await supabase.from("recurring_invoices").update(updates).eq("id", id);
    if (error) throw error;

    const { data: updated } = await supabase.from("recurring_invoices").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "finance" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const supabase = createAdminClient();
    const { error } = await supabase.from("recurring_invoices").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
