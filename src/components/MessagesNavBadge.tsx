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
      className="relative inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
    >
      Messages
      {unread > 0 && (
        <span className="ml-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
