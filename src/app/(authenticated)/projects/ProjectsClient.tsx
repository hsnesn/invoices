"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  deadline?: string | null;
  assignee_user_id?: string | null;
  assignee_name?: string | null;
  created_at: string;
};

type Profile = { id: string; full_name: string | null };

const STATUSES = [
  { value: "active", label: "Active", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" },
  { value: "on_hold", label: "On Hold", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
  { value: "completed", label: "Completed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200" },
];

export function ProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: "", description: "", status: "active", deadline: "", assignee_user_id: "" });
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<{ role: string } | null>(null);

  const canEdit = profile?.role === "admin" || profile?.role === "operations" || profile?.role === "manager";

  const fetchProjects = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/projects?${params}`);
    if (res.ok) {
      const data: Project[] = await res.json();
      if (canEdit && data.some((p) => p.assignee_user_id)) {
        const uRes = await fetch("/api/admin/users");
        const usersList = (await uRes.json()) as Profile[];
        const map = Object.fromEntries(usersList.map((u) => [u.id, u.full_name || u.id]));
        setProjects(data.map((p) => ({ ...p, assignee_name: p.assignee_user_id ? map[p.assignee_user_id] ?? null : null })));
      } else {
        setProjects(data);
      }
    }
  }, [statusFilter, canEdit]);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => setProfile(d)).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (canEdit) {
      fetch("/api/admin/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : [])).catch(() => setUsers([]));
    }
  }, [canEdit]);

  useEffect(() => {
    setLoading(true);
    fetchProjects().finally(() => setLoading(false));
  }, [fetchProjects]);

  const resetForm = () => {
    setForm({ name: "", description: "", status: "active", deadline: "", assignee_user_id: "" });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/projects/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            status: form.status,
            deadline: form.deadline || null,
            assignee_user_id: form.assignee_user_id || null,
          }),
        });
        if (res.ok) {
          toast.success("Project updated");
          resetForm();
          fetchProjects();
        } else {
          const d = await res.json();
          toast.error(d.error || "Failed");
        }
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            status: form.status,
            deadline: form.deadline || null,
            assignee_user_id: form.assignee_user_id || null,
          }),
        });
        if (res.ok) {
          toast.success("Project added");
          resetForm();
          fetchProjects();
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
    if (!confirm("Delete this project?")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted");
        fetchProjects();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    }
  };

  const startEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      status: p.status,
      deadline: p.deadline || "",
      assignee_user_id: p.assignee_user_id || "",
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-900/80 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {canEdit && (
          <button
            onClick={() => { resetForm(); setForm({ name: "", description: "", status: "active", deadline: "", assignee_user_id: "" }); setShowForm(true); }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + New Project
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
          <h3 className="mb-4 font-medium text-gray-900 dark:text-white">{editing ? "Edit Project" : "New Project"}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Deadline</label>
                <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assignee</label>
                <select value={form.assignee_user_id} onChange={(e) => setForm((f) => ({ ...f, assignee_user_id: e.target.value }))} className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">—</option>
                  {users.filter((u) => u.full_name).map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {saving ? "Saving..." : editing ? "Update" : "Add"}
              </button>
              <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-300">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assignee</th>
                {canEdit && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {projects.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No projects yet.</td></tr>
              ) : (
                projects.map((p) => {
                  const st = STATUSES.find((s) => s.value === p.status);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3">
                        <Link href={`/office-requests?project=${p.id}`} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                          {p.name}
                        </Link>
                        {p.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${st?.color ?? ""}`}>
                          {st?.label ?? p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {p.deadline ? new Date(p.deadline).toLocaleDateString("en-GB") : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.assignee_name ?? "—"}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => startEdit(p)} className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 mr-1">Edit</button>
                          {(profile?.role === "admin" || profile?.role === "operations") && (
                            <button onClick={() => handleDelete(p.id)} className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500">Delete</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
