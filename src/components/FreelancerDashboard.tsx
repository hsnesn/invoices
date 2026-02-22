"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";

type DashboardInvoice = {
  id: string; created_at: string; status: string; amount: string;
  department: string; contractor: string; bookedBy: string;
  month: string; group: string; serviceDescription: string;
};

const STATUS_COLORS: Record<string, string> = {
  submitted: "#f59e0b", rejected: "#f43f5e", admin_approvals: "#f97316",
  ready_for_payment: "#0ea5e9", paid: "#10b981",
};

const PIE_COLORS = ["#f59e0b", "#f43f5e", "#f97316", "#0ea5e9", "#10b981", "#8b5cf6", "#ec4899"];

export function FreelancerDashboard({ invoices }: { invoices: DashboardInvoice[] }) {
  const fmt = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stats = useMemo(() => {
    const total = invoices.length;
    const pending = invoices.filter(i => i.group === "submitted").length;
    const adminPending = invoices.filter(i => i.group === "admin_approvals").length;
    const ready = invoices.filter(i => i.group === "ready_for_payment").length;
    const paid = invoices.filter(i => i.group === "paid").length;
    const rejected = invoices.filter(i => i.group === "rejected").length;
    const totalAmt = invoices.reduce((s, i) => { const n = parseFloat(i.amount); return s + (Number.isFinite(n) ? n : 0); }, 0);
    const paidAmt = invoices.filter(i => i.group === "paid").reduce((s, i) => { const n = parseFloat(i.amount); return s + (Number.isFinite(n) ? n : 0); }, 0);
    const pendingAmt = invoices.filter(i => ["submitted", "admin_approvals", "ready_for_payment"].includes(i.group)).reduce((s, i) => { const n = parseFloat(i.amount); return s + (Number.isFinite(n) ? n : 0); }, 0);
    const rejRate = total > 0 ? ((rejected / total) * 100).toFixed(1) : "0";
    return { total, pending, adminPending, ready, paid, rejected, totalAmt, paidAmt, pendingAmt, rejRate };
  }, [invoices]);

  const statusPie = useMemo(() => {
    const gs: { key: string; label: string }[] = [
      { key: "submitted", label: "Submitted" }, { key: "rejected", label: "Rejected" },
      { key: "admin_approvals", label: "Admin" }, { key: "ready_for_payment", label: "Ready" },
      { key: "paid", label: "Paid" },
    ];
    return gs.map(g => ({ name: g.label, value: invoices.filter(i => i.group === g.key).length, color: STATUS_COLORS[g.key] ?? "#6b7280" })).filter(d => d.value > 0);
  }, [invoices]);

  const departmentData = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>();
    invoices.forEach(i => { if (i.department !== "—") { const e = m.get(i.department) ?? { count: 0, amount: 0 }; e.count++; const n = parseFloat(i.amount); e.amount += Number.isFinite(n) ? n : 0; m.set(i.department, e); } });
    return Array.from(m, ([name, v]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, count: v.count, amount: v.amount })).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [invoices]);

  const monthlyData = useMemo(() => {
    const m = new Map<string, { month: string; count: number; amount: number }>();
    invoices.forEach(i => {
      const d = new Date(i.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en", { month: "short", year: "2-digit" });
      const e = m.get(key) ?? { month: label, count: 0, amount: 0 };
      e.count++; const n = parseFloat(i.amount); e.amount += Number.isFinite(n) ? n : 0;
      m.set(key, e);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [invoices]);

  const topContractors = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    invoices.forEach(i => { if (i.contractor !== "—") { const e = m.get(i.contractor) ?? { count: 0, total: 0 }; e.count++; const n = parseFloat(i.amount); e.total += Number.isFinite(n) ? n : 0; m.set(i.contractor, e); } });
    return Array.from(m, ([name, v]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, fullName: name, count: v.count, total: v.total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [invoices]);

  const topBookedBy = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach(i => { if (i.bookedBy !== "—") m.set(i.bookedBy, (m.get(i.bookedBy) ?? 0) + 1); });
    return Array.from(m, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [invoices]);

  const serviceDescData = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach(i => { if (i.serviceDescription !== "—") m.set(i.serviceDescription, (m.get(i.serviceDescription) ?? 0) + 1); });
    return Array.from(m, ([name, count]) => ({ name: name.length > 25 ? name.slice(0, 25) + "…" : name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [invoices]);

  const serviceMonthData = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach(i => { if (i.month !== "—") m.set(i.month, (m.get(i.month) ?? 0) + 1); });
    const order = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return Array.from(m, ([name, count]) => ({ name: name.slice(0, 3), fullName: name, count })).sort((a, b) => order.indexOf(a.fullName) - order.indexOf(b.fullName));
  }, [invoices]);

  const avgByDept = useMemo(() => {
    const m = new Map<string, { sum: number; count: number }>();
    invoices.forEach(i => { if (i.department !== "—") { const e = m.get(i.department) ?? { sum: 0, count: 0 }; const n = parseFloat(i.amount); e.sum += Number.isFinite(n) ? n : 0; e.count++; m.set(i.department, e); } });
    return Array.from(m, ([name, v]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, avg: v.count > 0 ? v.sum / v.count : 0 })).filter(d => d.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 8);
  }, [invoices]);

  const yearComp = useMemo(() => {
    const ty = new Date().getFullYear(); const ly = ty - 1;
    const by: Record<number, { count: number; amount: number }> = { [ty]: { count: 0, amount: 0 }, [ly]: { count: 0, amount: 0 } };
    invoices.forEach(i => { const y = new Date(i.created_at).getFullYear(); if (y === ty || y === ly) { by[y].count++; const n = parseFloat(i.amount); by[y].amount += Number.isFinite(n) ? n : 0; } });
    const cc = by[ty]; const pc = by[ly];
    return { ty, ly, curr: cc, prev: pc, countPct: pc.count > 0 ? ((cc.count - pc.count) / pc.count) * 100 : 0, amtPct: pc.amount > 0 ? ((cc.amount - pc.amount) / pc.amount) * 100 : 0 };
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: stats.total, cls: "bg-slate-200 text-slate-900 border-2 border-slate-400 dark:bg-slate-700 dark:text-white dark:border-slate-500" },
          { label: "Submitted", value: stats.pending, cls: "bg-amber-200 text-amber-900 border-2 border-amber-400 dark:bg-amber-900/60 dark:text-amber-100 dark:border-amber-600" },
          { label: "Ready", value: stats.ready, cls: "bg-sky-200 text-sky-900 border-2 border-sky-400 dark:bg-sky-900/60 dark:text-sky-100 dark:border-sky-600" },
          { label: "Paid", value: stats.paid, cls: "bg-emerald-200 text-emerald-900 border-2 border-emerald-400 dark:bg-emerald-900/60 dark:text-emerald-100 dark:border-emerald-600" },
          { label: "Rejected", value: stats.rejected, cls: "bg-rose-200 text-rose-900 border-2 border-rose-400 dark:bg-rose-900/60 dark:text-rose-100 dark:border-rose-600" },
          { label: "Reject %", value: stats.rejRate + "%", cls: "bg-violet-200 text-violet-900 border-2 border-violet-400 dark:bg-violet-900/60 dark:text-violet-100 dark:border-violet-600" },
        ].map(c => <div key={c.label} className={`rounded-2xl border p-4 shadow-lg ${c.cls}`}><p className="text-xs font-semibold uppercase tracking-wider">{c.label}</p><p className="mt-1 text-2xl font-bold">{c.value}</p></div>)}
      </div>

      {/* Amount Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-200 p-4 shadow-lg dark:border-slate-500 dark:bg-slate-700"><p className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">Total Amount</p><p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">£{fmt(stats.totalAmt)}</p></div>
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-200 p-4 shadow-lg dark:border-emerald-600 dark:bg-emerald-900/70"><p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-200">Paid Amount</p><p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">£{fmt(stats.paidAmt)}</p></div>
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-200 p-4 shadow-lg dark:border-amber-600 dark:bg-amber-900/70"><p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">Pending Amount</p><p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-100">£{fmt(stats.pendingAmt)}</p></div>
      </div>

      {/* Year Comparison */}
      <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Year-over-Year ({yearComp.ty} vs {yearComp.ly})</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><p className="text-xs text-gray-500">Invoices {yearComp.ty}</p><p className="font-bold text-gray-900 dark:text-white">{yearComp.curr.count}</p><p className={`text-xs ${yearComp.countPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>{yearComp.countPct >= 0 ? "+" : ""}{yearComp.countPct.toFixed(1)}%</p></div>
          <div><p className="text-xs text-gray-500">Amount {yearComp.ty}</p><p className="font-bold text-gray-900 dark:text-white">£{fmt(yearComp.curr.amount)}</p><p className={`text-xs ${yearComp.amtPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>{yearComp.amtPct >= 0 ? "+" : ""}{yearComp.amtPct.toFixed(1)}%</p></div>
          <div><p className="text-xs text-gray-500">Invoices {yearComp.ly}</p><p className="font-bold text-gray-500">{yearComp.prev.count}</p></div>
          <div><p className="text-xs text-gray-500">Amount {yearComp.ly}</p><p className="font-bold text-gray-500">£{fmt(yearComp.prev.amount)}</p></div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Invoice Status Distribution">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart><Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>{statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Legend /><Tooltip /></PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Trend">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#5034FF" strokeWidth={2} name="Count" /><Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} name="Amount" yAxisId={0} /></LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Spend by Department">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={departmentData} layout="vertical"><XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} /><Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border bg-white px-2 py-1 text-xs shadow dark:bg-gray-800 dark:border-gray-700"><p className="font-semibold">{payload[0].payload.name}</p><p>£{fmt(payload[0].payload.amount)}</p><p>{payload[0].payload.count} invoices</p></div> : null} /><Bar dataKey="amount" fill="#5034FF" radius={[0, 8, 8, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top Contractors (by spend)">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topContractors} layout="vertical"><XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} /><Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border bg-white px-2 py-1 text-xs shadow dark:bg-gray-800 dark:border-gray-700"><p className="font-semibold">{payload[0].payload.fullName}</p><p>Total: £{fmt(payload[0].payload.total)}</p><p>{payload[0].payload.count} invoices</p></div> : null} /><Bar dataKey="total" fill="#f43f5e" radius={[0, 8, 8, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Bookings by Person">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topBookedBy}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Service Description Breakdown">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={serviceDescData} layout="vertical"><XAxis type="number" tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 9 }} /><Tooltip /><Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Invoices by Service Month">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={serviceMonthData}><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border bg-white px-2 py-1 text-xs shadow dark:bg-gray-800 dark:border-gray-700">{payload[0].payload.fullName}: {payload[0].payload.count}</div> : null} /><Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Avg Invoice Amount by Department">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={avgByDept} layout="vertical"><XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} /><Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border bg-white px-2 py-1 text-xs shadow dark:bg-gray-800 dark:border-gray-700">{payload[0].payload.name}: £{fmt(payload[0].value as number)}</div> : null} /><Bar dataKey="avg" fill="#7c3aed" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {children}
    </div>
  );
}
