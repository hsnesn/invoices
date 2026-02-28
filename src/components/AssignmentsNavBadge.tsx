"use client";

import Link from "next/link";
import useSWR from "swr";
import type { Profile } from "@/lib/types";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export function AssignmentsNavBadge({ profile }: { profile: Profile }) {
  const canManage = ["admin", "operations", "manager"].includes(profile?.role ?? "");
  const { data } = useSWR<{ pendingCount?: number }>(
    canManage ? "/api/contractor-availability/dashboard-stats" : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );
  const pending = data?.pendingCount ?? 0;

  if (!canManage || pending === 0) return null;

  return (
    <Link
      href="/contractor-availability?tab=assignments"
      className="relative inline-flex items-center gap-1.5 rounded-lg p-2 sm:p-0 text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/30 sm:hover:bg-transparent"
      title={`${pending} assignment(s) pending review`}
      aria-label={`Assignments pending: ${pending}`}
    >
      <svg className="h-5 w-5 shrink-0 sm:hidden" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      <span className="hidden sm:inline text-sm">Assignments</span>
      <span className="flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
        {pending > 99 ? "99+" : pending}
      </span>
    </Link>
  );
}
