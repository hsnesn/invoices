"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";

type DashboardInvoice = {
  id: string;
  created_at: string;
  status: string;
  amount: number;
  group: string;
  beneficiary: string;
  submittedBy: string;
};

const STATUS_COLORS: Record<string, string> = {
  ready_for_payment: "#0ea5e9",
  paid: "#10b981",
  archived: "#6b7280",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

export function OtherDashboard({ invoices }: { invoices: DashboardInvoice[] }) {
  const fmt = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stats = useMemo(() => {
    const total = invoices.length;
    const pending = invoices.filter((i) => i.group === "ready_for_payment").length;
    const paid = invoices.filter((i) => i.group === "paid").length;
    const totalAmt = invoices.reduce((s, i) => s + (Number.isFinite(i.amount) ? i.amount : 0), 0);
    const paidAmt = invoices.filter((i) => i.group === "paid").reduce((s, i) => s + (Number.isFinite(i.amount) ? i.amount : 0), 0);
    const pendingAmt = invoices.filter((i) => i.group === "ready_for_payment").reduce((s, i) => s + (Number.isFinite(i.amount) ? i.amount : 0), 0);
    return { total, pending, paid, totalAmt, paidAmt, pendingAmt };
  }, [invoices]);

  const statusPie = useMemo(() => {
    const gs = [
      { key: "ready_for_payment", label: "Pending" },
      { key: "paid", label: "Paid" },
      { key: "archived", label: "Archived" },
    ];
    return gs
      .map((g) => ({ name: g.label, value: invoices.filter((i) => i.group === g.key).length, color: STATUS_COLORS[g.key] ?? "#6b7280" }))
      .filter((d) => d.value > 0);
  }, [invoices]);

  const monthlyData = useMemo(() => {
    const m = new Map<string, { month: string; count: number; amount: number }>();
    invoices.forEach((i) => {
      const d = new Date(i.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en", { month: "short", year: "2-digit" });
      const e = m.get(key) ?? { month: label, count: 0, amount: 0 };
      e.count++;
      e.amount += Number.isFinite(i.amount) ? i.amount : 0;
      m.set(key, e);
    });
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [invoices]);

  const topBeneficiaries = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    invoices.forEach((i) => {
      if (i.beneficiary && i.beneficiary !== "—") {
        const e = m.get(i.beneficiary) ?? { count: 0, total: 0 };
        e.count++;
        e.total += Number.isFinite(i.amount) ? i.amount : 0;
        m.set(i.beneficiary, e);
      }
    });
    return Array.from(m, ([name, v]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, fullName: name, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [invoices]);

  const topSubmittedBy = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach((i) => {
      if (i.submittedBy && i.submittedBy !== "—") m.set(i.submittedBy, (m.get(i.submittedBy) ?? 0) + 1);
    });
    return Array.from(m, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, cls: "bg-slate-200 text-slate-900 border-2 border-slate-400 dark:bg-slate-700 dark:text-white dark:border-slate-500" },
          { label: "Pending", value: stats.pending, cls: "bg-amber-200 text-amber-900 border-2 border-amber-400 dark:bg-amber-900/60 dark:text-amber-100 dark:border-amber-600" },
          { label: "Paid", value: stats.paid, cls: "bg-emerald-200 text-emerald-900 border-2 border-emerald-400 dark:bg-emerald-900/60 dark:text-emerald-100 dark:border-emerald-600" },
          { label: "Total Amount", value: `£${fmt(stats.totalAmt)}`, cls: "bg-sky-200 text-sky-900 border-2 border-sky-400 dark:bg-sky-900/60 dark:text-sky-100 dark:border-sky-600" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 shadow-lg ${c.cls}`}>
            <p className="text-xs font-semibold uppercase tracking-wider">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-200 p-4 shadow-lg dark:border-slate-500 dark:bg-slate-700">
          <p className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">Total Amount</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">£{fmt(stats.totalAmt)}</p>
        </div>
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-200 p-4 shadow-lg dark:border-emerald-600 dark:bg-emerald-900/70">
          <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-200">Paid Amount</p>
          <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">£{fmt(stats.paidAmt)}</p>
        </div>
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-200 p-4 shadow-lg dark:border-amber-600 dark:bg-amber-900/70">
          <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">Pending Amount</p>
          <p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-100">£{fmt(stats.pendingAmt)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Status Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {statusPie.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Trend">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#5034FF" radius={[8, 8, 0, 0]} name="Count" />
              <Bar dataKey="amount" fill="#10b981" radius={[8, 8, 0, 0]} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Beneficiaries (by spend)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topBeneficiaries} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="rounded border bg-white px-2 py-1 text-xs shadow dark:bg-gray-800 dark:border-gray-700">
                      <p className="font-semibold">{payload[0].payload.fullName}</p>
                      <p>Total: £{fmt(payload[0].payload.total)}</p>
                      <p>{payload[0].payload.count} invoices</p>
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="total" fill="#f43f5e" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Submitted By">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topSubmittedBy}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
