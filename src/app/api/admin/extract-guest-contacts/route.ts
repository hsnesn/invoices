import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { runInvoiceExtraction } from "@/lib/invoice-extraction";

/**
 * Admin-only: Re-run extraction on all guest invoices to populate guest_phone/guest_email in raw_json.
 * Use when you want to scan existing invoices for contact info.
 */
export async function POST() {
  try {
    await requireAdmin();
    const supabase = createAdminClient();

    const { data: invoices } = await supabase
      .from("invoices")
      .select("id")
      .in("invoice_type", ["guest", "salary"])
      .not("storage_path", "is", null);

    if (!invoices?.length) {
      return NextResponse.json({ processed: 0, message: "No guest invoices with files found" });
    }

    let processed = 0;
    let errors = 0;

    for (const inv of invoices) {
      try {
        await runInvoiceExtraction(inv.id, null);
        processed++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      processed,
      errors,
      total: invoices.length,
      message: `Extraction completed. ${processed} processed, ${errors} failed.`,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
