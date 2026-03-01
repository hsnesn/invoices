"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface InvoiceResult {
  id: string;
  invoice_number: string;
  guest_name: string;
}

interface PersonResult {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface SearchResults {
  invoices: InvoiceResult[];
  people: PersonResult[];
}

interface PageItem {
  title: string;
  href: string;
}

interface FlatItem {
  type: "invoice" | "person" | "page";
  data: InvoiceResult | PersonResult | PageItem;
}

const SEARCH_PAGES: PageItem[] = [
  { title: "Guest Invoices", href: "/invoices" },
  { title: "Contractor Invoices", href: "/freelancer-invoices" },
  { title: "Office Requests", href: "/office-requests" },
  { title: "Projects", href: "/projects" },
  { title: "Vendors & Suppliers", href: "/vendors" },
  { title: "Reports", href: "/admin/reports" },
  { title: "Messages", href: "/messages" },
  { title: "Setup", href: "/admin/setup" },
  { title: "Salaries", href: "/salaries" },
  { title: "Other Invoices", href: "/other-invoices" },
  { title: "Invited Guests", href: "/invoices/invited-guests" },
  { title: "Request", href: "/request" },
  { title: "My Availability", href: "/contractor-availability" },
  { title: "Dashboard", href: "/dashboard" },
];

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({
    invoices: [],
    people: [],
  });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const pageMatches = query.trim().length >= 1
    ? SEARCH_PAGES.filter(
        (p) =>
          p.title.toLowerCase().includes(query.trim().toLowerCase()) ||
          p.href.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 5)
    : [];

  const flatItems: FlatItem[] = [
    ...pageMatches.map((p) => ({ type: "page" as const, data: p })),
    ...results.invoices.map(
      (inv) => ({ type: "invoice" as const, data: inv }) as FlatItem
    ),
    ...results.people.map(
      (p) => ({ type: "person" as const, data: p }) as FlatItem
    ),
  ];

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults({ invoices: [], people: [] });
    setActiveIndex(0);
  }, []);

  const navigate = useCallback(
    (item: FlatItem) => {
      if (item.type === "invoice") {
        const inv = item.data as InvoiceResult;
        router.push(`/invoices?search=${encodeURIComponent(inv.invoice_number)}`);
      } else if (item.type === "page") {
        const page = item.data as PageItem;
        router.push(page.href);
      } else {
        router.push("/admin/users");
      }
      close();
    },
    [router, close]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults({ invoices: [], people: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data: SearchResults = await res.json();
          setResults(data);
          setActiveIndex(0);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatItems.length > 0) {
      e.preventDefault();
      navigate(flatItems[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[5vh] sm:pt-[15vh] px-2 sm:px-4 animate-in fade-in duration-150 overflow-y-auto"
      onClick={close}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-slate-900 dark:ring-slate-700"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-slate-700">
          <svg
            className="h-5 w-5 shrink-0 text-gray-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, invoices, people..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-slate-500"
          />
          <kbd className="hidden rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline-block dark:bg-slate-800 dark:text-slate-500">
            ESC
          </kbd>
        </div>

        <div className="max-h-[min(20rem,60vh)] overflow-y-auto p-2 flex-1 min-h-0">
          {loading && (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              Searching...
            </p>
          )}

          {!loading && query.trim().length >= 1 && flatItems.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              No results found.
            </p>
          )}

          {!loading && pageMatches.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Pages
              </p>
              {pageMatches.map((page, i) => (
                <button
                  key={page.href + page.title}
                  onClick={() => navigate({ type: "page", data: page })}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeIndex === i
                      ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                      : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </span>
                  <p className="truncate font-medium">{page.title}</p>
                </button>
              ))}
            </div>
          )}

          {!loading && results.invoices.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Invoices
              </p>
              {results.invoices.map((inv, i) => {
                const idx = pageMatches.length + i;
                return (
                  <button
                    key={inv.id}
                    onClick={() =>
                      navigate({ type: "invoice", data: inv })
                    }
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeIndex === idx
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {inv.invoice_number && inv.invoice_number !== "—"
                          ? inv.invoice_number
                          : `Invoice ${inv.id.slice(0, 8)}`}
                      </p>
                      <p className="truncate text-xs text-gray-400 dark:text-slate-500">
                        {inv.guest_name && inv.guest_name !== "—"
                          ? inv.guest_name
                          : "No beneficiary"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && results.people.length > 0 && (
            <div className={results.invoices.length > 0 || pageMatches.length > 0 ? "mt-2" : ""}>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                People
              </p>
              {results.people.map((person, i) => {
                const idx = pageMatches.length + results.invoices.length + i;
                return (
                  <button
                    key={person.id}
                    onClick={() =>
                      navigate({ type: "person", data: person })
                    }
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      activeIndex === idx
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {person.full_name}
                      </p>
                      <p className="truncate text-xs text-gray-400 dark:text-slate-500">
                        {person.email}
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-slate-800">
                          {person.role}
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && query.trim().length < 1 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400 dark:text-slate-500">
              Type to search pages, invoices, or people.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-4 py-2 dark:border-slate-700">
          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500">
            <kbd className="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium dark:bg-slate-800">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500">
            <kbd className="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium dark:bg-slate-800">
              ↵
            </kbd>
            Open
          </span>
        </div>
      </div>
    </div>
  );
}
