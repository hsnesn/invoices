"use client";

import { useState, useEffect } from "react";

const STAGE_LABELS: Record<string, string> = {
  submission: "Invoice submitted",
  manager_approved: "Manager approved",
  manager_rejected: "Manager rejected",
  ready_for_payment: "Ready for payment",
  paid: "Payment completed",
  manager_assigned: "Manager assigned",
  resubmitted: "Resubmitted",
  admin_approved: "Admin approved",
};

const EMAIL_RECIPIENTS: { stage: string; label: string; recipients: string }[] = [
  { stage: "submission", label: "Invoice submitted", recipients: "Submitter, Dept EP (line manager)" },
  { stage: "manager_approved", label: "Manager approved", recipients: "Submitter, Admins, Operations room" },
  { stage: "manager_rejected", label: "Manager rejected", recipients: "Submitter only" },
  { stage: "ready_for_payment", label: "Ready for payment", recipients: "Submitter, Finance" },
  { stage: "paid", label: "Payment completed", recipients: "Guest: Producers only. Contractor: Submitter, Admins" },
  { stage: "manager_assigned", label: "Manager assigned", recipients: "Assigned Dept EP only" },
  { stage: "resubmitted", label: "Resubmitted", recipients: "Dept EP only (not all managers)" },
  { stage: "admin_approved", label: "Admin approved", recipients: "Submitter, Finance" },
];

const TEMPLATE_LABELS: Record<string, string> = {
  submission: "Invoice submitted",
  manager_approved: "Manager approved",
  manager_rejected: "Manager rejected",
  ready_for_payment: "Ready for payment",
  paid: "Payment completed",
  manager_assigned: "Manager assigned",
  resubmitted: "Resubmitted",
  admin_approved: "Admin approved",
};

const PLACEHOLDERS = [
  "{{invoiceNumber}}",
  "{{guestName}}",
  "{{managerName}}",
  "{{reason}}",
  "{{invoiceLink}}",
  "{{status}}",
  "{{companyOrPerson}}",
  "{{monthYear}}",
];

type TemplateRow = {
  template_key: string;
  subject_template: string | null;
  body_template: string | null;
};

type StageRow = {
  stage_key: string;
  enabled: boolean;
};

export function EmailSetupSection() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState<Record<string, string>>({});

  const fetchData = () => {
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        setStages(d.stages ?? []);
        const subj: Record<string, string> = {};
        const bod: Record<string, string> = {};
        for (const t of d.templates ?? []) {
          subj[t.template_key] = t.subject_template ?? "";
          bod[t.template_key] = t.body_template ?? "";
        }
        setEditSubject(subj);
        setEditBody(bod);
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleStage = async (stageKey: string, enabled: boolean) => {
    setSaving(true);
    setMessage(null);
    const newStages = stages.map((s) => (s.stage_key === stageKey ? { ...s, enabled } : s));
    setStages(newStages);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stages: [{ stage_key: stageKey, enabled }],
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Stage updated." });
      } else {
        const d = await res.json();
        setMessage({ type: "error", text: d.error ?? "Failed." });
        fetchData();
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async (templateKey: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: [
            {
              template_key: templateKey,
              subject_template: editSubject[templateKey]?.trim() || null,
              body_template: editBody[templateKey]?.trim() || null,
            },
          ],
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Template saved. Leave empty to use default." });
        setExpandedTemplate(null);
        fetchData();
      } else {
        const d = await res.json();
        setMessage({ type: "error", text: d.error ?? "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = (templateKey: string) => {
    setEditSubject((prev) => ({ ...prev, [templateKey]: "" }));
    setEditBody((prev) => ({ ...prev, [templateKey]: "" }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Who receives each email type */}
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-cyan-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
          Email recipients by type
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Reference: which email goes to whom. Users must have &quot;Receive invoice emails&quot; enabled in their profile.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 pr-4 text-left font-medium text-gray-700 dark:text-gray-300">Email type</th>
                <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">Recipients</th>
              </tr>
            </thead>
            <tbody>
              {EMAIL_RECIPIENTS.map((r) => (
                <tr key={r.stage} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-gray-200">{r.label}</td>
                  <td className="py-2.5 text-gray-600 dark:text-gray-400">{r.recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
              : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Stage toggles */}
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-amber-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Enable / Disable Emails by Stage
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Turn off emails for specific workflow stages. Booking form emails are always sent.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {stages.map((s) => (
            <label
              key={s.stage_key}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {STAGE_LABELS[s.stage_key] ?? s.stage_key}
              </span>
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => toggleStage(s.stage_key, e.target.checked)}
                disabled={saving}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-slate-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
          Email Templates
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Customise subject and body. Leave empty to use built-in default. Placeholders:{" "}
          {PLACEHOLDERS.join(", ")}
        </p>
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.template_key}
              className="rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <button
                type="button"
                onClick={() => setExpandedTemplate(expandedTemplate === t.template_key ? null : t.template_key)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/50"
              >
                {TEMPLATE_LABELS[t.template_key] ?? t.template_key}
                <span className="text-gray-400">
                  {expandedTemplate === t.template_key ? "▼" : "▶"}
                </span>
              </button>
              {expandedTemplate === t.template_key && (
                <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={editSubject[t.template_key] ?? ""}
                      onChange={(e) =>
                        setEditSubject((prev) => ({ ...prev, [t.template_key]: e.target.value }))
                      }
                      placeholder="Leave empty for default"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Body (HTML)
                    </label>
                    <textarea
                      value={editBody[t.template_key] ?? ""}
                      onChange={(e) =>
                        setEditBody((prev) => ({ ...prev, [t.template_key]: e.target.value }))
                      }
                      placeholder="Leave empty for default"
                      rows={6}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveTemplate(t.template_key)}
                      disabled={saving}
                      className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => resetTemplate(t.template_key)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Clear (use default)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
