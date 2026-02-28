/**
 * Full-text search for guest/salary invoices.
 * Returns full invoice rows (same shape as invoices page) for display.
 * Query: ?q=search_term
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { canAccessInvoice } from "@/lib/invoice-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const supabase = createAdminClient();

    const { data: idRows, error: searchError } = await supabase.rpc("search_invoices", {
      search_query: q,
    });

    if (searchError) {
      console.warn("search_invoices RPC error:", searchError.message);
      return NextResponse.json([]);
    }

    const ids = (idRows ?? []).map((r: { invoice_id: string }) => r.invoice_id).filter(Boolean);
    if (ids.length === 0) return NextResponse.json([]);

    const { data: invoicesRaw, error: fetchError } = await supabase
      .from("invoices")
      .select(`
        id,
        storage_path,
        service_description,
        currency,
        created_at,
        service_date_from,
        service_date_to,
        department_id,
        program_id,
        previous_invoice_id,
        submitter_user_id,
        tags,
        invoice_workflows(status, rejection_reason, manager_user_id, paid_date),
        invoice_extracted_fields(invoice_number, beneficiary_name, account_number, sort_code, gross_amount, extracted_currency, raw_json, needs_review),
        invoice_files(storage_path, file_name, sort_order)
      `)
      .in("id", ids)
      .in("invoice_type", ["guest", "salary"])
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    const visible: unknown[] = [];
    for (const inv of invoicesRaw ?? []) {
      const allowed = await canAccessInvoice(supabase, inv.id, session.user.id, profile);
      if (allowed) visible.push(inv);
    }

    return NextResponse.json(visible);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
