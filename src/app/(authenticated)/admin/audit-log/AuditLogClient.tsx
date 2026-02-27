"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

type AuditRow = {
  id: number;
  invoice_id: string | null;
  salary_id: string | null;
  actor_user_id: string | null;
  actor_name: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

function escapeCsv(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function AuditLogClient() {
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceId, setInvoiceId] = useState("");
  const [actorId, setActorId] = useState("");
  const [eventType, setEventType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (invoiceId.trim()) params.set("invoice_id", invoiceId.trim());
      if (actorId.trim()) params.set("actor_id", actorId.trim());
      if (eventType.trim()) params.set("event_type", eventType.trim());
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      params.set("limit", "500");
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as AuditRow[];
      setEvents(data);
    } catch {
      toast.error("Failed to load audit log");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, actorId, eventType, fromDate, toDate]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const exportCsv = useCallback(() => {
    const headers = ["Date", "Event", "Actor", "Invoice ID", "From", "To", "Details"];
    const rows = events.map((e) => [
      new Date(e.created_at).toISOString(),
      e.event_type,
      e.actor_name,
      e.invoice_id ?? "",
      e.from_status ?? "",
      e.to_status ?? "",
      JSON.stringify(e.payload),
    ]);
    const csv = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit log exported");
  }, [events]);

  const exportExcel = useCallback(async () => {
    const XLSX = await import("xlsx");
    const rows = events.map((e) => ({
      Date: new Date(e.created_at).toISOString(),
      Event: e.event_type,
      Actor: e.actor_name,
      "Invoice ID": e.invoice_id ?? "",
      "Salary ID": e.salary_id ?? "",
      "From Status": e.from_status ?? "",
      "To Status": e.to_status ?? "",
      Details: JSON.stringify(e.payload),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
    XLSX.writeFile(wb, `audit-log-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Audit log exported");
  }, [events]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Audit Log</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Detailed activity log for compliance. Who did what, when. Admin only.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice ID</label>
            <input
              type="text"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              placeholder="Filter by invoice"
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Event type</label>
            <input
              type="text"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. status_change"
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            onClick={() => void fetchEvents()}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            Apply
          </button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={exportCsv}
              disabled={events.length === 0}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Export CSV
            </button>
            <button
              onClick={() => void exportExcel()}
              disabled={events.length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Export Excel
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">Loading…</p>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">No audit events found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Event</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Actor</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Invoice</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">From → To</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {new Date(e.created_at).toLocaleString("en-GB")}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{e.event_type}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{e.actor_name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {e.invoice_id ? (
                        <a href={`/invoices/${e.invoice_id}`} className="text-sky-600 hover:underline dark:text-sky-400">
                          {e.invoice_id.slice(0, 8)}…
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {e.from_status && e.to_status ? `${e.from_status} → ${e.to_status}` : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs text-gray-500 dark:text-gray-400" title={JSON.stringify(e.payload)}>
                      {Object.keys(e.payload).length > 0 ? JSON.stringify(e.payload) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
