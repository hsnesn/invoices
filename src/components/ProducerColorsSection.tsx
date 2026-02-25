"use client";

import { useState, useEffect, useCallback } from "react";

type ProducerColor = { producer_name: string; color_hex: string };

const PRESET_COLORS = [
  "#3A626A", "#1F8C48", "#18C868", "#65A0F8", "#E53A4C",
  "#1B81A3", "#8C5FD8", "#C2C2C2", "#28C16E", "#F9509E",
  "#E72B4D", "#0C86BB", "#8D56CE", "#C4C4C4", "#fbb042",
  "#39b54a", "#ed1c24", "#00aeef", "#006838", "#662d91",
];

export function ProducerColorsSection() {
  const [items, setItems] = useState<ProducerColor[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ producer_name: "", color_hex: "#3A626A" });
  const [newItem, setNewItem] = useState({ producer_name: "", color_hex: "#3A626A" });

  const refresh = useCallback(() => {
    fetch("/api/admin/producer-colors")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]));
    fetch("/api/admin/producer-suggestions")
      .then((r) => r.json())
      .then((d) => setSuggestions(Array.isArray(d) ? d : []))
      .catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.producer_name.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/producer-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer_name: newItem.producer_name.trim(),
          color_hex: newItem.color_hex,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setItems((prev) => [...prev.filter((p) => p.producer_name !== newItem.producer_name.trim()), data]);
        setNewItem({ producer_name: "", color_hex: "#3A626A" });
        setMessage({ type: "success", text: "Producer color assigned." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error ?? "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editForm.producer_name.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const newName = editForm.producer_name.trim();
      if (editingId !== newName) {
        const delRes = await fetch(`/api/admin/producer-colors?producer_name=${encodeURIComponent(editingId)}`, { method: "DELETE" });
        if (!delRes.ok) throw new Error("Failed to remove old entry");
      }
      const res = await fetch("/api/admin/producer-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer_name: newName,
          color_hex: editForm.color_hex,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setItems((prev) => {
          const filtered = prev.filter((p) => p.producer_name !== editingId);
          return [...filtered, data];
        });
        setEditingId(null);
        setMessage({ type: "success", text: "Producer color updated." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error ?? "Update failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async () => {
    if (!deleteId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/producer-colors?producer_name=${encodeURIComponent(deleteId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      setDeleteId(null);
      if (res.ok) {
        setItems((prev) => prev.filter((p) => p.producer_name !== deleteId));
        setMessage({ type: "success", text: "Producer color removed." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error ?? "Delete failed." });
      }
    } catch {
      setDeleteId(null);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

  return (
    <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-50/50 p-6 dark:border-blue-500/40 dark:bg-blue-950/30">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Producer badges</h3>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Assign colors to producers for badge display in the invoice list. Producers without an assigned color use a hash-based default.
      </p>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${message.type === "success" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={addItem} className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          list="producer-suggestions"
          value={newItem.producer_name}
          onChange={(e) => setNewItem((p) => ({ ...p, producer_name: e.target.value }))}
          placeholder="Producer name"
          className={`min-w-[180px] flex-1 ${inputCls}`}
        />
        <datalist id="producer-suggestions">
          {suggestions.filter((s) => !items.some((i) => i.producer_name === s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newItem.color_hex}
            onChange={(e) => setNewItem((p) => ({ ...p, color_hex: e.target.value }))}
            className="h-9 w-14 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
            title="Badge color"
          />
          <input
            type="text"
            value={newItem.color_hex}
            onChange={(e) => setNewItem((p) => ({ ...p, color_hex: e.target.value }))}
            placeholder="#3A626A"
            className={`w-24 font-mono text-sm ${inputCls}`}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {PRESET_COLORS.slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setNewItem((p) => ({ ...p, color_hex: c }))}
              className="h-6 w-6 rounded-full border-2 border-gray-300 shadow-sm hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          Assign
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
              <th className="px-4 py-3 text-left font-semibold text-gray-800 dark:text-gray-200">Color</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800 dark:text-gray-200">Producer</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.producer_name} className="border-b-2 border-gray-200 dark:border-gray-600">
                {editingId === item.producer_name ? (
                  <td colSpan={3} className="px-4 py-3">
                    <form onSubmit={saveEdit} className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        value={editForm.producer_name}
                        onChange={(e) => setEditForm((p) => ({ ...p, producer_name: e.target.value }))}
                        placeholder="Producer name"
                        className={`min-w-[180px] ${inputCls}`}
                        required
                      />
                      <input
                        type="color"
                        value={editForm.color_hex}
                        onChange={(e) => setEditForm((p) => ({ ...p, color_hex: e.target.value }))}
                        className="h-8 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
                      />
                      <input
                        type="text"
                        value={editForm.color_hex}
                        onChange={(e) => setEditForm((p) => ({ ...p, color_hex: e.target.value }))}
                        className={`w-24 font-mono text-sm ${inputCls}`}
                      />
                      <button type="submit" disabled={loading} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border-2 border-gray-400 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200 dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-700">
                        Cancel
                      </button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: item.color_hex }}
                      >
                        {item.producer_name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.producer_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.producer_name);
                            setEditForm({ producer_name: item.producer_name, color_hex: item.color_hex });
                          }}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-indigo-600 dark:hover:bg-gray-700 dark:hover:text-indigo-400"
                          title="Edit"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(item.producer_name)}
                          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeleteId(null)}>
          <div className="max-w-sm rounded-2xl border-2 border-gray-300 bg-white p-6 shadow-xl dark:border-gray-600 dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <p className="text-gray-800 dark:text-gray-200">Remove color for producer &quot;{deleteId}&quot;?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border-2 border-gray-400 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={() => void deleteItem()} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
