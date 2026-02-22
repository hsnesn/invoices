"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";

type DashboardInvoice = {
  id: string;
  created_at: string;
  status: string;
  amount: string;
  department: string;
  programme: string;
  producer: string;
  guest: string;
  paymentType: string;
  group: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending_line_manager: "#f59e0b",
  ready_for_payment: "#0ea5e9",
  paid_invoices: "#10b981",
  rejected: "#f43f5e",
  no_payment_needed: "#64748b",
};

const PIE_COLORS = ["#f59e0b", "#0ea5e9", "#10b981", "#f43f5e", "#64748b", "#8b5cf6", "#ec4899"];

export function InvoiceDashboard({ invoices }: { invoices: DashboardInvoice[] }) {
  const stats = useMemo(() => {
    const total = invoices.length;
    const pending = invoices.filter((i) => i.group === "pending_line_manager").length;
    const ready = invoices.filter((i) => i.group === "ready_for_payment").length;
    const paid = invoices.filter((i) => i.group === "paid_invoices").length;
    const rejected = invoices.filter((i) => i.group === "rejected").length;

    const totalAmount = invoices.reduce((sum, i) => {
      const n = parseFloat(i.amount);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    const paidAmount = invoices
      .filter((i) => i.group === "paid_invoices")
      .reduce((sum, i) => {
        const n = parseFloat(i.amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

    const pendingAmount = invoices
      .filter((i) => i.group === "pending_line_manager" || i.group === "ready_for_payment")
      .reduce((sum, i) => {
        const n = parseFloat(i.amount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

    const rejectionRate = total > 0 ? ((rejected / total) * 100).toFixed(1) : "0";

    return { total, pending, ready, paid, rejected, totalAmount, paidAmount, pendingAmount, rejectionRate };
  }, [invoices]);

  const statusPieData = useMemo(() => {
    const groups = ["pending_line_manager", "ready_for_payment", "paid_invoices", "rejected", "no_payment_needed"];
    const labels: Record<string, string> = {
      pending_line_manager: "Pending",
      ready_for_payment: "Ready",
      paid_invoices: "Paid",
      rejected: "Rejected",
      no_payment_needed: "No Payment",
    };
    return groups
      .map((g) => ({ name: labels[g] ?? g, value: invoices.filter((i) => i.group === g).length, color: STATUS_COLORS[g] ?? "#6b7280" }))
      .filter((d) => d.value > 0);
  }, [invoices]);

  const departmentData = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      if (i.department && i.department !== "—") {
        map.set(i.department, (map.get(i.department) ?? 0) + 1);
      }
    });
    return Array.from(map, ([name, count]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [invoices]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; count: number; amount: number }>();
    invoices.forEach((i) => {
      const d = new Date(i.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en", { month: "short", year: "2-digit" });
      const existing = map.get(key) ?? { month: label, count: 0, amount: 0 };
      existing.count += 1;
      const n = parseFloat(i.amount);
      existing.amount += Number.isFinite(n) ? n : 0;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [invoices]);

  const topProducers = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      if (i.producer && i.producer !== "—") {
        map.set(i.producer, (map.get(i.producer) ?? 0) + 1);
      }
    });
    return Array.from(map, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [invoices]);

  // Guest frequency: how often each guest appears
  const guestFrequency = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      if (i.guest && i.guest !== "—" && i.guest.trim()) {
        const g = i.guest.trim();
        map.set(g, (map.get(g) ?? 0) + 1);
      }
    });
    return Array.from(map, ([name, count]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, fullName: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [invoices]);

  // Producer–Guest pairs: which producer books which guest how often
  const producerGuestPairs = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      if (i.producer && i.producer !== "—" && i.guest && i.guest !== "—") {
        const key = `${i.producer.trim()} → ${i.guest.trim()}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    });
    return Array.from(map, ([pair, count]) => ({ pair: pair.length > 35 ? pair.slice(0, 35) + "…" : pair, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [invoices]);

  // Invoices by programme
  const programmeData = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      if (i.programme && i.programme !== "—") {
        map.set(i.programme, (map.get(i.programme) ?? 0) + 1);
      }
    });
    return Array.from(map, ([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [invoices]);

  // Department–Guest count: how many unique guests per department (or invoice count per dept - we have dept already)
  // Instead: Department with guest appearances (invoices per dept we have). Add "Guests by Department" = invoices per dept grouped (we have that)
  // Or: which department has the most guest bookings - that's essentially departmentData we have. Let me add a "Guests per Department" that counts guest appearances per dept.
  const departmentGuestCount = useMemo(() => {
    const map = new Map<string, { invoices: number; guests: Set<string> }>();
    invoices.forEach((i) => {
      if (i.department && i.department !== "—") {
        const existing = map.get(i.department) ?? { invoices: 0, guests: new Set<string>() };
        existing.invoices += 1;
        if (i.guest && i.guest !== "—") existing.guests.add(i.guest.trim());
        map.set(i.department, existing);
      }
    });
    return Array.from(map, ([name, v]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, invoiceCount: v.invoices, guestCount: v.guests.size }))
      .sort((a, b) => b.invoiceCount - a.invoiceCount)
      .slice(0, 8);
  }, [invoices]);

  // Yearly/monthly comparison vs previous year
  const yearComparison = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;
    const byYear = { [thisYear]: { count: 0, amount: 0 }, [lastYear]: { count: 0, amount: 0 } };
    invoices.forEach((i) => {
      const y = new Date(i.created_at).getFullYear();
      if (y === thisYear || y === lastYear) {
        if (!byYear[y]) byYear[y] = { count: 0, amount: 0 };
        byYear[y].count += 1;
        const n = parseFloat(i.amount);
        byYear[y].amount += Number.isFinite(n) ? n : 0;
      }
    });
    const curr = byYear[thisYear] ?? { count: 0, amount: 0 };
    const prev = byYear[lastYear] ?? { count: 0, amount: 0 };
    const countChange = prev.count > 0 ? ((curr.count - prev.count) / prev.count) * 100 : 0;
    const amountChange = prev.amount > 0 ? ((curr.amount - prev.amount) / prev.amount) * 100 : 0;
    return { thisYear, lastYear, curr, prev, countChange, amountChange };
  }, [invoices]);

  // Most expensive guests (by total amount)
  const expensiveGuests = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => {
      if (i.guest && i.guest !== "—") {
        const n = parseFloat(i.amount);
        const amt = Number.isFinite(n) ? n : 0;
        map.set(i.guest.trim(), (map.get(i.guest.trim()) ?? 0) + amt);
      }
    });
    return Array.from(map, ([name, total]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, fullName: name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [invoices]);

  // Average invoice amount by producer, department, programme
  const avgByProducer = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    invoices.forEach((i) => {
      if (i.producer && i.producer !== "—") {
        const n = parseFloat(i.amount);
        const amt = Number.isFinite(n) ? n : 0;
        const ex = map.get(i.producer) ?? { sum: 0, count: 0 };
        ex.sum += amt;
        ex.count += 1;
        map.set(i.producer, ex);
      }
    });
    return Array.from(map, ([name, v]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, avg: v.count > 0 ? v.sum / v.count : 0, count: v.count }))
      .filter((d) => d.avg > 0)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [invoices]);

  const avgByDepartment = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    invoices.forEach((i) => {
      if (i.department && i.department !== "—") {
        const n = parseFloat(i.amount);
        const amt = Number.isFinite(n) ? n : 0;
        const ex = map.get(i.department) ?? { sum: 0, count: 0 };
        ex.sum += amt;
        ex.count += 1;
        map.set(i.department, ex);
      }
    });
    return Array.from(map, ([name, v]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, avg: v.count > 0 ? v.sum / v.count : 0 }))
      .filter((d) => d.avg > 0)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [invoices]);

  const avgByProgramme = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    invoices.forEach((i) => {
      if (i.programme && i.programme !== "—") {
        const n = parseFloat(i.amount);
        const amt = Number.isFinite(n) ? n : 0;
        const ex = map.get(i.programme) ?? { sum: 0, count: 0 };
        ex.sum += amt;
        ex.count += 1;
        map.set(i.programme, ex);
      }
    });
    return Array.from(map, ([name, v]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, avg: v.count > 0 ? v.sum / v.count : 0 }))
      .filter((d) => d.avg > 0)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);
  }, [invoices]);

  const fmt = (n: number) =>
    n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Summary Cards - higher contrast */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: stats.total, color: "bg-slate-200 text-slate-900 border-2 border-slate-400 dark:bg-slate-700 dark:text-white dark:border-slate-500" },
          { label: "Pending", value: stats.pending, color: "bg-amber-200 text-amber-900 border-2 border-amber-400 dark:bg-amber-900/60 dark:text-amber-100 dark:border-amber-600" },
          { label: "Ready", value: stats.ready, color: "bg-sky-200 text-sky-900 border-2 border-sky-400 dark:bg-sky-900/60 dark:text-sky-100 dark:border-sky-600" },
          { label: "Paid", value: stats.paid, color: "bg-emerald-200 text-emerald-900 border-2 border-emerald-400 dark:bg-emerald-900/60 dark:text-emerald-100 dark:border-emerald-600" },
          { label: "Rejected", value: stats.rejected, color: "bg-rose-200 text-rose-900 border-2 border-rose-400 dark:bg-rose-900/60 dark:text-rose-100 dark:border-rose-600" },
          { label: "Reject %", value: stats.rejectionRate + "%", color: "bg-violet-200 text-violet-900 border-2 border-violet-400 dark:bg-violet-900/60 dark:text-violet-100 dark:border-violet-600" },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 shadow-lg ${c.color}`}>
            <p className="text-xs font-semibold uppercase tracking-wider">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Amount Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-200 p-4 shadow-lg dark:border-slate-500 dark:bg-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Amount</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">£{fmt(stats.totalAmount)}</p>
        </div>
        <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-200 p-4 shadow-lg dark:border-emerald-600 dark:bg-emerald-900/70">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">Paid Amount</p>
          <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-100">£{fmt(stats.paidAmount)}</p>
        </div>
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-200 p-4 shadow-lg dark:border-amber-600 dark:bg-amber-900/70">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">Pending Amount</p>
          <p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-100">£{fmt(stats.pendingAmount)}</p>
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Year-over-Year ({yearComparison.thisYear} vs {yearComparison.lastYear})</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Invoices {yearComparison.thisYear}</p>
            <p className="font-bold text-gray-900 dark:text-white">{yearComparison.curr.count}</p>
            <p className={`text-xs ${yearComparison.countChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {yearComparison.countChange >= 0 ? "+" : ""}{yearComparison.countChange.toFixed(1)}% vs last year
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Amount {yearComparison.thisYear}</p>
            <p className="font-bold text-gray-900 dark:text-white">£{fmt(yearComparison.curr.amount)}</p>
            <p className={`text-xs ${yearComparison.amountChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {yearComparison.amountChange >= 0 ? "+" : ""}{yearComparison.amountChange.toFixed(1)}% vs last year
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Invoices {yearComparison.lastYear}</p>
            <p className="font-bold text-gray-500 dark:text-gray-400">{yearComparison.prev.count}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Amount {yearComparison.lastYear}</p>
            <p className="font-bold text-gray-500 dark:text-gray-400">£{fmt(yearComparison.prev.amount)}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Pie */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Invoice Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {statusPieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Monthly Invoice Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#5034FF" strokeWidth={2} name="Count" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Department Bar */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Invoices by Department</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={departmentData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#5034FF" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Producers */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Top Producers</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProducers}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Most Booked Guests */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Most Booked Guests</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={guestFrequency} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold truncate max-w-[200px]">{(payload[0].payload as { fullName?: string }).fullName ?? payload[0].payload.name}</p>
                  <p>Appearances: {payload[0].payload.count}</p>
                </div>
              ) : null} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 8, 8, 0]} name="Appearances" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Producer–Guest Pairs */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Producer → Guest (booking frequency)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={producerGuestPairs} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="pair" width={180} tick={{ fontSize: 9 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#ec4899" radius={[0, 8, 8, 0]} name="Times booked" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Invoices by Programme */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Invoices by Programme</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={programmeData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Most Expensive Guests */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Most Expensive Guests (by total)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={expensiveGuests} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <p className="font-semibold truncate max-w-[220px]">{(payload[0].payload as { fullName?: string }).fullName ?? payload[0].payload.name}</p>
                  <p>Total: £{fmt(payload[0].payload.total)}</p>
                </div>
              ) : null} />
              <Bar dataKey="total" fill="#f43f5e" radius={[0, 8, 8, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average by Producer */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Avg Invoice by Producer</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={avgByProducer} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border bg-white px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-700">{payload[0].payload.name}: £{fmt(payload[0].value as number)}</div> : null} />
              <Bar dataKey="avg" fill="#0891b2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average by Department */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Avg Invoice by Department</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={avgByDepartment} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border bg-white px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-700">{payload[0].payload.name}: £{fmt(payload[0].value as number)}</div> : null} />
              <Bar dataKey="avg" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Average by Programme */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Avg Invoice by Programme</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={avgByProgramme} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9 }} />
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border bg-white px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-700">{payload[0].payload.name}: £{fmt(payload[0].value as number)}</div> : null} />
              <Bar dataKey="avg" fill="#ca8a04" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department: Invoices vs Unique Guests */}
        <div className="rounded-2xl border-2 border-slate-400 bg-slate-100 p-4 shadow-lg lg:col-span-2 dark:border-slate-600 dark:bg-slate-800">
          <h3 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">Department: Invoice Count vs Unique Guests</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={departmentGuestCount} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-semibold">{payload[0].payload.name}</p>
                  <p>Invoices: {payload[0].payload.invoiceCount}</p>
                  <p>Unique guests: {payload[0].payload.guestCount}</p>
                </div>
              ) : null} />
              <Bar dataKey="invoiceCount" fill="#5034FF" radius={[0, 8, 8, 0]} name="Invoices" />
              <Bar dataKey="guestCount" fill="#a78bfa" radius={[0, 8, 8, 0]} name="Unique Guests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
