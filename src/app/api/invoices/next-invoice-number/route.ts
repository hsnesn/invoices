/**
 * Get next suggested invoice number based on existing records.
 * Parses INV-YYYY-NNN or similar patterns, returns next in sequence.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAuth();
    const supabase = createAdminClient();

    const { data: rows } = await supabase
      .from("invoice_extracted_fields")
      .select("invoice_number")
      .not("invoice_number", "is", null);

    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    let maxNum = 0;

    for (const r of rows ?? []) {
      const n = (r as { invoice_number?: string }).invoice_number?.trim();
      if (!n) continue;
      if (n.startsWith(prefix)) {
        const num = parseInt(n.slice(prefix.length), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      if (/^INV-\d{4}-\d+$/i.test(n)) {
        const parts = n.split("-");
        const y = parseInt(parts[1], 10);
        const num = parseInt(parts[2], 10);
        if (y === year && !isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const nextInvNo = `${prefix}${String(nextNum).padStart(3, "0")}`;

    return NextResponse.json({ next_invoice_number: nextInvNo, is_auto_suggested: maxNum > 0 });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
