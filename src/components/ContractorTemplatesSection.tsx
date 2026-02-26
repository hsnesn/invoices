"use client";

import { useState, useEffect } from "react";

type Template = {
  id: string;
  name: string;
  name_aliases: string[] | null;
  account_number: string | null;
  sort_code: string | null;
  beneficiary_name: string | null;
  company_name: string | null;
  sort_order: number;
};

export function ContractorTemplatesSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    name_aliases: "",
    account_number: "",
    sort_code: "",
    beneficiary_name: "",
    company_name: "",
  });

  const refresh = () => {
    fetch("/api/admin/contractor-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => setTemplates([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      name_aliases: "",
      account_number: "",
      sort_code: "",
      beneficiary_name: "",
      company_name: "",
    });
    setEditing(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const aliases = form.name_aliases
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const body = editing
        ? { id: editing.id, ...form, name_aliases: aliases }
        : { ...form, name_aliases: aliases };
      const res = await fetch("/api/admin/contractor-templates", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        refresh();
        resetForm();
        setMessage({ type: "success", text: editing ? "Updated." : "Added." });
      } else {
        setMessage({ type: "error", text: data.error || "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (t: Template) => {
    setEditing(t);
    setForm({
      name: t.name,
      name_aliases: (t.name_aliases ?? []).join(", "),
      account_number: t.account_number ?? "",
      sort_code: t.sort_code ?? "",
      beneficiary_name: t.beneficiary_name ?? "",
      company_name: t.company_name ?? "",
    });
  };

  const doDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/contractor-templates?id=${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        refresh();
        setDeleteId(null);
        setMessage({ type: "success", text: "Deleted." });
      } else {
        const d = await res.json();
        setMessage({ type: "error", text: d.error || "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-teal-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
        Contractor / Beneficiary Templates
        <span className="text-xs font-normal text-gray-400">({templates.length})</span>
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        When an invoice matches a name from this list (contractor, beneficiary, or company), the system will auto-fill account number, sort code, beneficiary, and company name from the template.
      </p>

      {message && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={submit} className="mb-6 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Name (match key) *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Erdal Kamalak, FluentWorld Ltd"
            className={`w-full ${inputCls}`}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Aliases (comma-separated)</label>
          <input
            type="text"
            value={form.name_aliases}
            onChange={(e) => setForm((p) => ({ ...p, name_aliases: e.target.value }))}
            placeholder="e.g. Erdal K, FluentWorld"
            className={`w-full ${inputCls}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Account Number</label>
          <input
            type="text"
            value={form.account_number}
            onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))}
            placeholder="e.g. 43953815"
            className={`w-full ${inputCls}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Sort Code</label>
          <input
            type="text"
            value={form.sort_code}
            onChange={(e) => setForm((p) => ({ ...p, sort_code: e.target.value }))}
            placeholder="e.g. 20-76-90 or 207690"
            className={`w-full ${inputCls}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Beneficiary Name</label>
          <input
            type="text"
            value={form.beneficiary_name}
            onChange={(e) => setForm((p) => ({ ...p, beneficiary_name: e.target.value }))}
            placeholder="e.g. Erdal Kamalak"
            className={`w-full ${inputCls}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Company Name</label>
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
            placeholder="e.g. FluentWorld Ltd"
            className={`w-full ${inputCls}`}
          />
        </div>
        <div className="sm:col-span-2 flex gap-2">
          <button type="submit" disabled={loading} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50">
            {editing ? "Update" : "Add"}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="space-y-2 text-sm">
        {templates.map((t) => (
          <li key={t.id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                {(t.name_aliases?.length ?? 0) > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Aliases: {(t.name_aliases ?? []).join(", ")}</p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0 text-xs text-gray-600 dark:text-gray-300">
                  {t.account_number && <span>Acc: {t.account_number}</span>}
                  {t.sort_code && <span>Sort: {t.sort_code}</span>}
                  {t.beneficiary_name && <span>Beneficiary: {t.beneficiary_name}</span>}
                  {t.company_name && <span>Company: {t.company_name}</span>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button type="button" onClick={() => startEdit(t)} aria-label="Edit template" className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200" title="Edit">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button type="button" onClick={() => setDeleteId(t.id)} aria-label="Delete template" className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700 dark:hover:text-red-300" title="Delete">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        ))}
        {templates.length === 0 && <li className="py-4 text-center text-gray-400 text-xs">No templates yet. Add contractor/beneficiary names and their bank details.</li>}
      </ul>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Delete template confirmation" onClick={() => setDeleteId(null)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-gray-800 dark:text-gray-200">Delete this template?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button onClick={doDelete} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
