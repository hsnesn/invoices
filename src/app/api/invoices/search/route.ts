/**
 * Search invoices for message reference. Returns invoices the user can access.
 * Query: ?q=search_term&limit=20
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
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const byId = searchParams.get("id")?.trim();
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const supabase = createAdminClient();

    if (byId) {
      const canAccess = await canAccessInvoice(supabase, byId, session.user.id, profile);
      if (!canAccess) {
        return NextResponse.json([], { status: 200 });
      }
      const { data: inv } = await supabase
        .from("invoice_extracted_fields")
        .select("invoice_number, beneficiary_name")
        .eq("invoice_id", byId)
        .single();
      const invoiceNumber = (inv?.invoice_number as string) ?? String(byId).slice(0, 8);
      const beneficiary = (inv?.beneficiary_name as string) ?? "—";
      return NextResponse.json([{ id: byId, invoice_number: invoiceNumber, beneficiary }]);
    }

    let query = supabase
      .from("invoices")
      .select(`
        id,
        service_description,
        created_at,
        invoice_extracted_fields(invoice_number, beneficiary_name)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    const { data: rows, error } = await query;

    if (error) throw error;

    const results: { id: string; invoice_number: string; beneficiary: string }[] = [];
    for (const inv of rows ?? []) {
      const canAccess = await canAccessInvoice(supabase, inv.id, session.user.id, profile);
      if (!canAccess) continue;

      const ext = Array.isArray(inv.invoice_extracted_fields)
        ? inv.invoice_extracted_fields[0]
        : inv.invoice_extracted_fields;
      const invoiceNumber = (ext?.invoice_number as string) ?? String(inv.id).slice(0, 8);
      const beneficiary = (ext?.beneficiary_name as string) ?? "—";

      const display = `${invoiceNumber} ${beneficiary}`.toLowerCase();
      if (q && !display.includes(q)) continue;

      results.push({ id: inv.id, invoice_number: invoiceNumber, beneficiary });
      if (results.length >= limit) break;
    }

    return NextResponse.json(results);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
