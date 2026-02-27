"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import { NotificationDropdown } from "@/components/NotificationDropdown";

export function Nav({ profile }: { profile: Profile }) {
  const router = useRouter();
  const themeContext = useTheme();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200/80 bg-white/95 px-4 sm:px-6 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-gray-800 dark:bg-gray-900 dark:bg-gray-900/95 supports-[backdrop-filter]:dark:bg-gray-900/80 min-w-0">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <img src="/trt-logo.png" alt="TRT" className="h-7 sm:h-8 object-contain shrink-0" />
          <span className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white truncate">
            Invoice Approval
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {themeContext && (
          <button
            onClick={themeContext.toggleTheme}
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            title={themeContext.theme === "dark" ? "Light mode" : "Dark mode"}
            aria-label={themeContext.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {themeContext.theme === "dark" ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd"/></svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
            )}
          </button>
        )}
        <NotificationDropdown profile={profile} />
        <Link
          href="/messages"
          className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
        >
          Messages
        </Link>
        <Link
          href="/help"
          className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
        >
          Help
        </Link>
        <Link
          href="/profile"
          className="hidden items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-white sm:inline-flex"
        >
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-600" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              {(profile.full_name || profile.role || "?")[0].toUpperCase()}
            </span>
          )}
          {profile.full_name || profile.role}
          <span className="ml-1 text-gray-400 dark:text-gray-500">({profile.role})</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
