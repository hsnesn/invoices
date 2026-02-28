/**
 * Recurring invoices: list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    let query = supabase
      .from("recurring_invoices")
      .select("*")
      .order("next_due_date", { ascending: true });

    if (active !== "false") {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "finance" && profile.role !== "operations") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const nextDueDate = typeof body.next_due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.next_due_date)
      ? body.next_due_date
      : null;
    if (!nextDueDate) return NextResponse.json({ error: "next_due_date is required (YYYY-MM-DD)" }, { status: 400 });

    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    const beneficiaryName = typeof body.beneficiary_name === "string" ? body.beneficiary_name.trim() || null : null;
    const amount = typeof body.amount === "number" ? body.amount : null;
    const currency = typeof body.currency === "string" ? body.currency.trim() || "GBP" : "GBP";
    const frequency = FREQUENCIES.includes((body.frequency as (typeof FREQUENCIES)[number]) ?? "monthly") ? body.frequency : "monthly";

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("recurring_invoices")
      .insert({
        title,
        description,
        beneficiary_name: beneficiaryName,
        amount,
        currency,
        frequency,
        next_due_date: nextDueDate,
        created_by: session.user.id,
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
