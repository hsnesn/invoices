import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/salaries/stats - Salary dashboard stats (admin, operations, finance) */
export async function GET() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin" && profile.role !== "operations" && profile.role !== "finance") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data: salaries } = await supabase
      .from("salaries")
      .select("status, net_pay, employer_total_cost, payment_month, payment_year, created_at");

    const list = salaries ?? [];
    const pending = list.filter((s) => s.status === "pending" || s.status === "needs_review");
    const paid = list.filter((s) => s.status === "paid");

    const pendingNetTotal = pending.reduce((sum, s) => sum + (Number(s.net_pay) || 0), 0);
    const pendingCostTotal = pending.reduce((sum, s) => sum + (Number(s.employer_total_cost) || 0), 0);
    const paidNetTotal = paid.reduce((sum, s) => sum + (Number(s.net_pay) || 0), 0);
    const paidCostTotal = paid.reduce((sum, s) => sum + (Number(s.employer_total_cost) || 0), 0);

    const byMonth: Record<string, { count: number; netTotal: number; costTotal: number }> = {};
    for (const s of list) {
      const key = s.payment_month && s.payment_year ? `${s.payment_year}-${s.payment_month}` : "unknown";
      if (!byMonth[key]) byMonth[key] = { count: 0, netTotal: 0, costTotal: 0 };
      byMonth[key].count++;
      byMonth[key].netTotal += Number(s.net_pay) || 0;
      byMonth[key].costTotal += Number(s.employer_total_cost) || 0;
    }

    const monthlyTrend = Object.entries(byMonth)
      .filter(([k]) => k !== "unknown")
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([monthKey, v]) => ({
        month: monthKey,
        count: v.count,
        netTotal: Math.round(v.netTotal * 100) / 100,
        costTotal: Math.round(v.costTotal * 100) / 100,
      }));

    return NextResponse.json({
      pending: { count: pending.length, netTotal: pendingNetTotal, costTotal: pendingCostTotal },
      paid: { count: paid.length, netTotal: paidNetTotal, costTotal: paidCostTotal },
      total: { count: list.length },
      monthlyTrend,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
