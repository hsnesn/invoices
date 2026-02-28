"use client";

import { useState, useEffect } from "react";

type PrefUser = {
  id: string;
  user_id: string;
  full_name: string;
  department_id: string | null;
  department_name: string | null;
  program_id: string | null;
  program_name: string | null;
  role: string | null;
};
type UserOption = { id: string; full_name: string };
type DeptOption = { id: string; name: string };
type ProgOption = { id: string; name: string; department_id: string };
type RoleOption = { id: string; value: string };

export function PreferenceListTab() {
  const [users, setUsers] = useState<PrefUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [programs, setPrograms] = useState<ProgOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [addDeptId, setAddDeptId] = useState("");
  const [addProgId, setAddProgId] = useState("");
  const [addRole, setAddRole] = useState("");

  const fetchList = () => {
    fetch("/api/contractor-availability/preference-list-mine")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d.users) ? d.users : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    fetch("/api/contractor-availability/preference-list-users")
      .then((r) => r.json())
      .then((d) => setAllUsers(Array.isArray(d) ? d : []))
      .catch(() => setAllUsers([]));
  }, []);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!addDeptId) {
      setPrograms([]);
      setAddProgId("");
      return;
    }
    fetch(`/api/programs?department_id=${addDeptId}`)
      .then((r) => r.json())
      .then((d) => setPrograms(Array.isArray(d) ? d : []))
      .catch(() => setPrograms([]));
    setAddProgId("");
  }, [addDeptId]);

  useEffect(() => {
    fetch("/api/contractor-availability/roles")
      .then((r) => r.json())
      .then((d) => setRoles(Array.isArray(d) ? d : []))
      .catch(() => setRoles([]));
  }, []);

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserId.trim()) return;
    const newItem = {
      preferred_user_id: addUserId,
      department_id: addDeptId || null,
      program_id: addProgId || null,
      role: addRole?.trim() || null,
    };
    const newItems = [
      ...users.map((u) => ({
        preferred_user_id: u.user_id,
        department_id: u.department_id,
        program_id: u.program_id,
        role: u.role,
      })),
      newItem,
    ];
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newItems }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddUserId("");
        setAddDeptId("");
        setAddProgId("");
        setAddRole("");
        setMessage({ type: "success", text: "Added to your preference list." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (itemId: string) => {
    const newItems = users.filter((u) => u.id !== itemId).map((u) => ({
      preferred_user_id: u.user_id,
      department_id: u.department_id,
      program_id: u.program_id,
      role: u.role,
    }));
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newItems }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Removed from your preference list." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to remove." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const moveUp = async (index: number) => {
    if (index <= 0) return;
    const items = users.map((u) => ({ preferred_user_id: u.user_id, department_id: u.department_id, program_id: u.program_id, role: u.role }));
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Order updated." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const moveDown = async (index: number) => {
    if (index >= users.length - 1) return;
    const items = users.map((u) => ({ preferred_user_id: u.user_id, department_id: u.department_id, program_id: u.program_id, role: u.role }));
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contractor-availability/preference-list-mine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Order updated." });
        fetchList();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(false);
    }
  };

  const addCtx = { dept: addDeptId || null, prog: addProgId || null, role: addRole?.trim() || null };
  const existingKeys = new Set(users.map((u) => `${u.user_id}|${u.department_id}|${u.program_id}|${u.role}`));
  const addKey = (id: string) => `${id}|${addCtx.dept}|${addCtx.prog}|${addCtx.role}`;
  const availableUsers = allUsers.filter((u) => !existingKeys.has(addKey(u.id)));

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading your preference list...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-violet-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
        My Preference List
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        People you prefer to work with. AI will prefer assigning people who appear in more users&apos; lists when they
        are available. Order matters: higher in the list = higher preference.
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

      <form onSubmit={addUser} className="mb-4 flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Person</label>
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white min-w-[160px]"
          >
            <option value="">Select...</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
          <select
            value={addDeptId}
            onChange={(e) => setAddDeptId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white min-w-[120px]"
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Program</label>
          <select
            value={addProgId}
            onChange={(e) => setAddProgId(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white min-w-[120px]"
          >
            <option value="">All</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
          <select
            value={addRole}
            onChange={(e) => setAddRole(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white min-w-[100px]"
          >
            <option value="">All</option>
            {roles.map((r) => (
              <option key={r.id} value={r.value}>
                {r.value}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || !addUserId}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <ul className="space-y-2">
        {users.map((u, i) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-6 shrink-0">{i + 1}.</span>
              <span className="font-medium text-gray-900 dark:text-white truncate">{u.full_name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2 gap-y-0.5">
                {u.department_name && <span title="Department">Dept: {u.department_name}</span>}
                {u.program_name && <span title="Program">Prog: {u.program_name}</span>}
                {u.role && <span title="Role" className="font-medium text-violet-600 dark:text-violet-400">Role: {u.role}</span>}
                {!u.department_name && !u.program_name && !u.role && <span>All contexts</span>}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => moveUp(i)}
                disabled={saving || i === 0}
                className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                title="Move up"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => moveDown(i)}
                disabled={saving || i === users.length - 1}
                className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300 disabled:opacity-40"
                title="Move down"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => removeUser(u.id)}
                disabled={saving}
                className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {users.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          No one in your preference list yet. Add people above. AI will prefer them when they are available.
        </p>
      )}
    </div>
  );
}
