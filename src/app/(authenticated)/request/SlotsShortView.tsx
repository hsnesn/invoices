"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Row = {
  month: string;
  monthLabel: string;
  department_id: string;
  department: string;
  program_id: string | null;
  program: string;
  role: string;
  slots_short: number;
};

function rowKey(r: Row): string {
  return `${r.month}-${r.department_id}-${r.program_id ?? "all"}-${r.role}`;
}

export function SlotsShortView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const refresh = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch(`/api/contractor-availability/slots-short-overview?months=${months}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [months]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(r: Row) {
    if (!confirm(`Remove demand for ${r.role} in ${r.monthLabel} (${r.department} / ${r.program})?`)) return;
    const key = rowKey(r);
    setDeletingId(key);
    try {
      const res = await fetch("/api/contractor-availability/requirements/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_role",
          to_month: r.month,
          department_id: r.department_id,
          program_id: r.program_id || undefined,
          role: r.role,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Delete failed");
      }
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      // Optimistic update: remove row immediately, refresh in background
      setRows((prev) => prev.filter((x) => rowKey(x) !== key));
      setTotal((prev) => prev - r.slots_short);
      setDeletingId(null);
      refresh(true); // Background refresh to sync with server
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleBulkDelete() {
    const toDelete = rows.filter((r) => selectedKeys.has(rowKey(r)));
    if (toDelete.length === 0) return;
    if (!confirm(`Remove demand for ${toDelete.length} selected slot(s)?`)) return;
    setBulkDeleting(true);
    const keysToRemove = new Set(toDelete.map((r) => rowKey(r)));
    const removedTotal = toDelete.reduce((s, r) => s + r.slots_short, 0);
    try {
      const res = await fetch("/api/contractor-availability/requirements/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_roles_bulk",
          items: toDelete.map((r) => ({
            to_month: r.month,
            department_id: r.department_id,
            program_id: r.program_id || undefined,
            role: r.role,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Bulk delete failed");
      }
      setSelectedKeys(new Set());
      setRows((prev) => prev.filter((x) => !keysToRemove.has(rowKey(x))));
      setTotal((prev) => prev - removedTotal);
      refresh(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkDeleting(false);
    }
  }

  const allSelected = rows.length > 0 && rows.every((r) => selectedKeys.has(rowKey(r)));
  const someSelected = selectedKeys.size > 0;
  const toggleAll = () => {
    if (allSelected) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(rows.map((r) => rowKey(r))));
  };
  const toggleRow = (r: Row) => {
    const key = rowKey(r);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Slots Short — All Months, Departments, Positions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Consolidated view of unfilled demand across months, departments, programs, and roles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Months ahead:</label>
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value, 10))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <Link
            href="/request"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Back to Requirements
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900/80">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900/80">
          <p className="text-gray-500">No slots short in the selected period.</p>
          <Link href="/request" className="mt-4 inline-block text-sm text-violet-600 hover:underline">Go to Requirements</Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-2 dark:border-rose-800 dark:bg-rose-900/20">
              <span className="font-medium text-rose-800 dark:text-rose-200">Total slots short: {total}</span>
            </div>
            {someSelected && (
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="rounded-lg border border-rose-300 bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-200 disabled:opacity-50 dark:border-rose-700 dark:bg-rose-900/50 dark:text-rose-200 dark:hover:bg-rose-900/70"
              >
                {bulkDeleting ? "Deleting…" : `Delete selected (${selectedKeys.size})`}
              </button>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700 dark:bg-gray-900/80">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-700"
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Program</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Position</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Slots Short</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((r, i) => {
                    const key = rowKey(r);
                    return (
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => toggleRow(r)}
                          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-700"
                          aria-label={`Select ${r.role} in ${r.monthLabel}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{r.monthLabel}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.program}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.role}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-rose-600 dark:text-rose-400">{r.slots_short}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/request?month=${r.month}&dept=${r.department_id}${r.program_id ? `&program=${r.program_id}` : "&program=__all__"}`}
                            className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
                          >
                            Fill →
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            disabled={deletingId === key}
                            className="text-sm font-medium text-rose-600 hover:text-rose-500 disabled:opacity-50 dark:text-rose-400 dark:hover:text-rose-300"
                          >
                            {deletingId === key ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
