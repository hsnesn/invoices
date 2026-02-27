"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toUserFriendlyError } from "@/lib/error-messages";

type AiContactInfo = { phone?: string | null; email?: string | null; social_media?: string[] } | null;

type Contact = {
  guest_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  invoice_id: string | null;
  created_at: string;
  ai_contact_info?: AiContactInfo;
};

type Appearance = {
  date: string;
  topic: string;
  programme: string;
  department: string;
  amount: string;
  invoice_id: string;
};

export function GuestContactsClient({ contacts, isAdmin }: { contacts: Contact[]; isAdmin?: boolean }) {
  const [search, setSearch] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractMessage, setExtractMessage] = useState<string | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [searchingGuest, setSearchingGuest] = useState<string | null>(null);
  const [bulkSearching, setBulkSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [appearances, setAppearances] = useState<Appearance[]>([]);

  const runExtraction = async () => {
    setExtracting(true);
    setExtractMessage(null);
    try {
      const res = await fetch("/api/admin/extract-guest-contacts", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setExtractMessage(data.message ?? "Done. Refresh the page to see updated contacts.");
      } else {
        setExtractMessage(data.error ?? "Extraction failed");
      }
    } catch {
      setExtractMessage("Request failed");
    } finally {
      setExtracting(false);
    }
  };

  const runBulkUpload = async () => {
    const input = fileInputRef.current;
    if (!input?.files?.length) {
      setBulkMessage("Select files first.");
      return;
    }
    const files = Array.from(input.files);
    if (files.length > 10) {
      setBulkMessage("Maximum 10 files per upload (to avoid timeout).");
      return;
    }
    setBulkUploading(true);
    setBulkMessage(null);
    try {
      const formData = new FormData();
      for (const f of files) formData.append("files", f);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000);
      const res = await fetch("/api/admin/bulk-upload-guest-contacts", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        credentials: "same-origin",
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      let data: { message?: string; total?: number; contactsAdded?: number; error?: string };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setBulkMessage(res.ok ? "Invalid response" : `Error ${res.status}: ${text.slice(0, 200)}`);
        return;
      }
      if (res.ok) {
        setBulkMessage(data.message ?? `Processed ${data.total} files. ${data.contactsAdded} contacts added.`);
        input.value = "";
        window.location.reload();
      } else {
        setBulkMessage(data.error ?? "Bulk upload failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setBulkMessage(msg.includes("abort") ? "Request timed out. Try fewer files (max 10)." : msg);
    } finally {
      setBulkUploading(false);
    }
  };

  const runBulkAiSearch = async () => {
    const uniqueNames = Array.from(new Set(contacts.map((c) => c.guest_name)));
    if (uniqueNames.length === 0) {
      alert("No guests to search.");
      return;
    }
    setBulkSearching(true);
    try {
      const res = await fetch("/api/guest-contacts/bulk-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_names: uniqueNames }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message + (data.errors?.length ? `\n\nSome errors:\n${data.errors.slice(0, 5).join("\n")}` : ""));
        window.location.reload();
      } else {
        alert(data.error ?? "Bulk search failed");
      }
    } catch {
      alert("Request failed");
    } finally {
      setBulkSearching(false);
    }
  };

  const runAiSearch = async (guestName: string) => {
    setSearchingGuest(guestName);
    try {
      const res = await fetch("/api/guest-contacts/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_name: guestName }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        alert(data.error ?? "Search failed");
      }
    } catch {
      alert("Request failed");
    } finally {
      setSearchingGuest(null);
    }
  };

  const openGuestAssessment = async (guestName: string) => {
    setSelectedGuest(guestName);
    setAssessment(null);
    setAppearances([]);
    setAssessmentLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const res = await fetch("/api/guest-contacts/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_name: guestName }),
        signal: controller.signal,
        credentials: "same-origin",
      });
      clearTimeout(timeoutId);
      const text = await res.text();
      let data: { assessment?: string; appearances?: Appearance[]; error?: string };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setAssessment(res.ok ? "Invalid response." : `Request failed (${res.status}).`);
        return;
      }
      if (res.ok) {
        setAssessment(data.assessment ?? "No assessment available.");
        setAppearances(data.appearances ?? []);
      } else {
        setAssessment(data.error ?? "Failed to load assessment.");
      }
    } catch (e) {
      const msg = toUserFriendlyError(e);
      const isConnection = /connection|network|fetch|timeout/i.test(msg);
      setAssessment(
        isConnection
          ? "Connection error. Check your internet. If the server times out (Vercel Hobby: 10s limit), try again or add OPENAI_API_KEY in Vercel env."
          : msg
      );
    } finally {
      setAssessmentLoading(false);
    }
  };

  const closeAssessment = () => {
    setSelectedGuest(null);
    setAssessment(null);
    setAppearances([]);
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.guest_name.toLowerCase().includes(q) ||
      (c.title?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guest Contacts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Guest names with phone and email from invoices (where available).
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, title, phone or email..."
          className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          aria-label="Search contacts"
        />
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={runExtraction}
              disabled={extracting}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {extracting ? "Scanning invoices..." : "Scan all invoices for contact info"}
            </button>
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg"
                className="hidden"
                aria-label="Select invoice files for bulk upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Select files (max 10)
              </button>
            </>
            <button
              type="button"
              onClick={runBulkUpload}
              disabled={bulkUploading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {bulkUploading ? "Processing..." : "Upload and extract contacts"}
            </button>
            <button
              type="button"
              onClick={runBulkAiSearch}
              disabled={bulkSearching || contacts.length === 0}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {bulkSearching ? "Searching..." : "Bulk AI search for all guests"}
            </button>
          </>
        )}
        {extractMessage && (
          <span className="text-sm text-gray-600 dark:text-gray-400">{extractMessage}</span>
        )}
        {bulkMessage && (
          <span className="text-sm text-gray-600 dark:text-gray-400">{bulkMessage}</span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Guest Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Invoice
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                AI Found
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                AI Assessment
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {contacts.length === 0
                    ? "No guest data found yet. Data appears from invoices (guest name, title, phone, email when available)."
                    : "No matches for your search."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={`${c.guest_name}-${c.invoice_id ?? "bulk"}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {c.guest_name}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-sm text-gray-600 dark:text-gray-300 break-words">
                    {c.title || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="text-sky-600 hover:underline dark:text-sky-400">
                        {c.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="text-sky-600 hover:underline dark:text-sky-400">
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {c.invoice_id ? (
                      <Link
                        href={`/invoices/${c.invoice_id}`}
                        className="text-sky-600 hover:underline dark:text-sky-400"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">Bulk upload</span>
                    )}
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-sm break-words">
                    {c.ai_contact_info ? (
                      <div className="space-y-1">
                        {c.ai_contact_info.phone && (
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              AI
                            </span>
                            <a href={`tel:${c.ai_contact_info.phone}`} className="text-sky-600 hover:underline dark:text-sky-400">
                              {c.ai_contact_info.phone}
                            </a>
                          </div>
                        )}
                        {c.ai_contact_info.email && (
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              AI
                            </span>
                            <a href={`mailto:${c.ai_contact_info.email}`} className="text-sky-600 hover:underline dark:text-sky-400">
                              {c.ai_contact_info.email}
                            </a>
                          </div>
                        )}
                        {c.ai_contact_info.social_media?.map((url) => (
                          <div key={url} className="flex items-start gap-1 break-all">
                            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              AI
                            </span>
                            <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="min-w-0 break-all text-sky-600 hover:underline dark:text-sky-400">
                              {url}
                            </a>
                          </div>
                        ))}
                        {!c.ai_contact_info.phone && !c.ai_contact_info.email && (!c.ai_contact_info.social_media?.length) && (
                          <span className="text-gray-400 text-xs">No AI results</span>
                        )}
                        <button
                          type="button"
                          onClick={() => runAiSearch(c.guest_name)}
                          disabled={!!searchingGuest}
                          className="mt-1 block text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                        >
                          {searchingGuest === c.guest_name ? "Searching..." : "Search again"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => runAiSearch(c.guest_name)}
                        disabled={!!searchingGuest}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        {searchingGuest === c.guest_name ? "Searching..." : "Search web"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => openGuestAssessment(c.guest_name)}
                      className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
                    >
                      View AI Assessment
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedGuest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assessment-title"
          onClick={closeAssessment}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="assessment-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                Guest: {selectedGuest}
              </h2>
              <button
                type="button"
                onClick={closeAssessment}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {assessmentLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading AI assessment...</p>
            ) : assessment ? (
              <>
                <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{assessment}</p>
                </div>
                {appearances.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Appearances ({appearances.length})
                    </h3>
                    <ul className="space-y-2">
                      {appearances.map((a, i) => (
                        <li
                          key={`${a.invoice_id}-${i}`}
                          className="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">{a.date}</span>
                          <span className="text-gray-600 dark:text-gray-300">{a.topic}</span>
                          <span className="text-gray-500 dark:text-gray-400">({a.programme})</span>
                          <span className="text-gray-500 dark:text-gray-400">{a.amount}</span>
                          <Link
                            href={`/invoices/${a.invoice_id}`}
                            className="ml-auto text-sky-600 hover:underline dark:text-sky-400"
                          >
                            View invoice
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
