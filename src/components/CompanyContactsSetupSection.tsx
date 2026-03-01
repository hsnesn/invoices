"use client";

import { useState, useEffect } from "react";
import type { CompanySettings } from "@/lib/company-settings";

const FIELDS: { key: keyof CompanySettings; label: string; placeholder: string; group: "company" | "contacts" | "bank" | "invitations" }[] = [
  { key: "company_name", label: "Company name", placeholder: "e.g. TRT WORLD (UK)", group: "company" },
  { key: "company_address", label: "Company address", placeholder: "e.g. 200 Grays Inn Road, London, WC1X 8XZ", group: "company" },
  { key: "signature_name", label: "Signature name", placeholder: "e.g. Hasan ESEN", group: "company" },
  { key: "studio_address", label: "Studio address", placeholder: "Used in guest invitations", group: "company" },
  { key: "app_name", label: "App name", placeholder: "e.g. TRT UK Operations Platform", group: "company" },
  { key: "email_operations", label: "Operations email", placeholder: "london.operations@trtworld.com", group: "contacts" },
  { key: "email_finance", label: "Finance email", placeholder: "london.finance@trtworld.com", group: "contacts" },
  { key: "email_bank_transfer", label: "Bank transfer form recipient", placeholder: "Where transfer forms are sent", group: "contacts" },
  { key: "bank_account_gbp", label: "Bank account (GBP)", placeholder: "0611-405810-001", group: "bank" },
  { key: "bank_account_eur", label: "Bank account (EUR)", placeholder: "0611-405810-009", group: "bank" },
  { key: "bank_account_usd", label: "Bank account (USD)", placeholder: "0611-405810-002", group: "bank" },
];

export function CompanyContactsSetupSection() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [edit, setEdit] = useState<Partial<CompanySettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const fetchData = () => {
    fetch("/api/admin/company-settings")
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Forbidden" : "Failed");
        return r.json();
      })
      .then((d) => {
        setSettings(d);
        setEdit(d);
      })
      .catch((e) => setMessage({ type: "error", text: e?.message ?? "Failed to load." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edit),
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data);
        setEdit(data);
        setMessage({ type: "success", text: "Settings saved." });
      } else {
        setMessage({ type: "error", text: data?.error ?? "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500";

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Company details, contact emails, and bank account numbers used in bank transfer forms, invoices, invitations, and emails. Changes apply immediately across the app.
      </p>

      {message && (
        <div className={`rounded-lg border p-3 text-sm ${message.type === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"}`}>
          {message.text}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Company
        </h2>
        <div className="space-y-3">
          {FIELDS.filter((f) => f.group === "company").map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
              <input
                type="text"
                value={edit[f.key] ?? settings?.[f.key] ?? ""}
                onChange={(e) => setEdit((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Contact emails
        </h2>
        <div className="space-y-3">
          {FIELDS.filter((f) => f.group === "contacts").map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
              <input
                type="email"
                value={edit[f.key] ?? settings?.[f.key] ?? ""}
                onChange={(e) => setEdit((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
          Invitation templates
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Subject, body and channel used when sending guest invitations. Placeholders: {"{program}"}, {"{topic}"}, {"{channel}"}.</p>
        <div className="space-y-3">
          {FIELDS.filter((f) => f.group === "invitations").map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
              <input
                type="text"
                value={edit[f.key] ?? settings?.[f.key] ?? ""}
                onChange={(e) => setEdit((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Bank accounts (for transfer forms)
        </h2>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Account numbers by currency. Used when generating international bank transfer forms.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {FIELDS.filter((f) => f.group === "bank").map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
              <input
                type="text"
                value={edit[f.key] ?? settings?.[f.key] ?? ""}
                onChange={(e) => setEdit((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
