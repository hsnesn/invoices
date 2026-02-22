"use client";

import { useState, useEffect, useMemo } from "react";
import type { Profile } from "@/lib/types";

type UserRow = Profile & { email?: string };

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800",
  manager: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  finance: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  submitter: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600",
};

export function AdminUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [invitations, setInvitations] = useState<
    { id: string; email: string; full_name: string | null; role: string; accepted: boolean }[]
  >([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"submitter" | "manager" | "admin" | "finance">("submitter");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [editingRole, setEditingRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
    fetch("/api/invitations")
      .then((r) => r.json())
      .then((d) => setInvitations(Array.isArray(d) ? d : []))
      .catch(() => setInvitations([]));
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/programs")
      .then((r) => r.json())
      .then((d) => setPrograms(Array.isArray(d) ? d : []))
      .catch(() => {});
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
      setMessage({ type: "success", text: "Invitation sent." });
      setInviteEmail("");
      setInviteName("");
      fetch("/api/invitations").then((r) => r.json()).then(setInvitations);
    } else {
      setMessage({ type: "error", text: data.error });
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
      alert(data.error || "Failed");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: newRole }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as never } : u))
      );
    }
    setEditingRole(null);
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

      {/* Invite */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Invite User</h2>
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
                setInviteRole(e.target.value as "submitter" | "manager" | "admin" | "finance")
              }
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="submitter">Submitter</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="finance">Finance</option>
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
          Invitations ({invitations.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {invitations.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No invitations</td></tr>
              ) : (
                invitations.map((inv) => (
                  <tr key={inv.id} className="bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{inv.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{inv.full_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[inv.role] ?? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={inv.accepted ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                        {inv.accepted ? "Accepted" : "Pending"}
                      </span>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Users ({filteredUsers.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email..."
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="finance">Finance</option>
              <option value="submitter">Submitter</option>
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
                        <option value="admin">Admin</option>
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
    </div>
  );
}
