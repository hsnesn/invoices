"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { Profile, PageKey } from "@/lib/types";
import { ALL_PAGES } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : []));

type UserRow = Profile & { email?: string };

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  operations: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
  submitter: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600",
  viewer: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600",
};

export function AdminUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invitations, setInvitations] = useState<
    { id: string; email: string; full_name: string | null; role: string; accepted: boolean; invited_at?: string; invited_by?: string }[]
  >([]);
  const { data: departments = [] } = useSWR<{ id: string; name: string }[]>("/api/departments", fetcher);
  const { data: programs = [] } = useSWR<{ id: string; name: string }[]>("/api/programs", fetcher);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"submitter" | "manager" | "admin" | "finance" | "viewer" | "operations">("submitter");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const [permPages, setPermPages] = useState<PageKey[]>([]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
    fetch("/api/invitations")
      .then((r) => r.json())
      .then((d) => setInvitations(Array.isArray(d) ? d : []))
      .catch(() => setInvitations([]));
  }, []);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.full_name?.toLowerCase().includes(q)) ||
          (u.email?.toLowerCase().includes(q)) ||
          u.id.toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (statusFilter === "active") list = list.filter((u) => u.is_active);
    if (statusFilter === "inactive") list = list.filter((u) => !u.is_active);
    return list;
  }, [users, search, roleFilter, statusFilter]);

  const filteredInvitations = useMemo(() => {
    if (!search.trim()) return invitations;
    const q = search.toLowerCase();
    return invitations.filter(
      (inv) =>
        inv.email.toLowerCase().includes(q) ||
        (inv.full_name?.toLowerCase().includes(q)) ||
        inv.role.toLowerCase().includes(q)
    );
  }, [invitations, search]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail.trim(),
        full_name: inviteName.trim() || undefined,
        role: inviteRole,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMessage({
        type: "success",
        text: data.resend_id
          ? "Invitation sent. If not received, check spam or Resend dashboard."
          : "Invitation sent.",
      });
      setInviteEmail("");
      setInviteName("");
      fetch("/api/invitations").then((r) => r.json()).then(setInvitations);
    } else {
      setMessage({ type: "error", text: data.error });
    }
  };

  const handleResendInvite = async (email: string) => {
    const res = await fetch("/api/invite", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (res.ok) setMessage({ type: "success", text: `Invitation resent to ${email}` });
    else setMessage({ type: "error", text: data.error || "Failed to resend" });
  };

  const handleRevokeInvite = async (email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return;
    const res = await fetch("/api/invite", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) {
      setInvitations(prev => prev.filter(i => i.email !== email));
      setMessage({ type: "success", text: `Invitation for ${email} revoked` });
    } else {
      const data = await res.json();
      setMessage({ type: "error", text: data.error || "Failed to revoke" });
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, is_active: !isActive }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !isActive } : u))
      );
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as never } : u))
      );
      setEditingRole(null);
    } else {
      toast.error(data?.error ?? "Failed to update role. Run migration 00020 if using Operations role.");
    }
  };

  const openPermissions = (user: UserRow) => {
    setEditingPermissions(user.id);
    setPermPages(user.allowed_pages ?? ALL_PAGES.map((p) => p.key));
  };

  const togglePage = (key: PageKey) => {
    setPermPages((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const savePermissions = async () => {
    if (!editingPermissions) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: editingPermissions, allowed_pages: permPages }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingPermissions ? { ...u, allowed_pages: permPages } : u
        )
      );
      toast.success("Page permissions saved. Changes take effect when the user refreshes or navigates.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Failed to save permissions");
    }
    setEditingPermissions(null);
  };

  const exportUsers = async () => {
    const XLSX = await import("xlsx");
    const rows = filteredUsers.map((u) => ({
      Name: u.full_name || u.id,
      Email: u.email || "",
      Role: u.role,
      Status: u.is_active ? "Active" : "Inactive",
      Department: departments.find((d) => d.id === u.department_id)?.name ?? u.department_id ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, `users-${new Date().toISOString().split("T")[0]}.xlsx`);
  };
  const handleExport = () => void exportUsers();

  const deptName = (id: string | null) =>
    id ? departments.find((d) => d.id === id)?.name ?? id : "—";
  const programNames = (ids: string[] | null) =>
    ids?.map((p) => programs.find((pr) => pr.id === p)?.name ?? p).join(", ") ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
          Export Users
        </button>
      </div>

      {/* Global Search */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
          <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users and invitations by name, email or role..."
          className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-10 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Invite */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite User</h2>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch("/api/email-status");
              const d = await res.json();
              setMessage({
                type: d.hasResendKey && !d.fromEmail.includes("gmail") && !d.fromEmail.includes("example") ? "success" : "error",
                text: `Key: ${d.hasResendKey ? "✓" : "✗"} | From: ${d.fromEmail} | ${d.hint}`,
              });
            }}
            className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Check email config
          </button>
        </div>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "submitter" | "manager" | "admin" | "finance" | "viewer")
              }
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="submitter">Submitter</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="finance">Finance</option>
              <option value="operations">Operations</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? "Sending…" : "Invite"}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">Test email:</span>
          <input
            type="email"
            id="test-email"
            placeholder="your@email.com"
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="button"
            onClick={async () => {
              const el = document.getElementById("test-email") as HTMLInputElement;
              const email = el?.value?.trim();
              if (!email) { setMessage({ type: "error", text: "Enter an email to test" }); return; }
              setMessage(null);
              const res = await fetch(`/api/invite/test?email=${encodeURIComponent(email)}`);
              const data = await res.json();
              if (res.ok) setMessage({ type: "success", text: `Test email sent to ${email}. Check inbox and spam.` });
              else setMessage({ type: "error", text: data.error || "Failed" });
            }}
            className="rounded bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-500"
          >
            Send test
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Invitations */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
          Invitations ({filteredInvitations.length}{search.trim() && filteredInvitations.length !== invitations.length ? ` / ${invitations.length}` : ""})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Sent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredInvitations.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">{search.trim() ? "No invitations matching your search" : "No invitations sent yet"}</td></tr>
              ) : (
                filteredInvitations.map((inv) => (
                  <tr key={inv.id} className="bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{inv.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{inv.full_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[inv.role] ?? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {inv.invited_at ? new Date(inv.invited_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {inv.accepted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                          Accepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <svg className="h-3 w-3 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="5"/></svg>
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!inv.accepted && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => void handleResendInvite(inv.email)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                            title="Resend invitation email"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
                            Resend
                          </button>
                          <button
                            onClick={() => void handleRevokeInvite(inv.email)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            title="Revoke invitation"
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            Revoke
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Users ({filteredUsers.length}{(search.trim() || roleFilter || statusFilter) && filteredUsers.length !== users.length ? ` / ${users.length}` : ""})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="finance">Finance</option>
              <option value="operations">Operations</option>
              <option value="submitter">Submitter</option>
              <option value="viewer">Viewer</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Programs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Pages</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {u.full_name || u.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{u.email || "—"}</td>
                  <td className="px-4 py-3">
                    {editingRole === u.id ? (
                      <select
                        autoFocus
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        onBlur={() => setEditingRole(null)}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="submitter">Submitter</option>
                        <option value="manager">Manager</option>
                        <option value="finance">Finance</option>
                        <option value="operations">Operations</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingRole(u.id)}
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium hover:ring-2 hover:ring-offset-1 ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-800"} dark:hover:ring-gray-600`}
                      >
                        {u.role}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[120px] truncate" title={deptName(u.department_id)}>
                    {deptName(u.department_id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[150px] truncate" title={programNames(u.program_ids ?? [])}>
                    {programNames(u.program_ids ?? [])}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openPermissions(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-900/50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>
                      {u.allowed_pages ? `${u.allowed_pages.length}/${ALL_PAGES.length}` : "All"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.is_active ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-red-600 dark:text-red-400"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== currentUserId ? (
                      <button
                        onClick={() => handleToggleActive(u.id, u.is_active)}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          u.is_active
                            ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/50"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                        }`}
                      >
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Page Permissions Modal */}
      {editingPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Page permissions">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Page Permissions
              </h3>
              <button
                onClick={() => setEditingPermissions(null)}
                aria-label="Close permissions"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              {users.find((u) => u.id === editingPermissions)?.full_name || "User"} &mdash; Select which pages this user can access.
            </p>
            <div className="space-y-2">
              {ALL_PAGES.map((page) => {
                const checked = permPages.includes(page.key);
                return (
                  <label
                    key={page.key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                      checked
                        ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
                        : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePage(page.key)}
                      className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    <span className={`text-sm font-medium ${checked ? "text-violet-700 dark:text-violet-300" : "text-gray-700 dark:text-gray-300"}`}>
                      {page.label}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setPermPages(ALL_PAGES.map((p) => p.key))}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Select All
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  onClick={() => setPermPages([])}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  Clear All
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPermissions(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={savePermissions}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
