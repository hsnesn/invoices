"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { Profile } from "@/lib/types";

const tasksFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

type MyTasks = {
  guest: { pending: number };
  freelancer: { pending: number };
  other?: { pending: number };
  messagesUnread?: number;
  totalPending: number;
};

type DashboardStats = {
  guest: { pending: number; paid: number; rejected: number; total: number };
  freelancer: { pending: number; paid: number; rejected: number; total: number };
  other: { pending: number; paid: number; rejected: number; total: number };
};

export function NotificationDropdown({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: tasks } = useSWR<MyTasks>(
    "/api/dashboard/my-tasks",
    tasksFetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );
  const { data: stats } = useSWR<DashboardStats>(
    open ? "/api/dashboard/stats" : null,
    tasksFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canSeeOther = profile.role !== "viewer" || profile.allowed_pages?.includes("other_invoices");
  const totalPending = tasks?.totalPending ?? 0;

  // Only show notification bell when user has pending tasks (hide when loading or empty)
  if (tasks === undefined || totalPending === 0) return null;

  const pendingActions: { label: string; count: number; href: string }[] = [];
  if (stats) {
    if (stats.guest.pending > 0)
      pendingActions.push({ label: "guest invoices awaiting approval", count: stats.guest.pending, href: "/invoices?group=pending" });
    if (stats.freelancer.pending > 0)
      pendingActions.push({ label: "contractor invoices awaiting approval", count: stats.freelancer.pending, href: "/freelancer-invoices" });
    if (canSeeOther && stats.other.pending > 0)
      pendingActions.push({ label: "other invoices awaiting payment", count: stats.other.pending, href: "/other-invoices" });
  }
  const totalActions = pendingActions.reduce((s, a) => s + a.count, 0);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-1.5 sm:p-2 shrink-0 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalPending > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white animate-pulse">
            {totalPending > 99 ? "99+" : totalPending}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {/* Pending Actions – pinned top section */}
          {pendingActions.length > 0 && (
            <div className="rounded-t-xl bg-amber-50 border-b border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <svg className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                  Pending Actions
                </span>
                <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {totalActions}
                </span>
              </div>
              <div className="pb-2">
                {pendingActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 px-4 py-1.5 text-left transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  >
                    <span className="text-xs text-amber-900 dark:text-amber-100">
                      {action.count} {action.label}
                    </span>
                    <svg className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Header */}
          <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Your Tasks</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Items requiring your action</p>
          </div>

          {/* Per-user pending tasks */}
          <div className="max-h-64 overflow-y-auto">
            {tasks !== undefined ? (
              <>
                {(tasks.guest?.pending ?? 0) > 0 && (
                  <Link
                    href="/invoices?group=pending"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">Guest invoices pending</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      {tasks.guest.pending}
                    </span>
                  </Link>
                )}
                {(tasks.freelancer?.pending ?? 0) > 0 && (
                  <Link
                    href="/freelancer-invoices"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-teal-50 dark:hover:bg-teal-950/30"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">Contractor invoices pending</span>
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                      {tasks.freelancer.pending}
                    </span>
                  </Link>
                )}
                {canSeeOther && (tasks.other?.pending ?? 0) > 0 && (
                  <Link
                    href="/other-invoices"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">Other invoices pending</span>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-200">
                      {tasks.other?.pending ?? 0}
                    </span>
                  </Link>
                )}
                {(tasks.messagesUnread ?? 0) > 0 && (
                  <Link
                    href="/messages"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">New messages</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                      {tasks.messagesUnread}
                    </span>
                  </Link>
                )}
                {totalPending === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No pending tasks for you
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              View dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
