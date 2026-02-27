/**
 * Returns pending invoice counts for the current submitter (their own invoices).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type WfShape = { status: string };

function unwrap<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

const PENDING_STATUSES = [
  "submitted",
  "pending_manager",
  "approved_by_manager",
  "pending_admin",
  "ready_for_payment",
];

export async function GET() {
  try {
    const { session, profile } = await requireAuth();
    if (profile.role !== "submitter") {
      return NextResponse.json({ guestPending: 0, freelancerPending: 0, totalPending: 0 });
    }

    const userId = session.user.id;
    const supabase = createAdminClient();

    let guestPending = 0;
    let freelancerPending = 0;

    const { data: guestInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_workflows(status)")
      .in("invoice_type", ["guest", "salary"])
      .eq("submitter_user_id", userId);

    for (const inv of guestInvoices ?? []) {
      const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
      const status = wf?.status ?? "submitted";
      if (PENDING_STATUSES.includes(status)) guestPending++;
    }

    const { data: flInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_workflows(status)")
      .eq("invoice_type", "freelancer")
      .eq("submitter_user_id", userId);

    for (const inv of flInvoices ?? []) {
      const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
      const status = wf?.status ?? "submitted";
      if (PENDING_STATUSES.includes(status)) freelancerPending++;
    }

    const totalPending = guestPending + freelancerPending;

    return NextResponse.json(
      { guestPending, freelancerPending, totalPending },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    if ((err as { digest?: string })?.digest === "NEXT_REDIRECT") throw err;
    console.error("Submitter stats error:", err);
    return NextResponse.json(
      { guestPending: 0, freelancerPending: 0, totalPending: 0 },
      { status: 200 }
    );
  }
}
