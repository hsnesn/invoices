"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  invoices: "Guest Invoices",
  "freelancer-invoices": "Contractor Invoices",
  "other-invoices": "Other Invoices",
  salaries: "Salaries",
  "contractor-availability": "My Availability",
  request: "Request",
  submit: "Submit Invoice",
  profile: "Profile",
  help: "Help",
  messages: "Messages",
  admin: "Admin",
  setup: "Setup",
  users: "User Management",
  reports: "Reports",
  "audit-log": "Audit Log",
  "guest-contacts": "Guest Contacts",
  "invited-guests": "Invited Guests",
  "office-requests": "Office Requests",
  projects: "Projects",
  vendors: "Vendors & Suppliers",
};

const UUID_RE = /^[0-9a-f]{8}-/;

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
        if (UUID_RE.test(seg)) return null;
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
