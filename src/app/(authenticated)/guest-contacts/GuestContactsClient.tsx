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
  last_appearance_date?: string;
  department_name?: string | null;
  program_name?: string | null;
  ai_contact_info?: AiContactInfo;
  guest_contact_id?: string;
  is_favorite?: boolean;
  tags?: string[];
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
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [filterBy, setFilterBy] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [progFilter, setProgFilter] = useState<string>("all");
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<string>("name");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [bulkEmailModal, setBulkEmailModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 25;

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

  const toggleGuestSelection = (name: string) => {
    setSelectedGuests((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const unique = Array.from(new Set(filtered.map((c) => c.guest_name)));
    if (selectedGuests.size >= unique.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(unique));
    }
  };

  const runBulkAiSearch = async () => {
    const namesToSearch = selectedGuests.size > 0
      ? Array.from(selectedGuests)
      : Array.from(new Set(filtered.map((c) => c.guest_name)));
    if (namesToSearch.length === 0) {
      alert("No guests to search.");
      return;
    }
    setBulkSearching(true);
    try {
      const res = await fetch("/api/guest-contacts/bulk-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_names: namesToSearch }),
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

  const now = new Date();
  const dateCutoff = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.getTime();
  };
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  const departments = Array.from(new Set(contacts.map((c) => c.department_name).filter(Boolean))) as string[];
  const programs = Array.from(new Set(contacts.map((c) => c.program_name).filter(Boolean))) as string[];

  const filtered = contacts
    .filter((c) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.guest_name.toLowerCase().includes(q) ||
        (c.title?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.tags?.some((t) => t.toLowerCase().includes(q)) ?? false);
      if (!matchesSearch) return false;
      if (filterBy === "has_phone") return !!(c.phone || c.ai_contact_info?.phone);
      if (filterBy === "has_email") return !!(c.email || c.ai_contact_info?.email);
      if (filterBy === "has_ai") return !!c.ai_contact_info;
      if (filterBy === "missing_phone") return !c.phone && !c.ai_contact_info?.phone;
      if (filterBy === "missing_email") return !c.email && !c.ai_contact_info?.email;
      if (dateFilter !== "all") {
        const d = c.last_appearance_date || c.created_at;
        if (!d) return false;
        const t = new Date(d).getTime();
        if (dateFilter === "7" && t < dateCutoff(7)) return false;
        if (dateFilter === "30" && t < dateCutoff(30)) return false;
        if (dateFilter === "90" && t < dateCutoff(90)) return false;
        if (dateFilter === "year" && t < startOfYear) return false;
      }
      if (deptFilter !== "all" && c.department_name !== deptFilter) return false;
      if (progFilter !== "all" && c.program_name !== progFilter) return false;
      if (favoriteFilter === true && !c.is_favorite) return false;
      if (favoriteFilter === false && c.is_favorite) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        const ta = (a.last_appearance_date || a.created_at) ? new Date(a.last_appearance_date || a.created_at).getTime() : 0;
        const tb = (b.last_appearance_date || b.created_at) ? new Date(b.last_appearance_date || b.created_at).getTime() : 0;
        return tb - ta;
      }
      return a.guest_name.localeCompare(b.guest_name);
    });

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;

  const similarNames = (() => {
    const seen = new Map<string, string[]>();
    for (const c of contacts) {
      const key = c.guest_name.toLowerCase().replace(/\s+/g, " ").trim();
      const parts = key.split(/\s+/);
      const short = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : key;
      if (!seen.has(short)) seen.set(short, []);
      const arr = seen.get(short)!;
      if (!arr.includes(c.guest_name)) arr.push(c.guest_name);
    }
    return Array.from(seen.values()).filter((arr) => arr.length > 1);
  })();

  const toggleFavorite = async (c: Contact) => {
    const next = !c.is_favorite;
    if (c.guest_contact_id) {
      try {
        const res = await fetch(`/api/guest-contacts/${c.guest_contact_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_favorite: next }),
          credentials: "same-origin",
        });
        if (res.ok) window.location.reload();
        else alert((await res.json()).error ?? "Failed");
      } catch {
        alert("Request failed");
      }
    } else {
      try {
        const res = await fetch("/api/guest-contacts/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guest_name: c.guest_name, is_favorite: next }),
          credentials: "same-origin",
        });
        if (res.ok) window.location.reload();
        else alert((await res.json()).error ?? "Failed");
      } catch {
        alert("Request failed");
      }
    }
  };

  const saveContact = async (payload: { guest_name: string; phone?: string | null; email?: string | null; title?: string | null; tags?: string[] }) => {
    setSaving(true);
    try {
      if (editContact?.guest_contact_id) {
        const res = await fetch(`/api/guest-contacts/${editContact.guest_contact_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin",
        });
        const data = await res.json();
        if (res.ok) {
          setEditContact(null);
          window.location.reload();
        } else {
          alert(data.error ?? "Update failed");
        }
      } else {
        const res = await fetch("/api/guest-contacts/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin",
        });
        const data = await res.json();
        if (res.ok) {
          setEditContact(null);
          window.location.reload();
        } else {
          alert(data.error ?? "Update failed");
        }
      }
    } catch {
      alert("Request failed");
    } finally {
      setSaving(false);
    }
  };

  const createContact = async (payload: { guest_name: string; phone?: string | null; email?: string | null; title?: string | null }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/guest-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        setAddModal(false);
        window.location.reload();
      } else {
        alert(data.error ?? "Create failed");
      }
    } catch {
      alert("Request failed");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Guest Name", "Title", "Phone", "Email", "Invoice date", "Invoice"];
    const rows = filtered.map((c) => [
      c.guest_name,
      c.title ?? "",
      c.phone ?? c.ai_contact_info?.phone ?? "",
      c.email ?? c.ai_contact_info?.email ?? "",
      c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "",
      c.invoice_id ? `${window.location.origin}/invoices/${c.invoice_id}` : "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `guest-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Remove this contact from the list?")) return;
    try {
      const res = await fetch(`/api/guest-contacts/${id}`, { method: "DELETE", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        alert(data.error ?? "Delete failed");
      }
    } catch {
      alert("Request failed");
    }
  };

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
        <select
          value={filterBy}
          onChange={(e) => { setFilterBy(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          aria-label="Filter contacts"
        >
          <option value="all">All contacts</option>
          <option value="has_phone">Has phone</option>
          <option value="has_email">Has email</option>
          <option value="has_ai">Has AI data</option>
          <option value="missing_phone">Missing phone</option>
          <option value="missing_email">Missing email</option>
        </select>
        <select
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          aria-label="Filter by invoice date"
        >
          <option value="all">All dates</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="year">This year</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          aria-label="Sort by"
        >
          <option value="name">Sort by name</option>
          <option value="date">Sort by date (newest)</option>
        </select>
        {departments.length > 0 && (
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            aria-label="Filter by department"
          >
            <option value="all">All departments</option>
            {departments.sort().map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
        {programs.length > 0 && (
          <select
            value={progFilter}
            onChange={(e) => { setProgFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            aria-label="Filter by programme"
          >
            <option value="all">All programmes</option>
            {programs.sort().map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setFavoriteFilter(favoriteFilter === true ? null : true)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${favoriteFilter === true ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"}`}
        >
          ★ Favorites
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg px-3 py-2 text-sm ${viewMode === "table" ? "bg-gray-200 dark:bg-gray-700" : "border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"}`}
            aria-label="Table view"
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("card")}
            className={`rounded-lg px-3 py-2 text-sm ${viewMode === "card" ? "bg-gray-200 dark:bg-gray-700" : "border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"}`}
            aria-label="Card view"
          >
            Card
          </button>
        </div>
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
              {bulkSearching ? "Searching..." : `Bulk AI search (${selectedGuests.size || "all"} selected)`}
            </button>
            <button
              type="button"
              onClick={() => setAddModal(true)}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Add contact
            </button>
            <button
              type="button"
              onClick={() => setBulkEmailModal(true)}
              disabled={selectedGuests.size === 0}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Bulk email ({selectedGuests.size})
            </button>
          </>
        )}
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Export CSV
        </button>
        {extractMessage && (
          <span className="text-sm text-gray-600 dark:text-gray-400">{extractMessage}</span>
        )}
        {bulkMessage && (
          <span className="text-sm text-gray-600 dark:text-gray-400">{bulkMessage}</span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} contacts
          {(filterBy !== "all" || dateFilter !== "all" || deptFilter !== "all" || progFilter !== "all" || favoriteFilter) && " (filtered)"}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
            >
              Previous
            </button>
            <span className="px-2 text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {similarNames.length > 0 && (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
          <strong className="text-amber-800 dark:text-amber-200">Possible duplicates:</strong>{" "}
          {similarNames.slice(0, 3).map((arr) => arr.join(" / ")).join(" • ")}
          {similarNames.length > 3 && ` (+${similarNames.length - 3} more)`}
        </div>
      )}

      {viewMode === "table" ? (
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {isAdmin && (
                <th className="w-10 px-2 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selectedGuests.size >= Array.from(new Set(paginated.map((c) => c.guest_name))).length}
                    onChange={toggleSelectAll}
                    aria-label="Select all guests"
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                </th>
              )}
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Guest Name
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Last appearance
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Dept
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Programme
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Title
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Phone
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Email
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Invoice
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                AI Found
              </th>
              <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                AI Assessment
              </th>
              {isAdmin && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 12 : 10} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {contacts.length === 0
                    ? "No guest data found yet. Data appears from invoices (guest name, title, phone, email when available)."
                    : "No matches for your search."}
                </td>
              </tr>
            ) : (
              paginated.map((c) => (
                <tr key={`${c.guest_name}-${c.invoice_id ?? "bulk"}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  {isAdmin && (
                    <td className="px-2 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={selectedGuests.has(c.guest_name)}
                        onChange={() => toggleGuestSelection(c.guest_name)}
                        aria-label={`Select ${c.guest_name}`}
                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                    </td>
                  )}
                  <td className="max-w-[140px] px-3 py-2 align-top text-sm font-medium text-gray-900 dark:text-white">
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(c)}
                        className="shrink-0 text-amber-500 hover:text-amber-600"
                        title={c.is_favorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        {c.is_favorite ? "★" : "☆"}
                      </button>
                      <span className="block truncate" title={c.guest_name}>{c.guest_name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400">
                    {(c.last_appearance_date || c.created_at) ? new Date(c.last_appearance_date || c.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="max-w-[100px] px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400 truncate" title={c.department_name ?? undefined}>
                    {c.department_name || "—"}
                  </td>
                  <td className="max-w-[100px] px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400 truncate" title={c.program_name ?? undefined}>
                    {c.program_name || "—"}
                  </td>
                  <td className="max-w-[200px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                    <span className="block truncate" title={c.title || undefined}>{c.title || "—"}</span>
                  </td>
                  <td className="max-w-[120px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} title={c.phone} className="block truncate text-sky-600 hover:underline dark:text-sky-400">
                        {c.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[160px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} title={c.email} className="block truncate text-sky-600 hover:underline dark:text-sky-400">
                        {c.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-sm">
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
                  <td className="max-w-[220px] px-3 py-2 align-top text-sm">
                    {c.ai_contact_info ? (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {c.ai_contact_info.phone && (
                          <a href={`tel:${c.ai_contact_info.phone}`} title={c.ai_contact_info.phone} className="inline-flex items-center gap-0.5 truncate max-w-full text-sky-600 hover:underline dark:text-sky-400">
                            <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">AI</span>
                            <span className="truncate">{c.ai_contact_info.phone}</span>
                          </a>
                        )}
                        {c.ai_contact_info.email && (
                          <a href={`mailto:${c.ai_contact_info.email}`} title={c.ai_contact_info.email} className="inline-flex items-center gap-0.5 truncate max-w-full text-sky-600 hover:underline dark:text-sky-400">
                            <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">AI</span>
                            <span className="truncate">{c.ai_contact_info.email}</span>
                          </a>
                        )}
                        {c.ai_contact_info.social_media?.map((url) => {
                          let label = "Link";
                          try {
                            if (url.includes("instagram")) label = "Instagram";
                            else if (url.includes("linkedin")) label = "LinkedIn";
                            else if (url.includes("twitter") || url.includes("x.com")) label = "X";
                            else if (url.includes("facebook")) label = "Facebook";
                            else label = new URL(url).hostname.replace("www.", "");
                          } catch {
                            label = url.length > 20 ? url.slice(0, 17) + "…" : url;
                          }
                          return (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer" title={url} className="inline-flex items-center gap-0.5 text-sky-600 hover:underline dark:text-sky-400">
                              <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">AI</span>
                              <span>{label}</span>
                            </a>
                          );
                        })}
                        {!c.ai_contact_info.phone && !c.ai_contact_info.email && (!c.ai_contact_info.social_media?.length) && (
                          <span className="text-gray-400 text-xs">No AI results</span>
                        )}
                        <button
                          type="button"
                          onClick={() => runAiSearch(c.guest_name)}
                          disabled={!!searchingGuest}
                          className="shrink-0 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
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
                  <td className="px-3 py-2 align-top text-sm">
                    <button
                      type="button"
                      onClick={() => openGuestAssessment(c.guest_name)}
                      className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
                    >
                      View AI Assessment
                    </button>
                  </td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setEditContact(c)}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                          Edit
                        </button>
                        {c.guest_contact_id && (
                          <button
                            type="button"
                            onClick={() => deleteContact(c.guest_contact_id!)}
                            className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:hover:bg-red-900/20"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paginated.map((c) => (
            <div
              key={`${c.guest_name}-${c.invoice_id ?? "bulk"}`}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => toggleFavorite(c)} className="shrink-0 text-amber-500 hover:text-amber-600">
                      {c.is_favorite ? "★" : "☆"}
                    </button>
                    <span className="font-medium text-gray-900 dark:text-white">{c.guest_name}</span>
                  </div>
                  {c.title && <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{c.title}</p>}
                </div>
                {isAdmin && (
                  <input
                    type="checkbox"
                    checked={selectedGuests.has(c.guest_name)}
                    onChange={() => toggleGuestSelection(c.guest_name)}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600"
                  />
                )}
              </div>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                {c.phone && <a href={`tel:${c.phone}`} className="block truncate text-sky-600 dark:text-sky-400">{c.phone}</a>}
                {(c.email || c.ai_contact_info?.email) && (
                  <a href={`mailto:${c.email || c.ai_contact_info?.email}`} className="block truncate text-sky-600 dark:text-sky-400">
                    {c.email || c.ai_contact_info?.email}
                  </a>
                )}
                {(c.department_name || c.program_name) && (
                  <p className="text-xs text-gray-500">{[c.department_name, c.program_name].filter(Boolean).join(" • ")}</p>
                )}
                {(c.last_appearance_date || c.created_at) && (
                  <p className="text-xs text-gray-500">
                    Last: {new Date(c.last_appearance_date || c.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.invoice_id && (
                  <Link href={`/invoices/${c.invoice_id}`} className="text-xs text-sky-600 dark:text-sky-400">View invoice</Link>
                )}
                <button type="button" onClick={() => openGuestAssessment(c.guest_name)} className="text-xs text-sky-600 dark:text-sky-400">
                  AI Assessment
                </button>
                {isAdmin && (
                  <>
                    <button type="button" onClick={() => setEditContact(c)} className="text-xs text-gray-500">Edit</button>
                    {c.guest_contact_id && (
                      <button type="button" onClick={() => deleteContact(c.guest_contact_id!)} className="text-xs text-red-600">Remove</button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {editContact && (
        <ContactFormModal
          modalTitle="Edit contact"
          initial={{ guest_name: editContact.guest_name, phone: editContact.phone, email: editContact.email, title: editContact.title, tags: editContact.tags }}
          onSave={(payload) => saveContact(payload)}
          onClose={() => setEditContact(null)}
          saving={saving}
        />
      )}

      {addModal && (
        <ContactFormModal
          modalTitle="Add contact"
          initial={{ guest_name: "", phone: "", email: "", title: "" }}
          onSave={(payload) => createContact(payload)}
          onClose={() => setAddModal(false)}
          saving={saving}
        />
      )}

      {bulkEmailModal && (
        <BulkEmailModal
          contacts={filtered.filter((c) => selectedGuests.has(c.guest_name))}
          onClose={() => setBulkEmailModal(false)}
          onSent={() => { setBulkEmailModal(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}

function BulkEmailModal({ contacts, onClose, onSent }: { contacts: Contact[]; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const withEmail = contacts.filter((c) => c.email || c.ai_contact_info?.email);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      alert("Subject and message are required");
      return;
    }
    if (withEmail.length === 0) {
      alert("No selected contacts have email addresses");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/guest-contacts/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contacts: withEmail.map((c) => ({ guest_name: c.guest_name, email: c.email || c.ai_contact_info?.email })),
          subject: subject.trim(),
          message: message.trim(),
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message ?? "Email sent.");
        onSent();
      } else {
        alert(data.error ?? "Failed to send");
      }
    } catch {
      alert("Request failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bulk email</h2>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {withEmail.length} of {contacts.length} selected have email. Email will be sent to each recipient.
        </p>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={sending || withEmail.length === 0} className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white disabled:opacity-50">
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContactFormModal({
  modalTitle,
  initial,
  onSave,
  onClose,
  saving,
}: {
  modalTitle: string;
  initial: { guest_name: string; phone: string | null; email: string | null; title: string | null; tags?: string[] };
  onSave: (p: { guest_name: string; phone?: string | null; email?: string | null; title?: string | null; tags?: string[] }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [guestName, setGuestName] = useState(initial.guest_name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [tagsStr, setTagsStr] = useState((initial.tags ?? []).join(", "));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name || name.length < 2) {
      alert("Guest name is required (min 2 chars)");
      return;
    }
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({
      guest_name: name,
      phone: phone.trim() || null,
      email: email.trim() || null,
      title: title.trim() || null,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-form-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="contact-form-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="guest_name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Guest name *
            </label>
            <input
              id="guest_name"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              minLength={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="tags" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tags (comma-separated)
            </label>
            <input
              id="tags"
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. VIP, regular, journalist"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
