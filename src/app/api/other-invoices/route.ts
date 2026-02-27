/**
 * List other invoices with filtering.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const role = profile.role;
    if (role === "admin" || role === "finance" || role === "operations") {
      // allowed
    } else if (role === "viewer" && profile.allowed_pages?.includes("other_invoices")) {
      // allowed
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("invoices")
      .select(`
        id,
        service_description,
        created_at,
        storage_path,
        invoice_workflows(status, paid_date, payment_reference),
        invoice_extracted_fields(beneficiary_name, invoice_number, invoice_date, gross_amount, extracted_currency, net_amount, vat_amount, account_number, sort_code),
        invoice_files(storage_path, file_name)
      `)
      .eq("invoice_type", "other")
      .order(sort, { ascending: order === "asc" })
      .limit(500);

    if (error) throw error;

    let list = rows ?? [];

    if (dateFrom) {
      const from = `${dateFrom}T00:00:00Z`;
      list = list.filter((r) => ((r as { created_at?: string }).created_at ?? "") >= from);
    }
    if (dateTo) {
      const to = `${dateTo}T23:59:59Z`;
      list = list.filter((r) => ((r as { created_at?: string }).created_at ?? "") <= to);
    }
    if (statusFilter) {
      list = list.filter((r) => {
        const wf = Array.isArray(r.invoice_workflows) ? r.invoice_workflows[0] : r.invoice_workflows;
        return (wf as { status?: string })?.status === statusFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const wf = Array.isArray(r.invoice_workflows) ? r.invoice_workflows[0] : r.invoice_workflows;
        const ext = Array.isArray(r.invoice_extracted_fields) ? r.invoice_extracted_fields[0] : r.invoice_extracted_fields;
        const desc = (r as { service_description?: string }).service_description ?? "";
        const beneficiary = (ext as { beneficiary_name?: string })?.beneficiary_name ?? "";
        const invNo = (ext as { invoice_number?: string })?.invoice_number ?? "";
        const amount = String((ext as { gross_amount?: number })?.gross_amount ?? "");
        return (
          desc.toLowerCase().includes(q) ||
          beneficiary.toLowerCase().includes(q) ||
          invNo.toLowerCase().includes(q) ||
          amount.includes(q) ||
          (r as { id: string }).id.toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json(list);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
