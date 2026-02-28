"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "furniture", label: "Furniture" },
  { value: "it_equipment", label: "IT Equipment" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "maintenance", label: "Maintenance" },
  { value: "software", label: "Software" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low", color: "text-gray-500" },
  { value: "normal", label: "Normal", color: "text-blue-600" },
  { value: "high", label: "High", color: "text-amber-600" },
  { value: "urgent", label: "Urgent", color: "text-red-600" },
];

type RequestRow = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  priority: string;
  status: string;
  requester_user_id: string;
  requester_name: string;
  approved_by_name?: string | null;
  assignee_name?: string | null;
  cost_estimate?: number | null;
  created_at: string;
  office_request_todos?: { id: string; assignee_user_id?: string | null; due_date?: string | null; status: string; completion_notes?: string | null }[] | { id: string; assignee_user_id?: string | null; due_date?: string | null; status: string; completion_notes?: string | null };
  rejection_reason?: string | null;
  project_id?: string | null;
  vendor_id?: string | null;
  linked_invoice_id?: string | null;
  project_name?: string | null;
  vendor_name?: string | null;
};

type Profile = { id: string; full_name: string | null };

function AttachmentsModal({ requestId, requestTitle, onClose }: { requestId: string; requestTitle: string; onClose: () => void }) {
  const [attachments, setAttachments] = useState<{ id: string; file_name: string; download_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    const res = await fetch(`/api/office-requests/${requestId}/attachments`);
    if (res.ok) setAttachments(await res.json());
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    setLoading(true);
    fetchAttachments();
  }, [fetchAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/office-requests/${requestId}/attachments`, { method: "POST", body: formData });
      if (res.ok) {
        toast.success("File uploaded");
        fetchAttachments();
      } else {
        const d = await res.json();
        toast.error(d.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm("Delete this attachment?")) return;
    try {
      const res = await fetch(`/api/office-requests/${requestId}/attachments/${attachmentId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchAttachments();
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attachments: {requestTitle}</h3>
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx" onChange={handleUpload} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mb-4 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          {uploading ? "Uploading..." : "+ Upload file"}
        </button>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-gray-500">No attachments yet.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
                <a href={a.download_url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline truncate flex-1">{a.file_name}</a>
                <button onClick={() => handleDelete(a.id)} className="ml-2 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500">Delete</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300">Close</button>
        </div>
      </div>
    </div>
  );
}

export function OfficeRequestsClient() {
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get("status") ?? "";
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [reminders, setReminders] = useState<{ id: string; title: string; next_due_date: string; frequency_months: number; assignee_name?: string | null }[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(() => statusFromUrl || "");
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newPriority, setNewPriority] = useState("normal");
  const [newCost, setNewCost] = useState("");
  const [newVendorId, setNewVendorId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [profile, setProfile] = useState<{ id: string; role: string } | null>(null);
  const [approveModal, setApproveModal] = useState<RequestRow | null>(null);
  const [completeModal, setCompleteModal] = useState<RequestRow | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [createInvoiceOnComplete, setCreateInvoiceOnComplete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [attachmentsModal, setAttachmentsModal] = useState<RequestRow | null>(null);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [remTitle, setRemTitle] = useState("");
  const [remDesc, setRemDesc] = useState("");
  const [remFreq, setRemFreq] = useState(6);
  const [remDue, setRemDue] = useState("");
  const [remAssignee, setRemAssignee] = useState("");
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (showMineOnly) params.set("mine", "true");
    const res = await fetch(`/api/office-requests?${params}`);
    if (res.ok) setRequests(await res.json());
  }, [statusFilter, showMineOnly]);

  const fetchReminders = useCallback(async () => {
    const res = await fetch("/api/reminders");
    if (res.ok) setReminders(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => setProfile(d)).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (profile?.role === "admin" || profile?.role === "operations") {
      fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => setUsers([]));
    }
  }, [profile?.role]);

  useEffect(() => {
    fetch("/api/vendors").then((r) => r.json()).then((d) => setVendors(Array.isArray(d) ? d : [])).catch(() => setVendors([]));
    fetch("/api/projects").then((r) => r.json()).then((d) => setProjects(Array.isArray(d) ? d : [])).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRequests(), fetchReminders()]).finally(() => setLoading(false));
  }, [fetchRequests, fetchReminders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/office-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          category: newCategory,
          priority: newPriority,
          cost_estimate: newCost ? parseFloat(newCost) : null,
          vendor_id: newVendorId || null,
          project_id: newProjectId || null,
        }),
      });
      if (res.ok) {
        toast.success("Request submitted");
        setShowNewForm(false);
        setNewTitle("");
        setNewDesc("");
        setNewCategory("other");
        setNewPriority("normal");
        setNewCost("");
        setNewVendorId("");
        setNewProjectId("");
        fetchRequests();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to submit");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/office-requests/${approveModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", assignee_user_id: assigneeId || null, due_date: dueDate || null }),
      });
      if (res.ok) {
        toast.success("Request approved");
        setApproveModal(null);
        setAssigneeId("");
        setDueDate("");
        fetchRequests();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/office-requests/${approveModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejection_reason: rejectionReason || null }),
      });
      if (res.ok) {
        toast.success("Request rejected");
        setApproveModal(null);
        setRejectionReason("");
        fetchRequests();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!completeModal) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/office-requests/${completeModal.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completion_notes: completionNotes || null, create_invoice: createInvoiceOnComplete }),
      });
      if (res.ok) {
        toast.success("Marked complete. Requester will receive an email.");
        setCompleteModal(null);
        setCompletionNotes("");
        setCreateInvoiceOnComplete(false);
        fetchRequests();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim() || !remDue) return;
    setReminderSubmitting(true);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: remTitle.trim(),
          description: remDesc.trim() || null,
          frequency_months: remFreq,
          next_due_date: remDue,
          assignee_user_id: remAssignee || null,
        }),
      });
      if (res.ok) {
        toast.success("Reminder added");
        setShowReminderForm(false);
        setRemTitle("");
        setRemDesc("");
        setRemFreq(6);
        setRemDue("");
        setRemAssignee("");
        fetchReminders();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setReminderSubmitting(false);
    }
  };

  const handleReminderDone = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_done: true }),
      });
      if (res.ok) {
        toast.success("Reminder marked done. Next due date updated.");
        fetchReminders();
      }
    } catch {
      toast.error("Failed");
    }
  };

  const canApprove = profile?.role === "admin" || profile?.role === "operations";
  const canComplete = canApprove;

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900/80 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Reminders section */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reminders
          </h2>
          {canApprove && (
            <button onClick={() => setShowReminderForm(!showReminderForm)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500">
              {showReminderForm ? "Cancel" : "+ Add Reminder"}
            </button>
          )}
        </div>
        {showReminderForm && canApprove && (
          <form onSubmit={handleAddReminder} className="mb-4 rounded-lg bg-white/80 p-4 dark:bg-gray-900/50 space-y-3">
            <input value={remTitle} onChange={(e) => setRemTitle(e.target.value)} placeholder="Title (e.g. Fire extinguisher maintenance)" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" required />
            <input value={remDesc} onChange={(e) => setRemDesc(e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs text-gray-500">Frequency (months)</label>
                <input type="number" min={1} value={remFreq} onChange={(e) => setRemFreq(parseInt(e.target.value, 10) || 6)} className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Next due date *</label>
                <input type="date" value={remDue} onChange={(e) => setRemDue(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Assignee</label>
                <select value={remAssignee} onChange={(e) => setRemAssignee(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" disabled={reminderSubmitting} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50">
              {reminderSubmitting ? "Adding..." : "Add"}
            </button>
          </form>
        )}
        {reminders.length > 0 ? (
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 rounded-lg bg-white/80 px-3 py-2 dark:bg-gray-900/50">
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">{r.title}</span>
                  <span className="ml-2 text-sm text-gray-500">Due: {new Date(r.next_due_date).toLocaleDateString("en-GB")}</span>
                  {r.assignee_name && <span className="ml-2 text-xs text-gray-400">({r.assignee_name})</span>}
                </div>
                {canApprove && (
                  <button onClick={() => handleReminderDone(r.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500">
                    Mark done
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-amber-700/80 dark:text-amber-300/80">No reminders. Add one (e.g. fire extinguisher maintenance every 6 months).</p>
        )}
      </div>

      {/* Filters and new request */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
        {canApprove && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showMineOnly} onChange={(e) => setShowMineOnly(e.target.checked)} className="rounded" />
            My requests only
          </label>
        )}
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          {showNewForm ? "Cancel" : "+ New Request"}
        </button>
      </div>

      {/* New request form */}
      {showNewForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h3 className="mb-4 font-medium text-gray-900 dark:text-white">New Request</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title *</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. New office chair"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional details"
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cost estimate (£)</label>
                <input type="number" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="Optional" className="mt-1 w-28 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor (optional)</label>
                <select value={newVendorId} onChange={(e) => setNewVendorId(e.target.value)} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">—</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project (optional)</label>
                <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit"}
              </button>
              <button type="button" onClick={() => setShowNewForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Requests list */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Requester</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {requests.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No requests yet.</td></tr>
              ) : (
                requests.map((r) => {
                  const todo = Array.isArray(r.office_request_todos) ? r.office_request_todos[0] : r.office_request_todos;
                  const pri = PRIORITIES.find((p) => p.value === r.priority);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{r.title}</div>
                        {r.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category}</td>
                      <td className="px-4 py-3"><span className={`text-sm font-medium ${pri?.color ?? ""}`}>{pri?.label ?? r.priority}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" :
                          r.status === "approved" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" :
                          r.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" :
                          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.requester_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.assignee_name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setAttachmentsModal(r)} className="rounded bg-gray-500 px-2 py-1 text-xs font-medium text-white hover:bg-gray-400 mr-1">Attachments</button>
                        {canApprove && r.status === "pending" && (
                          <button onClick={() => { setApproveModal(r); setAssigneeId(""); setDueDate(""); setRejectionReason(""); }} className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-500 mr-1">
                            Approve
                          </button>
                        )}
                        {canApprove && r.status === "approved" && (
                          <button onClick={() => { setCompleteModal(r); setCompletionNotes(""); }} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">
                            Complete
                          </button>
                        )}
                        {canApprove && r.status === "pending" && (
                          <button onClick={() => { setApproveModal(r); setRejectionReason(""); }} className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500">
                            Reject
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approve modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{approveModal.title}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assignee</label>
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">—</option>
                  {users.filter((u) => u.full_name).map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Due date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rejection reason (if rejecting)</label>
                <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setApproveModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">Reject</button>
              <button onClick={handleApprove} disabled={actionLoading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">Approve</button>
            </div>
          </div>
        </div>
      )}

      {/* Attachments modal */}
      {attachmentsModal && (
        <AttachmentsModal
          requestId={attachmentsModal.id}
          requestTitle={attachmentsModal.title}
          onClose={() => setAttachmentsModal(null)}
        />
      )}

      {/* Complete modal */}
      {completeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Complete: {completeModal.title}</h3>
            <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Completion notes</label>
              <textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Optional" rows={3} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
            </div>
            {canComplete && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={createInvoiceOnComplete} onChange={(e) => setCreateInvoiceOnComplete(e.target.checked)} className="rounded" />
                Create invoice from this request (Other invoice, ready for payment)
              </label>
            )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setCompleteModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300">Cancel</button>
              <button onClick={handleComplete} disabled={actionLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Mark complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
