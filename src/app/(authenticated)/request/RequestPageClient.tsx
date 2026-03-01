"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { RequestClient } from "./RequestClient";
import { PreferenceListTab } from "@/components/PreferenceListTab";
import { SlotsShortView } from "./SlotsShortView";
import { RequestChatPanel } from "./RequestChatPanel";

export function RequestPageClient() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "requirements";
  const view = searchParams.get("view");

  if (view === "slots-short") {
    return <SlotsShortView />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 -mx-1 sm:mx-0">
        <Link
          href="/request"
          className={`rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium ${
            tab === "requirements"
              ? "bg-violet-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Requirements
        </Link>
        <Link
          href="/request?tab=preference"
          className={`rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium ${
            tab === "preference"
              ? "bg-violet-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          My Preference List
        </Link>
        <Link
          href={`/request?tab=chat${searchParams.get("dept") ? `&dept=${searchParams.get("dept")}` : ""}${searchParams.get("month") ? `&month=${searchParams.get("month")}` : ""}`}
          className={`rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium ${
            tab === "chat"
              ? "bg-violet-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          Chat
        </Link>
      </div>

      {tab === "requirements" && <RequestClient />}
      {tab === "preference" && <PreferenceListTab />}
      {tab === "chat" && <RequestChatPanel />}
    </div>
  );
}
