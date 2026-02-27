"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

type Row = {
  id: string;
  service_description?: string | null;
  created_at: string;
  storage_path?: string | null;
  invoice_workflows: { status?: string; paid_date?: string | null; payment_reference?: string | null }[] | { status?: string; paid_date?: string | null; payment_reference?: string | null };
  invoice_extracted_fields: { beneficiary_name?: string | null; invoice_number?: string | null; invoice_date?: string | null; gross_amount?: number | null; extracted_currency?: string | null; account_number?: string | null; sort_code?: string | null }[] | { beneficiary_name?: string | null; invoice_number?: string | null; invoice_date?: string | null; gross_amount?: number | null; extracted_currency?: string | null; account_number?: string | null; sort_code?: string | null } | null;
  invoice_files?: { storage_path: string; file_name: string }[] | null;
};

function unwrap<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function fmtAmount(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null) return "—";
  const c = currency || "£";
  return `${c}${Number(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OtherInvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await fetch(`/api/other-invoices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append(`file_${i}`, files[i]);
    }
    try {
      const res = await fetch("/api/other-invoices/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as { results?: { id: string; fileName: string; error?: string }[] };
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? "Upload failed");
        return;
      }
      const results = data.results ?? [];
      const ok = results.filter((r) => r.id).length;
      const err = results.filter((r) => r.error).length;
      if (ok > 0) toast.success(`${ok} invoice(s) uploaded. AI extraction running.`);
      if (err > 0) toast.error(`${err} failed: ${results.filter((r) => r.error).map((r) => r.error).join("; ")}`);
      e.target.value = "";
      fetchList();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const markPaid = async (id: string) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/invoices/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_status: "paid",
          paid_date: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        toast.success("Marked as paid");
        fetchList();
      } else {
        toast.error(data.error ?? "Failed");
      }
    } catch {
      toast.error("Failed");
    } finally {
      setActionId(null);
    }
  };

  const bulkMarkPaid = async (ids: string[]) => {
    if (ids.length === 0) return;
    setActionId("bulk");
    try {
      const res = await fetch("/api/invoices/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_ids: ids,
          to_status: "paid",
          paid_date: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: number; failed?: { id: string; error: string }[] };
      if (res.ok) {
        const s = data.success ?? 0;
        const f = data.failed?.length ?? 0;
        if (s > 0) toast.success(`${s} marked as paid`);
        if (f > 0) toast.error(`${f} failed`);
        fetchList();
      } else {
        toast.error((data as { error?: string }).error ?? "Failed");
      }
    } catch {
      toast.error("Failed");
    } finally {
      setActionId(null);
    }
  };

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | "bulk" | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this invoice? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchList();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Delete failed");
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} invoice(s)? This cannot be undone.`)) return;
    setDeletingId("bulk");
    try {
      let ok = 0;
      let fail = 0;
      for (const id of ids) {
        const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
        if (res.ok) ok++;
        else fail++;
      }
      if (ok > 0) toast.success(`${ok} deleted`);
      if (fail > 0) toast.error(`${fail} failed`);
      setSelectedIds(new Set());
      fetchList();
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const readyIds = rows
    .filter((r) => {
      const wf = unwrap(r.invoice_workflows);
      return (wf as { status?: string })?.status === "ready_for_payment";
    })
    .map((r) => r.id);
  const selectedReady = Array.from(selectedIds).filter((id) => readyIds.includes(id));

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Other Invoices</h1>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? "Uploading..." : "Upload files"}
          </label>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Upload any invoice (PDF, DOCX, XLSX, etc.). AI extracts beneficiary, amount, date, invoice number, bank details. View, mark as paid, or delete.
      </p>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/80">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All</option>
              <option value="ready_for_payment">Pending payment</option>
              <option value="paid">Paid</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs text-gray-500">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Beneficiary, amount, invoice no..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            onClick={() => fetchList()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {selectedIds.size} selected
          </span>
          {selectedReady.length > 0 && (
            <button
              onClick={() => bulkMarkPaid(selectedReady)}
              disabled={actionId === "bulk"}
              className="ml-4 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Mark as paid
            </button>
          )}
          <button
            onClick={() => void bulkDelete()}
            disabled={deletingId === "bulk"}
            className="ml-3 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No invoices. Upload files to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(rows.map((r) => r.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Invoice / File</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Invoice #</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Beneficiary</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Purpose</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Bank details</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((r) => {
                  const wf = unwrap(r.invoice_workflows) as { status?: string; paid_date?: string | null } | null;
                  const ext = unwrap(r.invoice_extracted_fields) as { beneficiary_name?: string | null; invoice_number?: string | null; invoice_date?: string | null; gross_amount?: number | null; extracted_currency?: string | null; account_number?: string | null; sort_code?: string | null } | null;
                  const files = r.invoice_files ?? [];
                  const fileName = Array.isArray(files) && files[0] ? (files[0] as { file_name: string }).file_name : "—";
                  const status = wf?.status ?? "—";
                  const isReady = status === "ready_for_payment";
                  const bankDetails = [ext?.sort_code, ext?.account_number].filter(Boolean).join(" / ") || "—";
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const n = new Set(prev);
                              if (n.has(r.id)) n.delete(r.id);
                              else n.add(r.id);
                              return n;
                            });
                          }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/invoices/${r.id}`} className="text-sky-600 hover:underline dark:text-sky-400" title="View invoice">
                          {fileName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{ext?.invoice_number ?? "—"}</td>
                      <td className="px-4 py-2">{ext?.beneficiary_name ?? "—"}</td>
                      <td className="px-4 py-2 max-w-[180px] truncate text-gray-600 dark:text-gray-400" title={r.service_description ?? undefined}>{r.service_description ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{bankDetails}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmtAmount(ext?.gross_amount, ext?.extracted_currency)}</td>
                      <td className="px-4 py-2">{ext?.invoice_date ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            status === "paid"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                              : status === "ready_for_payment"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {status === "paid" ? "Paid" : status === "ready_for_payment" ? "Pending" : status}
                        </span>
                      </td>
                      <td className="px-4 py-2 flex flex-wrap items-center gap-2">
                        {isReady && (
                          <button
                            onClick={() => markPaid(r.id)}
                            disabled={actionId === r.id}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Mark paid
                          </button>
                        )}
                        <button
                          onClick={() => void handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                          title="Delete"
                        >
                          Delete
                        </button>
                        {status === "paid" && wf?.paid_date && (
                          <span className="text-xs text-gray-500">Paid {wf.paid_date}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
