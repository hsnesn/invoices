"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type ReportData = {
  period: string; type: string; invoiceType: string;
  summary: { totalInvoices: number; totalAmount: number; paidInvoices: number; paidAmount: number; pendingAmount: number; rejectedCount: number };
  byDepartment: Record<string, { count: number; amount: number }>;
  byStatus: Record<string, number>;
  byProducer: Record<string, { count: number; amount: number; paidCount: number; paidAmount: number; unpaidCount: number; unpaidAmount: number }>;
  byPaymentType: Record<string, { count: number; amount: number }>;
  monthlyTrend: { month: string; count: number; amount: number }[];
  yoy: { thisYear: { year: number; count: number; amount: number }; lastYear: { year: number; count: number; amount: number } };
  processing: { avg: number | null; min: number | null; max: number | null; count: number };
  topGuests: Record<string, { count: number; amount: number }>;
  rejections: { byProducer: Record<string, number>; byDepartment: Record<string, number>; reasons: Record<string, number> };
  freelancer: { byContractor: Record<string, { count: number; amount: number }>; byServiceDesc: Record<string, { count: number; amount: number }>; byBookedBy: Record<string, { count: number; amount: number }>; total: number; totalAmount: number };
  generatedAt: string; emailSent?: boolean; emailError?: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1"];

import { formatCurrencyTR, getFormatters } from "@/lib/export-locale";
import { useExportLocale } from "@/contexts/ExportLocaleContext";
import { ExportLocaleSelector } from "@/components/ExportLocaleSelector";

