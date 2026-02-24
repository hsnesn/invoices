import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type WfShape = { status: string };

function unwrap<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: guestInvoices } = await supabase
      .from("invoices")
      .select("id, created_at, invoice_workflows(status)")
      .neq("invoice_type", "freelancer");

    const { data: flInvoices } = await supabase
      .from("invoices")
      .select("id, created_at, invoice_workflows(status)")
      .eq("invoice_type", "freelancer");

    const guest = (guestInvoices ?? []).reduce(
      (acc, inv) => {
        const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
        const s = wf?.status ?? "submitted";
        if (["pending_line_manager", "pending_manager", "submitted", "approved_by_manager", "pending_admin", "ready_for_payment"].includes(s))
          acc.pending++;
        else if (["paid", "archived"].includes(s)) acc.paid++;
        else if (s === "rejected") acc.rejected++;
        return acc;
      },
      { pending: 0, paid: 0, rejected: 0 }
    );

    const freelancer = (flInvoices ?? []).reduce(
      (acc, inv) => {
        const wf = unwrap(inv.invoice_workflows as WfShape[] | WfShape | null);
        const s = wf?.status ?? "submitted";
        if (["submitted", "pending_manager", "approved_by_manager", "pending_admin", "ready_for_payment"].includes(s))
          acc.pending++;
        else if (["paid", "archived"].includes(s)) acc.paid++;
        else if (s === "rejected") acc.rejected++;
        return acc;
      },
      { pending: 0, paid: 0, rejected: 0 }
    );

    // Last 6 months trend for mini chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const monthlyTrend = monthKeys.map((key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const label = start.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      const guestCount = (guestInvoices ?? []).filter((inv) => {
        const created = (inv as { created_at?: string }).created_at;
        if (!created) return false;
        const dt = new Date(created);
        return dt >= start && dt <= end;
      }).length;
      const flCount = (flInvoices ?? []).filter((inv) => {
        const created = (inv as { created_at?: string }).created_at;
        if (!created) return false;
        const dt = new Date(created);
        return dt >= start && dt <= end;
      }).length;
      return { month: label, guest: guestCount, freelancer: flCount, total: guestCount + flCount };
    });

    return NextResponse.json({
      guest: { ...guest, total: guest.pending + guest.paid + guest.rejected },
      freelancer: { ...freelancer, total: freelancer.pending + freelancer.paid + freelancer.rejected },
      monthlyTrend,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return NextResponse.json(
      {
        guest: { pending: 0, paid: 0, rejected: 0, total: 0 },
        freelancer: { pending: 0, paid: 0, rejected: 0, total: 0 },
        monthlyTrend: [],
      },
      { status: 200 }
    );
  }
}
