"use client";

import { useState, useMemo } from "react";

export type MoveGroup = { key: string; label: string; color?: string; bgHex?: string };

export function BulkMoveModal({
  groups,
  onSelect,
  onClose,
}: {
  groups: MoveGroup[];
  onSelect: (groupKey: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.label.toLowerCase().includes(q));
  }, [groups, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-600">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose group</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700"
          >
            Back
          </button>
        </div>
        <div className="p-4">
          <div className="relative mb-4">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search group"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-gray-500"
              autoFocus
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No groups found</p>
            ) : (
              filtered.map((g) => (
                <button
                  key={g.key}
                  onClick={() => onSelect(g.key)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-slate-700"
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${!g.bgHex ? (g.color ?? "bg-gray-400") : ""}`}
                    style={g.bgHex ? { backgroundColor: g.bgHex } : undefined}
                  />
                  {g.label}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
