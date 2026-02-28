"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import { useLogos } from "@/contexts/LogoContext";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { MessageNotificationSound } from "@/components/MessageNotificationSound";
import { MessagesNavBadge } from "@/components/MessagesNavBadge";
import { AssignmentsNavBadge } from "@/components/AssignmentsNavBadge";

const CAN_SUBMIT_ROLES = ["submitter", "admin", "operations", "manager"];

function canAccessGuestSubmit(profile: Profile): boolean {
  if (profile.role === "admin") return true;
  if (!CAN_SUBMIT_ROLES.includes(profile.role ?? "")) return false;
  const pages = profile.allowed_pages;
  if (!pages || pages.length === 0) return true;
  return pages.includes("submit_invoice");
}

function canAccessFreelancerInvoices(profile: Profile): boolean {
  if (profile.role === "admin") return true;
  if (profile.role === "viewer") return true;
  const pages = profile.allowed_pages;
  if (!pages || pages.length === 0) return true;
  return pages.includes("freelancer_invoices");
}

export function Nav({ profile }: { profile: Profile }) {
  const router = useRouter();
  const themeContext = useTheme();
  const logos = useLogos();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submitMenuOpen, setSubmitMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const canSubmitGuest = canAccessGuestSubmit(profile);
  const canSubmitFreelancer = canAccessFreelancerInvoices(profile);

  return (
    <>
      <MessageNotificationSound />
      <nav className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/80 bg-white/95 px-3 sm:px-6 py-2 sm:py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-gray-800 dark:bg-gray-900 dark:bg-gray-900/95 supports-[backdrop-filter]:dark:bg-gray-900/80 min-w-0">
      <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        <img
          src={logos.logo_trt || "/trt-logo.png"}
          alt="TRT"
          className="h-6 sm:h-8 object-contain shrink-0"
        />
        <span className="inline sm:hidden text-sm font-semibold text-gray-800 dark:text-white truncate">TRT UK Ops</span>
        <span className="hidden sm:inline text-sm sm:text-base font-semibold text-gray-800 dark:text-white truncate">
          TRT UK Operations Platform
        </span>
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {(canSubmitGuest || canSubmitFreelancer) && (
          <div className="relative shrink-0">
            {canSubmitGuest && !canSubmitFreelancer ? (
              <Link
                href="/submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="hidden sm:inline">Submit</span>
              </Link>
            ) : !canSubmitGuest && canSubmitFreelancer ? (
              <Link
                href="/freelancer-invoices/submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="hidden sm:inline">Submit</span>
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setSubmitMenuOpen(!submitMenuOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span className="hidden sm:inline">Submit</span>
                  <svg className="h-3 w-3 ml-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {submitMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setSubmitMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-[9999] w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      <Link
                        href="/submit"
                        onClick={() => setSubmitMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        Guest Invoice
                      </Link>
                      <Link
                        href="/freelancer-invoices/submit"
                        onClick={() => setSubmitMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        Contractor Invoice
                      </Link>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {themeContext && (
          <button
            onClick={themeContext.toggleTheme}
            className="rounded-lg p-1.5 sm:p-2 shrink-0 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
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
        <AssignmentsNavBadge profile={profile} />
        <MessagesNavBadge />
        <Link
          href="/help"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
          title="Help"
          aria-label="Help"
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
          className="hidden sm:inline-flex rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white shrink-0"
        >
          Sign out
        </button>
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          )}
        </button>
      </div>
      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="sm:hidden w-full border-t border-gray-200/80 dark:border-gray-700 pt-2 mt-1 flex flex-col gap-1">
          <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">{(profile.full_name || "?")[0].toUpperCase()}</span>
            )}
            {profile.full_name || profile.role} ({profile.role})
          </Link>
          <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Dashboard</Link>
          <Link href="/help" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Help</Link>
          <button onClick={() => { setMobileOpen(false); handleSignOut(); }} className="rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">Sign out</button>
        </div>
      )}
    </nav>
    </>
  );
}
