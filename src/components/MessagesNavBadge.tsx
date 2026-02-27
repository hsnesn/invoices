"use client";

import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json());

export function MessagesNavBadge() {
  const { data } = useSWR<{ messagesUnread?: number }>(
    "/api/dashboard/my-tasks",
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 }
  );
  const unread = data?.messagesUnread ?? 0;

  return (
    <Link
      href="/messages"
      className="relative inline-flex items-center gap-1.5 rounded-lg p-2 sm:p-0 sm:py-0 sm:px-0 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white sm:hover:bg-transparent"
      title="Messages"
      aria-label={`Messages${unread > 0 ? `, ${unread} unread` : ""}`}
    >
      <svg className="h-5 w-5 shrink-0 sm:hidden" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <span className="hidden sm:inline text-sm">Messages</span>
      {unread > 0 && (
        <span className="flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