function fmt(v: number) { return formatCurrencyTR(v); }
function pctChange(cur: number, prev: number) { if (prev === 0) return cur > 0 ? "+100%" : "0%"; const p = ((cur - prev) / prev * 100).toFixed(1); return (cur >= prev ? "+" : "") + p + "%"; }

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export function ReportsClient() {
  const { locale: exportLocale } = useExportLocale();
  const now = new Date();
  const [reportType, setReportType] = useState<"monthly" | "quarterly" | "department" | "custom">("monthly");
  const [invoiceType, setInvoiceType] = useState<"all" | "guest" | "freelancer">("all");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "producers" | "guests" | "rejections" | "freelancer">("overview");

  const generate = useCallback(async () => {
    setLoading(true); setReport(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: reportType, year, month, quarter, invoiceType, sendEmail, emailTo: sendEmail ? emailTo : undefined, dateFrom: reportType === "custom" ? dateFrom : undefined, dateTo: reportType === "custom" ? dateTo : undefined }),
      });
      if (res.ok) { setReport(await res.json()); setActiveTab("overview"); }
      else toast.error("Failed to generate report");
    } finally { setLoading(false); }
  }, [reportType, year, month, quarter, invoiceType, sendEmail, emailTo, dateFrom, dateTo]);

  const sendReportEmail = useCallback(async () => {
    if (!emailTo.trim() || !report) return;
    setEmailSending(true);
    try {
      const res = await fetch("/api/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: reportType, year, month, quarter, invoiceType, sendEmail: true, emailTo, dateFrom: reportType === "custom" ? dateFrom : undefined, dateTo: reportType === "custom" ? dateTo : undefined }) });
      if (res.ok) { const d = await res.json(); setReport(d); d.emailSent ? toast.success("Report sent!") : toast.error(`Failed: ${d.emailError}`); }
    } finally { setEmailSending(false); }
  }, [emailTo, report, reportType, year, month, quarter, invoiceType, dateFrom, dateTo]);

  const exportPdf = useCallback(async () => {
    if (!report) return;
    const { formatDate, formatCurrency } = getFormatters(exportLocale);
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const { ensurePdfFont } = await import("@/lib/pdf-font");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    await ensurePdfFont(doc);
    const getY = () => (doc as never as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 20;
    doc.setFontSize(16); doc.text(`Invoice Report — ${report.period}`, 14, 15);
    doc.setFontSize(9); doc.text(`Type: ${report.invoiceType} | Tab: ${activeTab} | Generated: ${formatDate(report.generatedAt)}`, 14, 21);

    let startY = 26;
    if (activeTab === "overview") {
      autoTable(doc, { startY: 26, theme: "grid", headStyles: { fillColor: [59, 130, 246] }, head: [["Metric", "Value"]], body: [["Total Invoices", String(report.summary.totalInvoices)], ["Total Amount", formatCurrency(report.summary.totalAmount)], ["Paid", `${report.summary.paidInvoices} (${formatCurrency(report.summary.paidAmount)})`], ["Pending", formatCurrency(report.summary.pendingAmount)], ["Rejected", String(report.summary.rejectedCount)], ["Avg Processing", report.processing.avg != null ? `${report.processing.avg} days` : "N/A"]], styles: { font: "Roboto", fontSize: 9 } });
      const de = Object.entries(report.byDepartment).sort((a, b) => b[1].amount - a[1].amount);
      if (de.length) { let y = getY(); if (y > 240) { doc.addPage(); y = 10; } doc.setFontSize(11); doc.text("Department Breakdown", 14, y + 8); autoTable(doc, { startY: y + 11, theme: "grid", headStyles: { fillColor: [16, 185, 129] }, head: [["Department", "Count", "Amount"]], body: de.map(([d, v]) => [d, String(v.count), formatCurrency(v.amount)]), styles: { font: "Roboto", fontSize: 8 } }); }
    } else if (activeTab === "producers") {
      const pe = Object.entries(report.byProducer).sort((a, b) => b[1].amount - a[1].amount);
      if (pe.length) { doc.setFontSize(11); doc.text("Top Producers", 14, startY + 8); autoTable(doc, { startY: startY + 11, theme: "grid", headStyles: { fillColor: [124, 58, 237] }, head: [["Producer", "Total", "Amount", "Paid", "Unpaid", "Avg"]], body: pe.map(([n, d]) => [n, String(d.count), formatCurrency(d.amount), String(d.paidCount), String(d.unpaidCount), formatCurrency(d.count > 0 ? d.amount / d.count : 0)]), styles: { font: "Roboto", fontSize: 8 } }); }
    } else if (activeTab === "guests") {
      const ge = Object.entries(report.topGuests).sort((a, b) => b[1].amount - a[1].amount).slice(0, 30);
      if (ge.length) { doc.setFontSize(11); doc.text("Top Guests by Spend", 14, startY + 8); autoTable(doc, { startY: startY + 11, theme: "grid", headStyles: { fillColor: [234, 88, 12] }, head: [["Name", "Count", "Amount"]], body: ge.map(([n, d]) => [n, String(d.count), formatCurrency(d.amount)]), styles: { font: "Roboto", fontSize: 8 } }); }
    } else if (activeTab === "rejections") {
      const { rejections } = report;
      doc.setFontSize(11); doc.text("Rejection Summary", 14, startY + 8);
      autoTable(doc, { startY: startY + 11, theme: "grid", headStyles: { fillColor: [239, 68, 68] }, head: [["Metric", "Value"]], body: [["Total Rejected", String(report.summary.rejectedCount)], ["Rejection Rate", report.summary.totalInvoices > 0 ? ((report.summary.rejectedCount / report.summary.totalInvoices) * 100).toFixed(1) + "%" : "0%"]], styles: { font: "Roboto", fontSize: 9 } });
      const reasonEntries = Object.entries(rejections.reasons).sort((a, b) => b[1] - a[1]);
      if (reasonEntries.length) { let y = getY(); if (y > 240) { doc.addPage(); y = 10; } doc.setFontSize(11); doc.text("Rejection Reasons", 14, y + 8); autoTable(doc, { startY: y + 11, theme: "grid", headStyles: { fillColor: [239, 68, 68] }, head: [["Reason", "Count"]], body: reasonEntries.map(([r, c]) => [r, String(c)]), styles: { font: "Roboto", fontSize: 8 } }); }
    } else if (activeTab === "freelancer") {
      const { freelancer } = report;
      doc.setFontSize(11); doc.text("Contractor Invoices", 14, startY + 8);
      autoTable(doc, { startY: startY + 11, theme: "grid", headStyles: { fillColor: [20, 184, 166] }, head: [["Metric", "Value"]], body: [["Total", String(freelancer.total)], ["Total Amount", formatCurrency(freelancer.totalAmount)]], styles: { font: "Roboto", fontSize: 9 } });
      const contractorEntries = Object.entries(freelancer.byContractor).sort((a, b) => b[1].amount - a[1].amount).slice(0, 30);
      if (contractorEntries.length) { let y = getY(); if (y > 240) { doc.addPage(); y = 10; } doc.setFontSize(11); doc.text("Top Contractors", 14, y + 8); autoTable(doc, { startY: y + 11, theme: "grid", headStyles: { fillColor: [20, 184, 166] }, head: [["Contractor", "Count", "Amount"]], body: contractorEntries.map(([n, d]) => [n, String(d.count), formatCurrency(d.amount)]), styles: { font: "Roboto", fontSize: 8 } }); }
    }

    doc.save(`invoice-report-${report.period.replace(/\s+/g, "-")}-${activeTab}.pdf`);
  }, [report, activeTab, exportLocale]);

  const exportCsv = useCallback(() => {
    if (!report || !("rows" in report) || !Array.isArray((report as { rows?: unknown[] }).rows)) return;
    const rows = (report as { rows: { id: string; type: string; status: string; amount: number; department: string; submitter: string; contractor: string; paidDate: string | null; producer: string; paymentType: string; guest: string; rejectionReason: string | null; serviceDesc: string; bookedBy: string }[] }).rows;
    const headers = ["ID", "Type", "Status", "Amount", "Department", "Submitter", "Contractor", "Paid Date", "Producer", "Payment Type", "Guest", "Rejection Reason", "Service Desc", "Booked By"];
    const escape = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csvRows = [headers.join(","), ...rows.map((r) => [r.id, r.type, r.status, r.amount, r.department, r.submitter, r.contractor, r.paidDate ?? "", r.producer, r.paymentType, r.guest, (r.rejectionReason ?? "").replace(/"/g, '""'), r.serviceDesc, r.bookedBy].map(escape).join(","))];
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-report-${report.period.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }, [report]);

  const years = useMemo(() => { const y = new Date().getFullYear(); return Array.from({ length: 5 }, (_, i) => y - i); }, []);
  const TABS = useMemo(() => {
    const t: { key: typeof activeTab; label: string }[] = [{ key: "overview", label: "Overview" }, { key: "producers", label: "Producers" }, { key: "guests", label: "Top Guests" }, { key: "rejections", label: "Rejections" }];
    if (!report || report.invoiceType !== "guest") t.push({ key: "freelancer", label: "Contractor" });
    return t;
  }, [report]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <svg className="h-6 w-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Reports
        </h1>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Period</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as typeof reportType)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="department">Yearly</option><option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Type</label>
            <select value={invoiceType} onChange={e => setInvoiceType(e.target.value as typeof invoiceType)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="all">All Invoices</option><option value="guest">Guest Only</option><option value="freelancer">Contractor Only</option>
            </select>
          </div>
          {reportType !== "custom" && <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Year</label><select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>}
          {reportType === "monthly" && <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Month</label><select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">{MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>}
          {reportType === "quarterly" && <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quarter</label><select value={quarter} onChange={e => setQuarter(Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"><option value={1}>Q1</option><option value={2}>Q2</option><option value={3}>Q3</option><option value={4}>Q4</option></select></div>}
          {reportType === "custom" && <>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" /></div>
          </>}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />Send via email</label>
          {sendEmail && <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="recipient@example.com" className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />}
          <button onClick={() => void generate()} disabled={loading} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 shadow-sm transition-colors flex items-center gap-1.5">
            {loading ? <><Spinner />Generating...</> : "Generate Report"}
          </button>
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="space-y-4">
          {/* Title + actions */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">{report.period} — {report.invoiceType === "all" ? "All" : report.invoiceType.charAt(0).toUpperCase() + report.invoiceType.slice(1)} Invoices</h2>
            <div className="flex items-center gap-2">
              <ExportLocaleSelector />
              <button onClick={() => void exportPdf()} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 shadow-sm flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>PDF</button>
              <button onClick={exportCsv} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 shadow-sm flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>CSV</button>
              {emailTo.trim() && <button onClick={() => void sendReportEmail()} disabled={emailSending} className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50 shadow-sm flex items-center gap-1"><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>{emailSending ? "Sending..." : "Email"}</button>}
            </div>
          </div>

          {report.emailSent && <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300">Report sent to {emailTo}</div>}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {TABS.map(t => <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>{t.label}</button>)}
          </div>

          {/* TAB: Overview */}
          {activeTab === "overview" && <OverviewTab report={report} />}
          {activeTab === "producers" && <ProducersTab report={report} />}
          {activeTab === "guests" && <GuestsTab report={report} />}
          {activeTab === "rejections" && <RejectionsTab report={report} />}
          {activeTab === "freelancer" && <FreelancerTab report={report} />}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* TAB: OVERVIEW                                                       */
/* ================================================================== */

function OverviewTab({ report }: { report: ReportData }) {
  const yoyCountChange = pctChange(report.yoy.thisYear.count, report.yoy.lastYear.count);
  const yoyAmtChange = pctChange(report.yoy.thisYear.amount, report.yoy.lastYear.amount);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Total Invoices" value={String(report.summary.totalInvoices)} color="bg-blue-500" />
        <Card label="Total Amount" value={fmt(report.summary.totalAmount)} color="bg-indigo-500" />
        <Card label="Paid" value={`${report.summary.paidInvoices}`} sub={fmt(report.summary.paidAmount)} color="bg-emerald-500" />
        <Card label="Pending" value={fmt(report.summary.pendingAmount)} color="bg-amber-500" />
        <Card label="Rejected" value={String(report.summary.rejectedCount)} color="bg-red-500" />
        <Card label="Avg Processing" value={report.processing.avg != null ? `${report.processing.avg}d` : "N/A"} sub={report.processing.count > 0 ? `${report.processing.min}–${report.processing.max}d range` : undefined} color="bg-purple-500" />
      </div>

      {/* YoY comparison */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Year-over-Year Comparison</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
            <p className="text-xs text-gray-500">{report.yoy.thisYear.year}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{report.yoy.thisYear.count} <span className="text-sm font-normal">inv.</span></p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmt(report.yoy.thisYear.amount)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs text-gray-500">{report.yoy.lastYear.year}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{report.yoy.lastYear.count} <span className="text-sm font-normal">inv.</span></p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{fmt(report.yoy.lastYear.amount)}</p>
          </div>
        </div>
        <div className="mt-2 flex gap-4 text-xs">
          <span className={yoyCountChange.startsWith("+") ? "text-emerald-600" : "text-red-600"}>Invoices: {yoyCountChange}</span>
          <span className={yoyAmtChange.startsWith("+") ? "text-emerald-600" : "text-red-600"}>Amount: {yoyAmtChange}</span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Monthly trend */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={report.monthlyTrend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" tick={{ fontSize: 11 }} /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} /><Tooltip formatter={((v: number | undefined, name?: string) => [name === "amount" ? fmt(v ?? 0) : (v ?? 0), name === "amount" ? "Amount" : "Count"]) as never} /><Line yAxisId="left" type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="count" /><Line yAxisId="right" type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="amount" /></LineChart>
          </ResponsiveContainer>
        </div>
        {/* Department chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Department Spending</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.entries(report.byDepartment).sort((a, b) => b[1].amount - a[1].amount).map(([name, d]) => ({ name: name.length > 12 ? name.slice(0, 12) + "…" : name, amount: d.amount, count: d.count }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} /><Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status breakdown + Payment type */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={Object.entries(report.byStatus).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>{Object.keys(report.byStatus).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </div>
        {Object.keys(report.byPaymentType).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Guest Type</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(report.byPaymentType).map(([pt, { count, amount }]) => {
                const paid = pt === "Paid Guest";
                return <div key={pt} className={`rounded-xl border-2 p-4 ${paid ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"}`}><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pt}</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p><p className="text-sm text-gray-500">{fmt(amount)}</p></div>;
              })}
            </div>
            <div className="mt-3 rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 flex items-center justify-between text-sm"><span className="font-bold text-gray-700 dark:text-gray-300">Total</span><span className="font-bold text-gray-900 dark:text-white">{Object.values(report.byPaymentType).reduce((s, e) => s + e.count, 0)} inv. — {fmt(Object.values(report.byPaymentType).reduce((s, e) => s + e.amount, 0))}</span></div>
          </div>
        )}
      </div>

      {/* Department table */}
      <SortableTable title="Department Breakdown" icon="dept" entries={Object.entries(report.byDepartment).map(([name, d]) => ({ name, count: d.count, amount: d.amount }))} total={report.summary.totalAmount} />
    </div>
  );
}

/* ================================================================== */
/* TAB: PRODUCERS                                                      */
/* ================================================================== */

function ProducersTab({ report }: { report: ReportData }) {
  const entries = Object.entries(report.byProducer).sort((a, b) => b[1].amount - a[1].amount);
  if (entries.length === 0) return <Empty text="No producer data available for this period." />;
  const maxAmt = entries[0]?.[1]?.amount ?? 1;
  const totals = entries.reduce((a, [, d]) => ({ c: a.c + d.count, a: a.a + d.amount, pc: a.pc + d.paidCount, pa: a.pa + d.paidAmount, uc: a.uc + d.unpaidCount, ua: a.ua + d.unpaidAmount }), { c: 0, a: 0, pc: 0, pa: 0, uc: 0, ua: 0 });

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700"><h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Top Producers</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">#</th><th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Producer</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Total</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Amount</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Paid</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Paid Amt</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Unpaid</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Unpaid Amt</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Avg</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{entries.map(([name, d], i) => <tr key={name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="px-4 py-2 text-gray-400">{i + 1}</td><td className="px-4 py-2"><div className="flex items-center gap-2"><InitialBadge name={name} /><span className="font-medium text-gray-800 dark:text-gray-200">{name}</span></div></td><td className="px-4 py-2 text-right font-semibold">{d.count}</td><td className="px-4 py-2 text-right font-bold">{fmt(d.amount)}</td><td className="px-4 py-2 text-right text-emerald-700 dark:text-emerald-400">{d.paidCount}</td><td className="px-4 py-2 text-right text-emerald-700 dark:text-emerald-400">{fmt(d.paidAmount)}</td><td className="px-4 py-2 text-right text-slate-500">{d.unpaidCount}</td><td className="px-4 py-2 text-right text-slate-500">{fmt(d.unpaidAmount)}</td><td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">{fmt(d.count > 0 ? d.amount / d.count : 0)}</td></tr>)}</tbody>
            <tfoot><tr className="bg-slate-50 dark:bg-slate-700/50 font-bold"><td className="px-4 py-2"></td><td className="px-4 py-2">Total ({entries.length})</td><td className="px-4 py-2 text-right">{totals.c}</td><td className="px-4 py-2 text-right">{fmt(totals.a)}</td><td className="px-4 py-2 text-right text-emerald-700">{totals.pc}</td><td className="px-4 py-2 text-right text-emerald-700">{fmt(totals.pa)}</td><td className="px-4 py-2 text-right text-slate-500">{totals.uc}</td><td className="px-4 py-2 text-right text-slate-500">{fmt(totals.ua)}</td><td className="px-4 py-2 text-right text-blue-600">{fmt(totals.c > 0 ? totals.a / totals.c : 0)}</td></tr></tfoot>
          </table>
        </div>
      </div>

      {/* Visual comparison */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">Producer Comparison</h3>
        <div className="space-y-3">
          {entries.map(([name, data]) => {
            const paidPct = data.amount > 0 ? (data.paidAmount / data.amount) * 100 : 0;
            const barW = (data.amount / maxAmt) * 100;
            return <div key={name}><div className="flex items-center justify-between mb-1"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">{name}</span><span className="text-sm font-bold text-gray-900 dark:text-white">{fmt(data.amount)} ({data.count})</span></div><div className="h-5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" style={{ width: `${barW}%`, minWidth: 50 }}><div className="h-full flex"><div className="bg-emerald-500 h-full" style={{ width: `${paidPct}%` }} /><div className="bg-slate-300 dark:bg-slate-500 h-full" style={{ width: `${100 - paidPct}%` }} /></div></div></div>;
          })}
          <div className="flex gap-4 text-xs text-gray-500 mt-2"><span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-emerald-500" />Paid</span><span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-slate-300" />Unpaid</span></div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* TAB: TOP GUESTS                                                     */
/* ================================================================== */

function GuestsTab({ report }: { report: ReportData }) {
  const entries = Object.entries(report.topGuests).sort((a, b) => b[1].amount - a[1].amount);
  if (entries.length === 0) return <Empty text="No guest data for this period." />;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700"><h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Top Guests by Spend</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">#</th><th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Name</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Invoices</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Amount</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Avg</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{entries.slice(0, 30).map(([name, d], i) => <tr key={name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="px-4 py-2 text-gray-400">{i + 1}</td><td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{name}</td><td className="px-4 py-2 text-right">{d.count}</td><td className="px-4 py-2 text-right font-bold">{fmt(d.amount)}</td><td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400">{fmt(d.count > 0 ? d.amount / d.count : 0)}</td></tr>)}</tbody>
            <tfoot><tr className="bg-slate-50 dark:bg-slate-700/50 font-bold"><td className="px-4 py-2" colSpan={2}>Total ({entries.length})</td><td className="px-4 py-2 text-right">{entries.reduce((s, [, d]) => s + d.count, 0)}</td><td className="px-4 py-2 text-right">{fmt(entries.reduce((s, [, d]) => s + d.amount, 0))}</td><td className="px-4 py-2"></td></tr></tfoot>
          </table>
        </div>
      </div>
      {entries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Top 10 by Amount</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, Math.min(entries.length, 10) * 32)}>
            <BarChart layout="vertical" data={entries.slice(0, 10).map(([name, d]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, amount: d.amount }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} /><Bar dataKey="amount" fill="#f59e0b" radius={[0, 4, 4, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* TAB: REJECTIONS                                                     */
/* ================================================================== */

function RejectionsTab({ report }: { report: ReportData }) {
  const { rejections } = report;
  const hasData = Object.keys(rejections.reasons).length > 0 || Object.keys(rejections.byProducer).length > 0;
  if (!hasData) return <Empty text="No rejected invoices in this period." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card label="Total Rejected" value={String(report.summary.rejectedCount)} color="bg-red-500" />
        <Card label="Rejection Rate" value={report.summary.totalInvoices > 0 ? ((report.summary.rejectedCount / report.summary.totalInvoices) * 100).toFixed(1) + "%" : "0%"} color="bg-orange-500" />
        <Card label="Unique Reasons" value={String(Object.keys(rejections.reasons).length)} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Object.keys(rejections.reasons).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Rejection Reasons</h3>
            <div className="space-y-2">{Object.entries(rejections.reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => <div key={reason} className="flex items-start justify-between gap-2"><span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{reason}</span><span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900 dark:text-red-300">{count}</span></div>)}</div>
          </div>
        )}
        {Object.keys(rejections.byProducer).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Rejections by Producer</h3>
            <ResponsiveContainer width="100%" height={Math.max(150, Object.keys(rejections.byProducer).length * 30)}>
              <BarChart layout="vertical" data={Object.entries(rejections.byProducer).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {Object.keys(rejections.byDepartment).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Rejections by Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={Object.entries(rejections.byDepartment).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* TAB: FREELANCER                                                     */
/* ================================================================== */

function FreelancerTab({ report }: { report: ReportData }) {
  const { freelancer } = report;
  if (freelancer.total === 0) return <Empty text="No freelancer invoices in this period." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Contractor Invoices" value={String(freelancer.total)} color="bg-teal-500" />
        <Card label="Total Amount" value={fmt(freelancer.totalAmount)} color="bg-cyan-500" />
        <Card label="Contractors" value={String(Object.keys(freelancer.byContractor).length)} color="bg-indigo-500" />
        <Card label="Avg/Invoice" value={freelancer.total > 0 ? fmt(freelancer.totalAmount / freelancer.total) : "—"} color="bg-violet-500" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SortableTable title="Top Contractors" icon="user" entries={Object.entries(freelancer.byContractor).map(([name, d]) => ({ name, count: d.count, amount: d.amount }))} total={freelancer.totalAmount} />
        <SortableTable title="By Service Description" icon="tag" entries={Object.entries(freelancer.byServiceDesc).map(([name, d]) => ({ name, count: d.count, amount: d.amount }))} total={freelancer.totalAmount} />
      </div>

      {Object.keys(report.byDepartment).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Spending by Department</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.entries(report.byDepartment).sort((a, b) => b[1].amount - a[1].amount).map(([name, d]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, amount: d.amount, count: d.count }))}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: number | undefined) => fmt(v ?? 0)} /><Bar dataKey="amount" fill="#06b6d4" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* SHARED SUB-COMPONENTS                                               */
/* ================================================================== */

function Card({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800"><div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${color} text-white shadow-sm`}><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" /></svg></div><p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>{sub && <p className="text-[11px] text-gray-400">{sub}</p>}<p className="text-xs text-gray-500 dark:text-gray-400">{label}</p></div>;
}

function SortableTable({ title, entries, total }: { title: string; icon: string; entries: { name: string; count: number; amount: number }[]; total: number }) {
  const sorted = [...entries].sort((a, b) => b.amount - a.amount);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700"><h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{title}</h3></div>
      <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Name</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Count</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Amount</th><th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">%</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">{sorted.map(e => <tr key={e.name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{e.name}</td><td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">{e.count}</td><td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-gray-200">{fmt(e.amount)}</td><td className="px-4 py-2 text-right text-gray-500">{total > 0 ? ((e.amount / total) * 100).toFixed(1) : 0}%</td></tr>)}</tbody>
        <tfoot><tr className="bg-slate-50 dark:bg-slate-700/50 font-bold"><td className="px-4 py-2">Total</td><td className="px-4 py-2 text-right">{sorted.reduce((s, e) => s + e.count, 0)}</td><td className="px-4 py-2 text-right">{fmt(sorted.reduce((s, e) => s + e.amount, 0))}</td><td className="px-4 py-2 text-right">100%</td></tr></tfoot>
      </table>
    </div>
  );
}

function InitialBadge({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const colors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500", "bg-pink-500", "bg-teal-500"];
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length;
  return <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${colors[idx]}`}>{initials || "?"}</span>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-slate-600 dark:bg-slate-800">{text}</div>; }

function Spinner() { return <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" /></svg>; }
