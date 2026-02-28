"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

type Vendor = {
  id: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  contract_end_date?: string | null;
  notes?: string | null;
  is_preferred: boolean;
};

export function VendorsSetupSection({ canDelete: canDeleteProp }: { canDelete?: boolean } = {}) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => {
    if (canDeleteProp !== undefined) {
      setCanDelete(canDeleteProp);
    } else {
      fetch("/api/profile").then((r) => r.json()).then((p) => setCanDelete(p?.role === "admin")).catch(() => setCanDelete(false));
    }
  }, [canDeleteProp]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState({ name: "", contact_person: "", email: "", phone: "", address: "", payment_terms: "", contract_end_date: "", notes: "", is_preferred: false });
  const [saving, setSaving] = useState(false);

  const fetchVendors = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/vendors?${params}`);
    if (res.ok) setVendors(await res.json());
  }, [search]);

  useEffect(() => {
    setLoading(true);
    fetchVendors().finally(() => setLoading(false));
  }, [fetchVendors]);

  const resetForm = () => {
    setForm({ name: "", contact_person: "", email: "", phone: "", address: "", payment_terms: "", contract_end_date: "", notes: "", is_preferred: false });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/vendors/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            contact_person: form.contact_person.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            payment_terms: form.payment_terms.trim() || null,
            contract_end_date: form.contract_end_date || null,
            notes: form.notes.trim() || null,
            is_preferred: form.is_preferred,
          }),
        });
        if (res.ok) {
          toast.success("Vendor updated");
          resetForm();
          fetchVendors();
        } else {
          const d = await res.json();
          toast.error(d.error || "Failed");
        }
      } else {
        const res = await fetch("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            contact_person: form.contact_person.trim() || null,
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            payment_terms: form.payment_terms.trim() || null,
            contract_end_date: form.contract_end_date || null,
            notes: form.notes.trim() || null,
            is_preferred: form.is_preferred,
          }),
        });
        if (res.ok) {
          toast.success("Vendor added");
          resetForm();
          fetchVendors();
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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this vendor?")) return;
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Vendor deleted");
        fetchVendors();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-slate-500 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
          Vendors & Suppliers
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Manage vendor/supplier contacts, contract dates and payment terms.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white w-48"
          />
          <button
            onClick={() => { setEditing(null); setForm({ name: "", contact_person: "", email: "", phone: "", address: "", payment_terms: "", contract_end_date: "", notes: "", is_preferred: false }); setShowForm(true); }}
            className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-500"
          >
            + Add Vendor
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50 space-y-3">
            <h3 className="font-medium text-gray-900 dark:text-white">{editing ? "Edit Vendor" : "New Vendor"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-500">Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Contact person</label>
                <input value={form.contact_person} onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Phone</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500">Address</label>
                <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Payment terms</label>
                <input value={form.payment_terms} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. 30 days" className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">Contract end date</label>
                <input type="date" value={form.contract_end_date} onChange={(e) => setForm((f) => ({ ...f, contract_end_date: e.target.value }))} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="pref" checked={form.is_preferred} onChange={(e) => setForm((f) => ({ ...f, is_preferred: e.target.checked }))} className="rounded" />
                <label htmlFor="pref" className="text-sm text-gray-600 dark:text-gray-400">Preferred vendor</label>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50">
                {saving ? "Saving..." : editing ? "Update" : "Add"}
              </button>
              <button type="button" onClick={resetForm} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : vendors.length === 0 ? (
          <p className="text-sm text-gray-500">No vendors yet. Add one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Name</th>
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Contact</th>
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Payment terms</th>
                  <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Contract end</th>
                  <th className="text-right py-2 font-medium text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2">
                      <span className="font-medium text-gray-900 dark:text-white">{v.name}</span>
                      {v.is_preferred && <span className="ml-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-1.5 py-0.5 rounded">Preferred</span>}
                    </td>
                    <td className="py-2 text-gray-600 dark:text-gray-400">{v.contact_person || v.email || "—"}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-400">{v.payment_terms || "—"}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-400">{v.contract_end_date ? new Date(v.contract_end_date).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => { setEditing(v); setForm({ name: v.name, contact_person: v.contact_person || "", email: v.email || "", phone: v.phone || "", address: v.address || "", payment_terms: v.payment_terms || "", contract_end_date: v.contract_end_date || "", notes: v.notes || "", is_preferred: v.is_preferred }); setShowForm(true); }} className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 mr-2">Edit</button>
                      {canDelete && <button onClick={() => handleDelete(v.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200">Delete</button>}
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
