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
  guest_link_sent: "Guest — Invoice submit link sent",
  guest_invoice_submitted: "Guest — Invoice submitted/created",
  availability_submitted: "My availability — submitted",
  availability_cleared: "My availability — cancelled/cleared",
  assignment_confirmed: "Assignment — confirmed",
  assignment_reminder: "Assignment — reminder (day before)",
  booking_form_approved: "Booking form — approved",
  office_request_approved: "Office request — approved",
  office_request_assigned: "Office request — assigned",
  office_request_rejected: "Office request — rejected",
};

const RECIPIENT_LABELS: Record<string, string> = {
  submitter: "Submitter",
  dept_ep: "Dept EP",
  admin: "Admins",
  finance: "Finance",
  operations: "Operations room",
  producers: "Producers (guest paid)",
  guest: "Guest (payment recipient)",
  producer: "Producer (guest's producer)",
  contractor: "Contractor",
  line_manager: "Line manager",
  assignee: "Assignee",
  requester: "Requester",
};

const STAGE_RECIPIENTS: { stage: string; recipientTypes: string[] }[] = [
  { stage: "submission", recipientTypes: ["submitter", "dept_ep"] },
  { stage: "manager_approved", recipientTypes: ["submitter", "admin", "operations"] },
  { stage: "manager_rejected", recipientTypes: ["submitter"] },
  { stage: "ready_for_payment", recipientTypes: ["submitter", "finance"] },
  { stage: "paid", recipientTypes: ["submitter", "admin", "producers", "guest"] },
  { stage: "manager_assigned", recipientTypes: ["dept_ep"] },
  { stage: "resubmitted", recipientTypes: ["dept_ep"] },
  { stage: "admin_approved", recipientTypes: ["submitter", "finance"] },
  { stage: "guest_link_sent", recipientTypes: ["guest"] },
  { stage: "guest_invoice_submitted", recipientTypes: ["guest", "producer"] },
  { stage: "availability_submitted", recipientTypes: ["operations"] },
  { stage: "availability_cleared", recipientTypes: ["contractor"] },
  { stage: "assignment_confirmed", recipientTypes: ["contractor", "operations"] },
  { stage: "assignment_reminder", recipientTypes: ["contractor"] },
  { stage: "booking_form_approved", recipientTypes: ["line_manager", "operations"] },
  { stage: "office_request_approved", recipientTypes: ["requester"] },
  { stage: "office_request_assigned", recipientTypes: ["assignee"] },
  { stage: "office_request_rejected", recipientTypes: ["requester"] },
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
  guest_link_sent: "Guest — Invoice submit link sent",
  guest_invoice_submitted: "Guest — Invoice submitted/created",
  availability_submitted: "My availability — submitted",
  availability_cleared: "My availability — cancelled/cleared",
  assignment_confirmed: "Assignment — confirmed",
  assignment_reminder: "Assignment — reminder (day before)",
  booking_form_approved: "Booking form — approved",
  office_request_approved: "Office request — approved",
  office_request_assigned: "Office request — assigned",
  office_request_rejected: "Office request — rejected",
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
  const [recipientMap, setRecipientMap] = useState<Record<string, boolean>>({});
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
        setRecipientMap(d.recipientMap ?? {});
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

  const toggleRecipient = async (stageKey: string, recipientType: string, enabled: boolean) => {
    const key = `${stageKey}:${recipientType}`;
    setSaving(true);
    setMessage(null);
    setRecipientMap((prev) => ({ ...prev, [key]: enabled }));
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: [{ stage_key: stageKey, recipient_type: recipientType, enabled }],
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Recipient setting updated." });
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
      {/* Recipient toggles: who receives each email type */}
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-cyan-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
          Email recipients by type
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Reference: which email goes to whom. Tick to include, untick to exclude. Users must have &quot;Receive invoice emails&quot; enabled.
        </p>
        <div className="overflow-x-auto rounded-lg border-2 border-gray-300 dark:border-gray-600">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-cyan-50 dark:bg-cyan-900/20">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Email type
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Recipients — select with checkboxes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900/80">
              {STAGE_RECIPIENTS.map(({ stage, recipientTypes }) => (
                <tr key={stage} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap align-top pt-4">
                    {STAGE_LABELS[stage] ?? stage}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {recipientTypes.map((rt) => {
                        const key = `${stage}:${rt}`;
                        const enabled = recipientMap[key] !== false;
                        return (
                          <label
                            key={key}
                            className={`flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none ${
                              saving ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => !saving && toggleRecipient(stage, rt, e.target.checked)}
                              disabled={saving}
                              className="sr-only"
                              aria-label={`${RECIPIENT_LABELS[rt] ?? rt} - ${enabled ? "enabled" : "disabled"}`}
                            />
                            <span
                              role="presentation"
                              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
                                enabled
                                  ? "border-cyan-600 bg-cyan-600"
                                  : "border-gray-400 bg-white dark:border-gray-500 dark:bg-gray-800"
                              }`}
                            >
                              {enabled && (
                                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span>{RECIPIENT_LABELS[rt] ?? rt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </td>
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
            <div
              key={s.stage_key}
              role="button"
              tabIndex={0}
              onClick={() => !saving && toggleStage(s.stage_key, !s.enabled)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!saving) toggleStage(s.stage_key, !s.enabled);
                }
              }}
              className={`flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50 ${saving ? "opacity-70" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            >
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {STAGE_LABELS[s.stage_key] ?? s.stage_key}
              </span>
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  s.enabled
                    ? "border-amber-600 bg-amber-600 text-white"
                    : "border-gray-400 bg-white dark:border-gray-500 dark:bg-gray-800"
                }`}
              >
                {s.enabled && (
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </div>
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
