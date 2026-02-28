"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

type RecurringInvoice = {
  id: string;
  title: string;
  description?: string | null;
  beneficiary_name?: string | null;
  amount?: number | null;
  currency: string;
  frequency: string;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
};

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function RecurringInvoicesSetupSection() {
  const [items, setItems] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    beneficiary_name: "",
    amount: "",
    currency: "GBP",
    frequency: "monthly",
    next_due_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const fetchItems = useCallback(async () => {
    const params = showInactive ? "?active=false" : "";
    const res = await fetch(`/api/recurring-invoices${params}`);
    if (res.ok) setItems(await res.json());
  }, [showInactive]);

  useEffect(() => {
    setLoading(true);
    fetchItems().finally(() => setLoading(false));
  }, [fetchItems]);

  const resetForm = () => {
    setForm({ title: "", description: "", beneficiary_name: "", amount: "", currency: "GBP", frequency: "monthly", next_due_date: "" });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.next_due_date) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        beneficiary_name: form.beneficiary_name.trim() || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        currency: form.currency,
        frequency: form.frequency,
        next_due_date: form.next_due_date,
      };
      if (editing) {
        const res = await fetch(`/api/recurring-invoices/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Recurring invoice updated");
          resetForm();
          fetchItems();
        } else {
          const d = await res.json();
          toast.error(d.error || "Failed");
        }
      } else {
        const res = await fetch("/api/recurring-invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Recurring invoice added");
          resetForm();
          fetchItems();
        } else {
          const d = await res.json();
          toast.error(d.error || "Failed");
        }
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceDue = async (id: string) => {
    try {
      const res = await fetch(`/api/recurring-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advance_next_due_date: true }),
      });
      if (res.ok) {
        toast.success("Next due date advanced");
        fetchItems();
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/recurring-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? "Deactivated" : "Activated");
        fetchItems();
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recurring invoice?")) return;
    try {
      const res = await fetch(`/api/recurring-invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchItems();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900/80 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-emerald-500 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        Recurring Invoices
        <span className="text-xs font-normal text-gray-400">({items.length})</span>
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Define recurring payments (e.g. rent, subscriptions). Reminders are sent before due dates.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => { resetForm(); setForm({ title: "", description: "", beneficiary_name: "", amount: "", currency: "GBP", frequency: "monthly", next_due_date: "" }); setShowForm(true); }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + Add Recurring Invoice
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Show inactive
        </label>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 className="mb-3 font-medium text-gray-900 dark:text-white">{editing ? "Edit" : "New"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Title *</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Next due date *</label>
              <input type="date" value={form.next_due_date} onChange={(e) => setForm((f) => ({ ...f, next_due_date: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Beneficiary</label>
              <input value={form.beneficiary_name} onChange={(e) => setForm((f) => ({ ...f, beneficiary_name: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Currency</label>
              <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={saving} className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
              {saving ? "Saving..." : editing ? "Update" : "Add"}
            </button>
            <button type="button" onClick={resetForm} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancel</button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
            <div>
              <span className="font-medium text-gray-900 dark:text-white">{r.title}</span>
              {r.beneficiary_name && <span className="ml-2 text-sm text-gray-500">({r.beneficiary_name})</span>}
              <span className="ml-2 text-sm text-gray-500">Due: {new Date(r.next_due_date).toLocaleDateString("en-GB")}</span>
              {r.amount != null && <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{r.currency} {r.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>}
              {!r.is_active && <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-300">Inactive</span>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => handleAdvanceDue(r.id)} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500" title="Mark done / advance next due">
                Advance due
              </button>
              <button onClick={() => handleToggleActive(r.id, r.is_active)} className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500">
                {r.is_active ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => { setEditing(r); setForm({ title: r.title, description: r.description || "", beneficiary_name: r.beneficiary_name || "", amount: r.amount != null ? String(r.amount) : "", currency: r.currency, frequency: r.frequency, next_due_date: r.next_due_date }); setShowForm(true); }} className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500">Edit</button>
              <button onClick={() => handleDelete(r.id)} className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500">Delete</button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="py-4 text-center text-sm text-gray-500">No recurring invoices yet.</li>}
      </ul>
    </div>
  );
}
