"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  invoices: "Guest Invoices",
  "freelancer-invoices": "Contractor Invoices",
  salaries: "Salaries",
  profile: "Profile",
  admin: "Admin",
  setup: "Setup",
  reports: "Reports",
  users: "User Management",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm min-w-0 flex-wrap">
      <Link
        href="/dashboard"
        className="text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Home
      </Link>
      {segments.map((seg, i) => {
        const href = "/" + segments.slice(0, i + 1).join("/");
        const label = LABELS[seg] ?? seg.replace(/-/g, " ");
        const isLast = i === segments.length - 1;
        return (
          <span key={href} className="flex items-center gap-2">
            <span className="text-gray-300 dark:text-gray-600">/</span>
            {isLast ? (
              <span className="font-medium text-gray-900 dark:text-white">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
