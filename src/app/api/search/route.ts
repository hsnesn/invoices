import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();

    if (q.length < 2) {
      return NextResponse.json({ invoices: [], people: [] });
    }

    const supabase = createAdminClient();
    const pattern = `%${q}%`;

    const [extractedResult, peopleResult] = await Promise.all([
      supabase
        .from("invoice_extracted_fields")
        .select("invoice_id, invoice_number, beneficiary_name")
        .or(`invoice_number.ilike.${pattern},beneficiary_name.ilike.${pattern}`)
        .limit(5),

      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .eq("is_active", true)
        .limit(5),
    ]);

    const invoices = (extractedResult.data ?? []).map((ext) => ({
      id: ext.invoice_id,
      invoice_number: (ext.invoice_number as string)?.trim() || "—",
      guest_name: (ext.beneficiary_name as string)?.trim() || "—",
    }));

    const people = (peopleResult.data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name ?? "—",
      email: p.email ?? "—",
      role: p.role ?? "—",
    }));

    return NextResponse.json({ invoices, people });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
