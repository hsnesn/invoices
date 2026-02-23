"use client";

import { useState, useEffect } from "react";

interface Department {
  id: string;
  name: string;
}

type DeptManager = { id: string; department_id: string; manager_user_id: string; department_name: string; manager_name: string };
type UserOption = { id: string; full_name: string | null; email?: string | null; role: string; is_active?: boolean };

const MIGRATION_SQL = `CREATE TABLE department_managers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  manager_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(department_id, manager_user_id)
);
CREATE INDEX idx_department_managers_dept ON department_managers(department_id);
ALTER TABLE department_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "department_managers_admin_all" ON department_managers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_active = true));`;

export function DepartmentManagersSection() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentManagers, setDepartmentManagers] = useState<DeptManager[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [addManagerDept, setAddManagerDept] = useState("");
  const [tableMissing, setTableMissing] = useState(false);

  const refresh = () => {
    setTableMissing(false);
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => setDepartments([]));
    fetch("/api/admin/department-managers")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok && d?.error && (String(d.error).includes("department_managers") || String(d.error).includes("schema cache"))) {
          setTableMissing(true);
          setDepartmentManagers([]);
        } else if (Array.isArray(d)) {
          setDepartmentManagers(d);
        } else if (d?.error) {
          setTableMissing(true);
          setDepartmentManagers([]);
        } else {
          setDepartmentManagers([]);
        }
      })
      .catch(() => setDepartmentManagers([]));
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  const addDepartmentManager = async (departmentId: string, managerUserId: string) => {
    if (!departmentId || !managerUserId) return;
    setLoading(true);
    setMessage(null);
    setAddManagerDept("");
    try {
      const res = await fetch("/api/admin/department-managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_id: departmentId, manager_user_id: managerUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        refresh();
        setMessage({ type: "success", text: "Manager assigned." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  const removeDepartmentManager = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/department-managers?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        refresh();
        setMessage({ type: "success", text: "Manager removed." });
      } else {
        setMessage({ type: "error", text: (data as { error?: string }).error || "Failed." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setLoading(false);
    }
  };

  if (tableMissing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
        <h2 className="mb-2 font-medium text-amber-900 dark:text-amber-200">Department Managers</h2>
        <p className="mb-4 text-sm text-amber-800 dark:text-amber-300">
          Run the migration in Supabase SQL Editor to create the <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">department_managers</code> table.
        </p>
        <div className="mb-4 rounded-lg border border-amber-300 bg-white p-4 dark:border-amber-700 dark:bg-gray-900">
          <pre className="overflow-x-auto text-xs text-gray-800 dark:text-gray-200">{MIGRATION_SQL}</pre>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Supabase Dashboard → SQL Editor → New query → Paste and Run
        </p>
        <button type="button" onClick={refresh} className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-500">
          Retry after migration
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-2 font-medium text-gray-900 dark:text-white">Department Managers (Line Managers)</h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Assign manager(s) per department. Invoices will be routed to the first assigned manager. Change anytime (leave, turnover).
      </p>
      {message && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${
          message.type === "success"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
            : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
        }`}>
          {message.text}
        </div>
      )}
      <div className="space-y-4">
        {departments.map((d) => {
          const managers = departmentManagers.filter((m) => m.department_id === d.id);
          const candidateUsers = users.filter(
            (u) => u.is_active !== false && (u.role === "manager" || u.role === "admin") && !managers.some((m) => m.manager_user_id === u.id)
          );
          return (
            <div key={d.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="mb-2 font-medium text-gray-800 dark:text-gray-200">{d.name}</div>
              <div className="flex flex-wrap items-center gap-2">
                {managers.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-sm text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                    {m.manager_name}
                    <button type="button" onClick={() => removeDepartmentManager(m.id)} disabled={loading} className="rounded p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50" title="Remove">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
                {addManagerDept === d.id ? (
                  <select
                    autoFocus
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) addDepartmentManager(d.id, v);
                      else setAddManagerDept("");
                    }}
                    onBlur={() => setAddManagerDept("")}
                  >
                    <option value="">Select...</option>
                    {candidateUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email || u.id.slice(0, 8)}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddManagerDept(d.id)}
                    disabled={loading}
                    className="rounded border border-dashed border-gray-400 px-2 py-1 text-sm text-gray-500 hover:border-gray-600 hover:text-gray-700 dark:border-gray-500 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                  >
                    + Add manager
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
