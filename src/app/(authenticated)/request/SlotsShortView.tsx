"use client";

import { useState, useEffect } from "react";
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

export function SlotsShortView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(3);

  useEffect(() => {
    setLoading(true);
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
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 px-4 py-2 dark:border-rose-800 dark:bg-rose-900/20">
            <span className="font-medium text-rose-800 dark:text-rose-200">Total slots short: {total}</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden dark:border-gray-700 dark:bg-gray-900/80">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Program</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Position</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Slots Short</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{r.monthLabel}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.program}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{r.role}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-rose-600 dark:text-rose-400">{r.slots_short}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/request?month=${r.month}&dept=${r.department_id}${r.program_id ? `&program=${r.program_id}` : "&program=__all__"}`}
                          className="text-sm font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
                        >
                          Fill →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
