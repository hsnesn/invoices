import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const { guest_name, amount, invoice_date, department_id, invoice_type } = body as {
      guest_name?: string;
      amount?: number;
      invoice_date?: string;
      department_id?: string;
      invoice_type?: string;
    };

    if (!guest_name?.trim()) {
      return NextResponse.json({ duplicates: [] });
    }

    const supabase = createAdminClient();
    const guestLower = guest_name.trim().toLowerCase();

    let query = supabase
      .from("invoices")
      .select(`
        id,
        service_description,
        created_at,
        service_date_from,
        department_id,
        invoice_extracted_fields(beneficiary_name, gross_amount, invoice_number),
        invoice_workflows(status)
      `)
      .in("invoice_type", [invoice_type || "guest"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (department_id) {
      query = query.eq("department_id", department_id);
    }

    const { data: invoices } = await query;
    if (!invoices?.length) {
      return NextResponse.json({ duplicates: [] });
    }

    const duplicates: {
      id: string;
      guest: string;
      amount: number | null;
      date: string | null;
      status: string;
      invoice_number: string | null;
      match_reasons: string[];
    }[] = [];

    for (const inv of invoices) {
      const sd = (inv.service_description ?? "").toLowerCase();
      const ext = Array.isArray(inv.invoice_extracted_fields)
        ? inv.invoice_extracted_fields[0]
        : inv.invoice_extracted_fields;
      const wf = Array.isArray(inv.invoice_workflows)
        ? inv.invoice_workflows[0]
        : inv.invoice_workflows;

      const guestMatch = sd.includes(guestLower) ||
        (ext?.beneficiary_name?.toLowerCase().includes(guestLower));
      if (!guestMatch) continue;

      const matchReasons: string[] = ["Same guest name"];
      const invAmount = ext?.gross_amount ?? null;

      if (amount && invAmount && Math.abs(invAmount - amount) < 0.01) {
        matchReasons.push("Same amount");
      }

      if (invoice_date && inv.service_date_from) {
        const d1 = new Date(invoice_date).getTime();
        const d2 = new Date(inv.service_date_from).getTime();
        const daysDiff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 7) {
          matchReasons.push(daysDiff === 0 ? "Same date" : `Date within ${Math.round(daysDiff)} days`);
        }
      }

      const guestLine = sd.split("\n").find((l: string) => l.startsWith("guest name:"));
      const guestFromDesc = guestLine ? guestLine.split(":").slice(1).join(":").trim() : ext?.beneficiary_name ?? "Unknown";

      duplicates.push({
        id: inv.id,
        guest: guestFromDesc,
        amount: invAmount,
        date: inv.service_date_from,
        status: wf?.status ?? "submitted",
        invoice_number: ext?.invoice_number ?? null,
        match_reasons: matchReasons,
      });
    }

    const sorted = duplicates.sort((a, b) => b.match_reasons.length - a.match_reasons.length);

    return NextResponse.json({ duplicates: sorted.slice(0, 10) });
  } catch {
    return NextResponse.json({ duplicates: [] });
  }
}
