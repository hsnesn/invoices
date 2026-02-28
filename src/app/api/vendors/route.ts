/**
 * Vendors: list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const preferred = searchParams.get("preferred") === "true";

    let query = supabase
      .from("vendors")
      .select("*")
      .order("name", { ascending: true });

    if (preferred) query = query.eq("is_preferred", true);
    if (search) query = query.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%,email.ilike.%${search}%`);

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
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("vendors")
      .insert({
        name,
        contact_person: typeof body.contact_person === "string" ? body.contact_person.trim() || null : null,
        email: typeof body.email === "string" ? body.email.trim() || null : null,
        phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
        address: typeof body.address === "string" ? body.address.trim() || null : null,
        payment_terms: typeof body.payment_terms === "string" ? body.payment_terms.trim() || null : null,
        contract_end_date: typeof body.contract_end_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.contract_end_date) ? body.contract_end_date : null,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        is_preferred: !!body.is_preferred,
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
