"use client";

import Link from "next/link";
import useSWR from "swr";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { Profile, PageKey } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const statsFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

type Stats = {
  guest: { pending: number; paid: number; rejected: number; total: number };
  freelancer: { pending: number; paid: number; rejected: number; total: number };
  monthlyTrend: { month: string; guest: number; freelancer: number; total: number }[];
};

interface PageCard {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  pageKey: PageKey;
  adminOnly?: boolean;
  viewerHidden?: boolean;
}

const PAGES: PageCard[] = [
  {
    title: "Guest Invoices",
    description: "View, filter and manage guest invoices. Track approval status, payments and more.",
    href: "/invoices",
    color: "text-blue-500",
    gradient: "from-blue-500/20 to-blue-600/5",
    pageKey: "guest_invoices",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    title: "Contractor Invoices",
    description: "Submit and track freelancer payment invoices and contractor billing.",
    href: "/freelancer-invoices",
    color: "text-teal-500",
    gradient: "from-teal-500/20 to-teal-600/5",
    pageKey: "freelancer_invoices",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    title: "Salaries",
    description: "Manage salary payments, payroll records and compensation tracking.",
    href: "/salaries",
    color: "text-indigo-500",
    gradient: "from-indigo-500/20 to-indigo-600/5",
    pageKey: "salaries",
    viewerHidden: true,
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: "Setup",
    description: "Manage departments, programmes and system configuration.",
    href: "/admin/setup",
    color: "text-amber-500",
    gradient: "from-amber-500/20 to-amber-600/5",
    pageKey: "setup",
    adminOnly: true,
    viewerHidden: true,
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Guest Contacts",
    description: "List of guest names with phone and email from invoices. Admin-only by default.",
    href: "/guest-contacts",
    color: "text-violet-500",
    gradient: "from-violet-500/20 to-violet-600/5",
    pageKey: "guest_contacts",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
    ),
  },
  {
    title: "Reports",
    description: "Generate monthly/quarterly reports with department spending analysis.",
    href: "/admin/reports",
    color: "text-cyan-500",
    gradient: "from-cyan-500/20 to-cyan-600/5",
    pageKey: "reports",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: "User Management",
    description: "Invite users, manage roles, activate or deactivate accounts.",
    href: "/admin/users",
    color: "text-purple-500",
    gradient: "from-purple-500/20 to-purple-600/5",
    pageKey: "user_management",
    adminOnly: true,
    viewerHidden: true,
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DashboardHome({ profile }: { profile: Profile }) {
  const isAdmin = profile.role === "admin";
  const isViewer = profile.role === "viewer";
  const isOperations = profile.role === "operations";
  const userPages = profile.allowed_pages;
  const isSubmitter = profile.role === "submitter";
  const canSeeStats = !isSubmitter;
  const { data: stats, mutate } = useSWR<Stats>(
    canSeeStats ? "/api/dashboard/stats" : null,
    statsFetcher,
    { refreshInterval: 10000, revalidateOnFocus: true, dedupingInterval: 3000 }
  );

  const visiblePages = PAGES.filter((p) => {
    if (p.viewerHidden && isViewer) return false;
    if (p.pageKey === "setup" && (isAdmin || isOperations)) return true;
    if (p.adminOnly && !isAdmin) return false;
    if (isViewer) return ["guest_invoices", "freelancer_invoices", "reports"].includes(p.pageKey) || (p.pageKey === "guest_contacts" && !!userPages?.includes("guest_contacts"));
    if (isOperations) return ["guest_invoices", "freelancer_invoices", "reports", "salaries", "setup"].includes(p.pageKey);
    if (profile.role === "finance") return ["guest_invoices", "freelancer_invoices", "reports", "salaries"].includes(p.pageKey);
    if (p.pageKey === "guest_contacts") return isAdmin || (!!userPages && userPages.includes("guest_contacts"));
    if (userPages && userPages.length > 0) return userPages.includes(p.pageKey);
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl pb-16">
      {/* Hero Header */}
      <div className="mb-12 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-gray-200/80 dark:bg-gray-800 dark:ring-gray-700/80">
            <img src="/trt-logo.png" alt="TRT" className="h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              {getGreeting()}, {profile.full_name || "User"}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Invoice Approval Workflow
              <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
              <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {profile.role}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards - hidden from submitters */}
      {canSeeStats && stats && (
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Auto-refresh every 10s</span>
            <button
              type="button"
              onClick={() => void mutate()}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Refresh
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/30">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Guest Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-200">{stats.guest.pending}</p>
            <Link href="/invoices?group=pending" className="mt-2 inline-block text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">
              View →
            </Link>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/30">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Guest Paid</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800 dark:text-emerald-200">{stats.guest.paid}</p>
            <Link href="/invoices?group=paid" className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
              View →
            </Link>
          </div>
          <div className="rounded-xl border border-teal-200/80 bg-teal-50/80 p-4 shadow-sm dark:border-teal-800/60 dark:bg-teal-950/30">
            <p className="text-xs font-medium uppercase tracking-wider text-teal-600 dark:text-teal-400">Contractor Pending</p>
            <p className="mt-1 text-2xl font-bold text-teal-800 dark:text-teal-200">{stats.freelancer.pending}</p>
            <Link href="/freelancer-invoices" className="mt-2 inline-block text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
              View →
            </Link>
          </div>
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 p-4 shadow-sm dark:border-sky-800/60 dark:bg-sky-950/30">
            <p className="text-xs font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">Contractor Paid</p>
            <p className="mt-1 text-2xl font-bold text-sky-800 dark:text-sky-200">{stats.freelancer.paid}</p>
            <Link href="/freelancer-invoices" className="mt-2 inline-block text-sm font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300">
              View →
            </Link>
          </div>
        </div>
        </div>
      )}

      {/* Mini Chart - hidden from submitters */}
      {canSeeStats && stats?.monthlyTrend?.length ? (
        <div className="mb-8 rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/60">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Invoices by Month</h2>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="guest" fill="#3b82f6" name="Guest" radius={[4, 4, 0, 0]} />
                <Bar dataKey="freelancer" fill="#14b8a6" name="Contractor" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* Page Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="group flex flex-col rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md hover:shadow-gray-200/50 dark:border-gray-700/60 dark:bg-gray-900/60 dark:hover:border-gray-600 dark:hover:shadow-gray-900/50"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gray-50 ${page.color} dark:bg-gray-800/80`}>
                {page.icon}
              </div>
              <svg
                className="h-5 w-5 shrink-0 text-gray-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">
              {page.title}
            </h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {page.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Overview */}
      <div className="mt-8 rounded-xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-900/60">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          Quick Overview
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Navigate to Invoices to view statistics, apply filters and generate reports.
        </p>
      </div>

    </div>
  );
}
