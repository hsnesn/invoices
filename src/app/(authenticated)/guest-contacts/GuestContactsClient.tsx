"use client";

import Link from "next/link";
import { useExportLocale } from "@/contexts/ExportLocaleContext";
import { ExportLocaleSelector } from "@/components/ExportLocaleSelector";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toUserFriendlyError } from "@/lib/error-messages";
import { toast } from "sonner";
import { PHONE_COUNTRIES, DEFAULT_PHONE_COUNTRY, inferPhoneCountry } from "@/lib/phone-country-codes";
import { getProgramDescription, PROGRAM_DESCRIPTIONS } from "@/lib/program-descriptions";
import { buildInviteGreeting, type GreetingType } from "@/lib/invite-greeting";
import { LogoLoader } from "@/components/LogoLoader";
import { UploadOverlay } from "@/components/UploadOverlay";

type FilterParams = {
  search?: string;
  filterBy?: string;
  inviteFilter?: string;
  dateFilter?: string;
  deptFilter?: string;
  progFilter?: string;
  favoriteFilter?: boolean | null;
  titleFilter?: string;
  topicFilter?: string;
  sortBy?: string;
};

const COLUMNS_STORAGE_KEY = "guest-contacts-columns";

type AiContactInfo = { phone?: string | null; email?: string | null; social_media?: string[]; confidence?: number } | null;

type Contact = {
  guest_name: string;
  title: string | null;
  title_category?: string | null;
  topic: string | null;
  topic_category?: string | null;
  phone: string | null;
  email: string | null;
  invoice_id: string | null;
  created_at: string;
  last_appearance_date?: string;
  appearance_count?: number;
  department_name?: string | null;
  program_name?: string | null;
  organization?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  ai_contact_info?: AiContactInfo;
  ai_assessment?: string | null;
  guest_contact_id?: string;
  is_favorite?: boolean;
  tags?: string[];
  affiliated_orgs?: string[];
  prohibited_topics?: string[];
  conflict_of_interest_notes?: string | null;
  last_invited_at?: string | null;
  invite_status?: "accepted" | "rejected" | "no_response" | "no_match";
};

type Appearance = {
  date: string;
  topic: string;
  programme: string;
  department: string;
  amount: string;
  invoice_id: string;
};

/** Renders text with **bold** and *italic* markdown, with clear visual emphasis. */
function FormattedResearchText({ text, className = "" }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let key = 0;
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, m.index)}</span>);
    }
    const raw = m[1];
    if (raw.startsWith("**") && raw.endsWith("**")) {
      parts.push(
        <strong key={key++} className="font-bold text-amber-900 dark:text-amber-100">
          {raw.slice(2, -2)}
        </strong>
      );
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      parts.push(
        <em key={key++} className="italic text-gray-700 dark:text-gray-300">
          {raw.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(<span key={key++}>{raw}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return <p className={`whitespace-pre-wrap text-base leading-relaxed ${className}`}>{parts}</p>;
}

const COLUMN_IDS = ["guest_name", "last_appearance", "last_invited", "usage", "department", "programme", "title", "organization", "topic", "phone", "email", "invoice", "ai_found", "ai_assessment", "actions"] as const;
const COLUMN_LABELS: Record<string, string> = {
  guest_name: "Guest Name",
  last_appearance: "Last appearance",
  last_invited: "Last invited",
  usage: "Usage",
  department: "Dept",
  programme: "Programme",
  title: "Title",
  organization: "Organization",
  topic: "Topic",
  phone: "Phone",
  email: "Email",
  invoice: "Invoice",
  ai_found: "AI Found",
  ai_assessment: "AI Assessment",
  actions: "Actions",
};

export function GuestContactsClient({
  contacts,
  filteredContacts,
  totalCount,
  page,
  totalPages,
  pageSize,
  filterParams,
  departments,
  programs,
  titles,
  topics,
  hasEmptyTitle,
  hasEmptyTopic,
  similarNames: similarNamesProp,
  isAdmin,
  canExport = true,
  canUseRiskResearch = false,
}: {
  contacts: Contact[];
  filteredContacts: Contact[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  filterParams: FilterParams;
  departments: string[];
  programs: string[];
  titles: string[];
  topics: string[];
  hasEmptyTitle: boolean;
  hasEmptyTopic: boolean;
  similarNames: string[][];
  isAdmin?: boolean;
  canExport?: boolean;
  canUseRiskResearch?: boolean;
}) {
  const router = useRouter();
  const { locale: exportLocale } = useExportLocale();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(filterParams.search ?? "");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [assessmentCached, setAssessmentCached] = useState(false);
  const [appearances, setAppearances] = useState<Appearance[]>([]);
  const [riskAnalysis, setRiskAnalysis] = useState<string | null>(null);
  const [riskAnalysisSources, setRiskAnalysisSources] = useState<string[]>([]);
  const [riskAnalysisLoading, setRiskAnalysisLoading] = useState(false);
  const [riskAnalysisError, setRiskAnalysisError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatScope, setChatScope] = useState<"all" | "selected">("all");
  const [chatSelectedGuest, setChatSelectedGuest] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ query: string; summary: string; sources: string[]; guestName?: string | null }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [fullEvalGuest, setFullEvalGuest] = useState<string | null>(null);
  const [fullEvalLoading, setFullEvalLoading] = useState(false);
  const [fullEvalData, setFullEvalData] = useState<{ appearances: { topic: string; date: string; programme: string; department: string; amount: string; invoice_id: string }[]; risk_analysis: string; sources: string[] } | null>(null);
  const [fullEvalError, setFullEvalError] = useState<string | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [bulkEmailModal, setBulkEmailModal] = useState(false);
  const [columnsModal, setColumnsModal] = useState(false);
  const [mergeModal, setMergeModal] = useState<string[] | null>(null);
  const [merging, setMerging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeMessage, setCategorizeMessage] = useState<string | null>(null);
  const [duplicatesModal, setDuplicatesModal] = useState<{ primary: string; duplicates: { guest_name: string; id: string }[] }[] | null>(null);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const guestLogInputRef = useRef<HTMLInputElement>(null);
  const guestListInputRef = useRef<HTMLInputElement>(null);
  const [guestLogFile, setGuestLogFile] = useState<File | null>(null);
  const [guestLogImporting, setGuestLogImporting] = useState(false);
  const [guestLogMessage, setGuestLogMessage] = useState<string | null>(null);
  const [guestListFile, setGuestListFile] = useState<File | null>(null);
  const [guestListImporting, setGuestListImporting] = useState(false);
  const [guestListMessage, setGuestListMessage] = useState<string | null>(null);
  const [deleteBackupModal, setDeleteBackupModal] = useState(false);
  const [restoreModal, setRestoreModal] = useState(false);
  const [backups, setBackups] = useState<{ id: string; backed_up_at: string; contact_count: number }[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(COLUMN_IDS);
    try {
      const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        const valid = arr.filter((id) => (COLUMN_IDS as readonly string[]).includes(id));
        if (valid.length > 0) return new Set(valid);
      }
    } catch {
      // ignore
    }
    return new Set(COLUMN_IDS);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)));
    } catch {
      // ignore
    }
  }, [visibleColumns]);

  const updateUrl = (updates: Partial<FilterParams> & { page?: number }) => {
    const params = new URLSearchParams();
    const search = updates.search ?? filterParams.search ?? "";
    const filterBy = updates.filterBy ?? filterParams.filterBy ?? "all";
    const inviteFilterVal = updates.inviteFilter ?? filterParams.inviteFilter ?? "all";
    const dateFilter = updates.dateFilter ?? filterParams.dateFilter ?? "all";
    const deptFilter = updates.deptFilter ?? filterParams.deptFilter ?? "all";
    const progFilter = updates.progFilter ?? filterParams.progFilter ?? "all";
    const favoriteFilter = "favoriteFilter" in updates ? updates.favoriteFilter ?? null : filterParams.favoriteFilter ?? null;
    const titleFilter = updates.titleFilter ?? filterParams.titleFilter ?? "all";
    const topicFilter = updates.topicFilter ?? filterParams.topicFilter ?? "all";
    const sortBy = updates.sortBy ?? filterParams.sortBy ?? "name";
    const pageNum = updates.page ?? page;
    if (search) params.set("search", search);
    if (filterBy !== "all") params.set("filterBy", filterBy);
    if (inviteFilterVal !== "all") params.set("inviteFilter", inviteFilterVal);
    if (dateFilter !== "all") params.set("dateFilter", dateFilter);
    if (deptFilter !== "all") params.set("deptFilter", deptFilter);
    if (progFilter !== "all") params.set("progFilter", progFilter);
    if (favoriteFilter === true) params.set("favoriteFilter", "true");
    if (favoriteFilter === false) params.set("favoriteFilter", "false");
    if (titleFilter !== "all") params.set("titleFilter", titleFilter);
    if (topicFilter !== "all") params.set("topicFilter", topicFilter);
    if (sortBy !== "name") params.set("sortBy", sortBy);
    if (pageNum > 1) params.set("page", String(pageNum));
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  useEffect(() => {
    setSearchInput(filterParams.search ?? "");
  }, [filterParams.search]);

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  const runCategorize = async () => {
    setCategorizing(true);
    setCategorizeMessage(null);
    try {
      const res = await fetch("/api/admin/categorize-guest-contacts", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCategorizeMessage(data.message ?? `Categorized ${data.titlesCategorized ?? 0} titles, ${data.topicsCategorized ?? 0} topics. ${data.contactsUpdated ?? 0} contacts updated.`);
        window.location.reload();
      } else {
        setCategorizeMessage(data.error ?? "Categorization failed");
      }
    } catch {
      setCategorizeMessage("Request failed");
    } finally {
      setCategorizing(false);
    }
  };

  const runFindDuplicates = async () => {
    setDuplicatesLoading(true);
    setDuplicatesModal(null);
    try {
      const res = await fetch("/api/guest-contacts/duplicates");
      const data = await res.json();
      if (res.ok && Array.isArray(data.groups)) {
        setDuplicatesModal(data.groups);
      } else {
        setDuplicatesModal([]);
      }
    } catch {
      setDuplicatesModal([]);
    } finally {
      setDuplicatesLoading(false);
    }
  };

  const runGuestLogImport = async () => {
    const file = guestLogFile;
    if (!file) {
      setGuestLogMessage("Select an Excel file first.");
      return;
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setGuestLogMessage("Use Excel (.xlsx or .xls)");
      return;
    }
    setGuestLogImporting(true);
    setGuestLogMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300_000);
      const res = await fetch("/api/admin/import-guest-log", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        credentials: "same-origin",
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok) {
        setGuestLogMessage(data.message ?? "Import complete.");
        setGuestLogFile(null);
        if (guestLogInputRef.current) guestLogInputRef.current.value = "";
        window.location.reload();
      } else {
        setGuestLogMessage(data.error ?? "Import failed");
      }
    } catch (e) {
      setGuestLogMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setGuestLogImporting(false);
    }
  };

  const runGuestListImport = async () => {
    const file = guestListFile;
    if (!file) {
      setGuestListMessage("Select Guest_List_FINAL Excel file first.");
      return;
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setGuestListMessage("Use Excel (.xlsx or .xls)");
      return;
    }
    setGuestListImporting(true);
    setGuestListMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300_000);
      const res = await fetch("/api/admin/import-guest-list-excel", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        credentials: "same-origin",
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (res.ok) {
        setGuestListMessage(data.message ?? "Import complete.");
        setGuestListFile(null);
        if (guestListInputRef.current) guestListInputRef.current.value = "";
        window.location.reload();
      } else {
        setGuestListMessage(data.error ?? "Import failed");
      }
    } catch (e) {
      setGuestListMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setGuestListImporting(false);
    }
  };

  const runDeleteAndBackup = async () => {
    if (!confirm("Delete the entire guest list? A backup will be created so you can restore.")) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/guest-contacts/delete-and-backup", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteBackupModal(false);
        toast.success(data.message ?? "List cleared.");
        window.location.reload();
      } else {
        toast.error(data.error ?? "Delete failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setDeleting(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch("/api/admin/guest-contacts/backups", { credentials: "same-origin" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.backups)) {
        setBackups(data.backups);
      } else {
        setBackups([]);
      }
    } catch {
      setBackups([]);
    }
  };

  const runRestore = async (backupId: string) => {
    setRestoring(true);
    try {
      const res = await fetch("/api/admin/guest-contacts/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup_id: backupId }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        setRestoreModal(false);
        toast.success(data.message ?? "Restored.");
        window.location.reload();
      } else {
        toast.error(data.error ?? "Restore failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setRestoring(false);
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
    const unique = Array.from(new Set(contacts.map((c) => c.guest_name)));
    if (selectedGuests.size >= unique.length && unique.every((n) => selectedGuests.has(n))) {
      setSelectedGuests((prev) => {
        const next = new Set(prev);
        for (const n of unique) next.delete(n);
        return next;
      });
    } else {
      setSelectedGuests((prev) => {
        const next = new Set(prev);
        for (const n of unique) next.add(n);
        return next;
      });
    }
  };

  const toggleSelectAllFiltered = () => {
    const filteredNames = Array.from(new Set(filteredContacts.map((c) => c.guest_name)));
    const allSelected = filteredNames.length > 0 && filteredNames.every((n) => selectedGuests.has(n));
    if (allSelected) {
      setSelectedGuests((prev) => {
        const next = new Set(prev);
        for (const n of filteredNames) next.delete(n);
        return next;
      });
    } else {
      setSelectedGuests((prev) => {
        const next = new Set(prev);
        for (const n of filteredNames) next.add(n);
        return next;
      });
    }
  };

  const runBulkAiSearch = async () => {
    const namesToSearch = selectedGuests.size > 0
      ? Array.from(selectedGuests)
      : Array.from(new Set(filteredContacts.map((c) => c.guest_name)));
    if (namesToSearch.length === 0) {
      toast.error("No guests to search.");
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
        toast.success(data.message + (data.errors?.length ? ` Some errors: ${data.errors.slice(0, 3).join("; ")}` : ""));
        window.location.reload();
      } else {
        toast.error(data.error ?? "Bulk search failed");
      }
    } catch {
      toast.error("Request failed");
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
        toast.error(data.error ?? "Search failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSearchingGuest(null);
    }
  };

  const openGuestAssessment = async (guestName: string, _cachedAssessment?: string | null) => {
    setSelectedGuest(guestName);
    setAssessment(null);
    setAssessmentCached(false);
    setAppearances([]);
    setRiskAnalysis(null);
    setRiskAnalysisSources([]);
    setRiskAnalysisError(null);
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
      let data: { assessment?: string; appearances?: Appearance[]; error?: string; cached?: boolean };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setAssessment(res.ok ? "Invalid response." : `Request failed (${res.status}).`);
        return;
      }
      if (res.ok) {
        setAssessment(data.assessment ?? "No assessment available.");
        setAppearances(data.appearances ?? []);
        setAssessmentCached(!!data.cached);
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
    setAssessmentCached(false);
    setAppearances([]);
    setRiskAnalysis(null);
    setRiskAnalysisSources([]);
    setRiskAnalysisError(null);
  };

  const runRiskAnalysis = async () => {
    if (!selectedGuest) return;
    const contact = filteredContacts.find((c) => c.guest_name === selectedGuest);
    const title = contact?.title ?? "";
    setRiskAnalysisLoading(true);
    setRiskAnalysisError(null);
    setRiskAnalysis(null);
    setRiskAnalysisSources([]);
    try {
      const res = await fetch("/api/guest-contacts/risk-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_name: selectedGuest, title }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        setRiskAnalysis(data.summary ?? "No summary returned.");
        setRiskAnalysisSources(data.sources ?? []);
      } else {
        setRiskAnalysisError(data.error ?? "Risk analysis failed.");
      }
    } catch (e) {
      setRiskAnalysisError(toUserFriendlyError(e));
    } finally {
      setRiskAnalysisLoading(false);
    }
  };

  const runChatResearch = async () => {
    const q = chatInput.trim();
    if (!q) return;
    const guest = chatScope === "selected" ? chatSelectedGuest : null;
    let guestList: string[] = [];
    if (chatScope === "all") {
      try {
        const namesRes = await fetch("/api/guest-contacts/names-for-research", { credentials: "same-origin" });
        if (namesRes.ok) {
          const { names } = await namesRes.json();
          guestList = Array.isArray(names) ? names : [];
        }
      } catch {
        guestList = filteredContacts.map((c) => c.guest_name);
      }
    }
    setChatLoading(true);
    try {
      const res = await fetch("/api/guest-contacts/chat-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, guest_name: guest, guest_list: guestList }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        setChatHistory((prev) => [
          ...prev,
          { query: q, summary: data.summary ?? "", sources: data.sources ?? [], guestName: guest },
        ]);
        setChatInput("");
      } else {
        toast.error(data.error ?? "Research failed");
      }
    } catch (e) {
      toast.error(toUserFriendlyError(e));
    } finally {
      setChatLoading(false);
    }
  };

  const runFullEvaluation = async (guestName: string) => {
    const contact = filteredContacts.find((c) => c.guest_name === guestName);
    const title = contact?.title ?? "";
    setFullEvalGuest(guestName);
    setFullEvalLoading(true);
    setFullEvalData(null);
    setFullEvalError(null);
    try {
      const res = await fetch("/api/guest-contacts/full-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_name: guestName, title }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        setFullEvalData({
          appearances: data.appearances ?? [],
          risk_analysis: data.risk_analysis ?? "",
          sources: data.sources ?? [],
        });
      } else {
        setFullEvalError(data.error ?? "Evaluation failed.");
      }
    } catch (e) {
      setFullEvalError(toUserFriendlyError(e));
    } finally {
      setFullEvalLoading(false);
    }
  };

  const closeFullEval = () => {
    setFullEvalGuest(null);
    setFullEvalData(null);
    setFullEvalError(null);
  };

  const exportRiskAnalysisPdf = async () => {
    if (!selectedGuest || !riskAnalysis) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const { ensurePdfFont } = await import("@/lib/pdf-font");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      await ensurePdfFont(doc);
      doc.setFontSize(16);
      doc.text(`Risk Analysis Report — ${selectedGuest}`, 14, 20);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 28);
      const lines = doc.splitTextToSize(riskAnalysis, 180);
      doc.setFontSize(10);
      doc.text(lines, 14, 38);
      let y = 38 + lines.length * 5 + 8;
      if (riskAnalysisSources.length > 0) {
        doc.setFontSize(10);
        doc.text("Sources:", 14, y);
        y += 6;
        doc.setFontSize(9);
        riskAnalysisSources.slice(0, 10).forEach((url) => {
          const urlLines = doc.splitTextToSize(url, 180);
          doc.text(urlLines, 14, y);
          y += urlLines.length * 5 + 2;
        });
      }
      doc.save(`risk-analysis-${selectedGuest.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error(toUserFriendlyError(e));
    }
  };

  const exportChatReportPdf = async () => {
    if (chatHistory.length === 0) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const { ensurePdfFont } = await import("@/lib/pdf-font");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      await ensurePdfFont(doc);
      doc.setFontSize(16);
      doc.text("Guest Research Chat Report", 14, 20);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString("en-GB")} | ${chatHistory.length} search(es)`, 14, 28);
      let y = 38;
      for (let i = 0; i < chatHistory.length; i++) {
        const h = chatHistory[i];
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.text(`${i + 1}. ${h.guestName ? `Guest: ${h.guestName}` : "All guests"} — ${h.query}`, 14, y);
        y += 7;
        const lines = doc.splitTextToSize(h.summary, 180);
        doc.setFontSize(9);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 4;
        if (h.sources.length > 0) {
          doc.setFontSize(8);
          h.sources.slice(0, 3).forEach((url) => {
            doc.text(url.length > 60 ? url.slice(0, 57) + "..." : url, 14, y);
            y += 4;
          });
          y += 4;
        }
        y += 4;
      }
      doc.save(`guest-research-report-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Report downloaded");
    } catch (e) {
      toast.error(toUserFriendlyError(e));
    }
  };

  const filterBy = filterParams.filterBy ?? "all";
  const inviteFilter = filterParams.inviteFilter ?? "all";
  const dateFilter = filterParams.dateFilter ?? "all";
  const deptFilter = filterParams.deptFilter ?? "all";
  const progFilter = filterParams.progFilter ?? "all";
  const favoriteFilter = filterParams.favoriteFilter ?? null;
  const titleFilter = filterParams.titleFilter ?? "all";
  const topicFilter = filterParams.topicFilter ?? "all";
  const sortBy = filterParams.sortBy ?? "name";
  const search = filterParams.search ?? "";

  const similarNames = similarNamesProp;

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
        else toast.error((await res.json()).error ?? "Failed");
      } catch {
        toast.error("Request failed");
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
        else toast.error((await res.json()).error ?? "Failed");
      } catch {
        toast.error("Request failed");
      }
    }
  };

  const saveContact = async (payload: { guest_name: string; phone?: string | null; phone_country?: string; email?: string | null; title?: string | null; organization?: string | null; bio?: string | null; tags?: string[]; affiliated_orgs?: string[]; prohibited_topics?: string[]; conflict_of_interest_notes?: string | null }) => {
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
          toast.error(data.error ?? "Update failed");
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
          toast.error(data.error ?? "Update failed");
        }
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSaving(false);
    }
  };

  const createContact = async (payload: { guest_name: string; phone?: string | null; phone_country?: string; email?: string | null; title?: string | null }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/guest-contacts/upsert", {
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
        toast.error(data.error ?? "Create failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    const { getFormatters } = await import("@/lib/export-locale");
    const { formatDate } = getFormatters(exportLocale);
    const colOrder = COLUMN_IDS.filter((id) => id !== "actions" && visibleColumns.has(id));
    const headerMap: Record<string, (c: Contact) => string> = {
      guest_name: (c) => c.guest_name,
      last_appearance: (c) => formatDate(c.last_appearance_date || c.created_at || null),
      last_invited: (c) => formatDate(c.last_invited_at || null),
      usage: (c) => String(c.appearance_count ?? 0),
      department: (c) => c.department_name ?? "",
      programme: (c) => c.program_name ?? "",
      title: (c) => c.title ?? "",
      organization: (c) => c.organization ?? "",
      topic: (c) => c.topic_category ?? c.topic ?? "",
      phone: (c) => c.phone ?? c.ai_contact_info?.phone ?? "",
      email: (c) => c.email ?? c.ai_contact_info?.email ?? "",
      invoice: (c) => c.invoice_id ? `${window.location.origin}/invoices/${c.invoice_id}` : "",
      ai_found: (c) => {
        if (!c.ai_contact_info) return "";
        const parts: string[] = [];
        if (c.ai_contact_info.phone) parts.push(`Phone: ${c.ai_contact_info.phone}`);
        if (c.ai_contact_info.email) parts.push(`Email: ${c.ai_contact_info.email}`);
        if (c.ai_contact_info.social_media?.length) parts.push(`Social: ${c.ai_contact_info.social_media.join(", ")}`);
        return parts.join("; ");
      },
      ai_assessment: (c) => c.ai_assessment ?? "",
    };
    const headers = colOrder.map((id) => COLUMN_LABELS[id] ?? id);
    const rows = filteredContacts.map((c) => colOrder.map((id) => headerMap[id]?.(c) ?? ""));
    const XLSX = await import("xlsx");
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Guest Contacts");
    const hasFilters = filterBy !== "all" || inviteFilter !== "all" || dateFilter !== "all" || deptFilter !== "all" || progFilter !== "all" || titleFilter !== "all" || topicFilter !== "all" || favoriteFilter != null || !!(search?.trim());
    const baseName = `guest-contacts-${new Date().toISOString().slice(0, 10)}`;
    XLSX.writeFile(wb, hasFilters ? `${baseName}-filtered.xlsx` : `${baseName}.xlsx`, { bookSST: true });
  };

  const runMerge = async (primary: string, mergeFrom: string[]) => {
    setMerging(true);
    try {
      const res = await fetch("/api/guest-contacts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary, merge_from: mergeFrom }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        setMergeModal(null);
        window.location.reload();
      } else {
        toast.error(data.error ?? "Merge failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setMerging(false);
    }
  };

  const deleteContact = async (id: string) => {
    if (!confirm("Remove this contact from the list?")) return;
    try {
      const res = await fetch(`/api/guest-contacts/${id}`, { method: "DELETE", credentials: "same-origin" });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        toast.error(data.error ?? "Delete failed");
      }
    } catch {
      toast.error("Request failed");
    }
  };

  const btn = "rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  const btnPrimary = `${btn} bg-sky-600 text-white hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-600`;
  const btnSecondary = `${btn} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700`;
  const btnGhost = `${btn} text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800`;

  return (
    <div>
      {bulkUploading && <UploadOverlay message="Processing..." />}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Guest Contacts</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Names, phone and email from invoices.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400">
          ← Dashboard
        </Link>
      </div>

      {/* Search + primary row */}
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              const v = e.target.value;
              setSearchInput(v);
              if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = setTimeout(() => updateUrl({ search: v, page: 1 }), 400);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); updateUrl({ search: searchInput, page: 1 }); } }}
            placeholder="Search by name, title, phone or email..."
            className="min-w-[280px] flex-1 max-w-md rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
            aria-label="Search contacts"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`${btnSecondary} flex items-center gap-2 ${(filterBy !== "all" || inviteFilter !== "all" || dateFilter !== "all" || deptFilter !== "all" || progFilter !== "all" || titleFilter !== "all" || topicFilter !== "all") ? "ring-1 ring-sky-500/50" : ""}`}
          >
            Filters
            {(filterBy !== "all" || inviteFilter !== "all" || dateFilter !== "all" || deptFilter !== "all" || progFilter !== "all" || titleFilter !== "all" || topicFilter !== "all") && (
              <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">on</span>
            )}
            <span className={`text-xs ${filtersOpen ? "rotate-180" : ""} transition-transform`}>▾</span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`${btnGhost} ${viewMode === "table" ? "bg-gray-100 dark:bg-gray-700" : ""}`}
              aria-label="Table view"
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={`${btnGhost} ${viewMode === "card" ? "bg-gray-100 dark:bg-gray-700" : ""}`}
              aria-label="Card view"
            >
              Card
            </button>
          </div>
          <button
            type="button"
            onClick={() => updateUrl({ favoriteFilter: favoriteFilter === true ? null : true, page: 1 })}
            className={`${btnGhost} ${favoriteFilter ? "text-amber-600 dark:text-amber-400" : ""}`}
          >
            ★ Favorites
          </button>
          {canUseRiskResearch && (
            <button type="button" onClick={() => setChatOpen(true)} className={btnSecondary}>
              Research chat
            </button>
          )}
          <button type="button" onClick={() => setAddModal(true)} className={btnPrimary}>
            Add contact
          </button>
          {canExport && (
            <button
              type="button"
              onClick={exportExcel}
              disabled={filteredContacts.length === 0}
              className={`${btnSecondary} disabled:opacity-50`}
            >
              Export
            </button>
          )}
          <button type="button" onClick={() => setColumnsModal(true)} className={btnGhost}>
            Columns
          </button>
          <ExportLocaleSelector />
        </div>

        {/* Collapsible filters */}
        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <select value={filterBy} onChange={(e) => updateUrl({ filterBy: e.target.value, page: 1 })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="all">All contacts</option>
              <option value="has_phone">Has phone</option>
              <option value="has_email">Has email</option>
              <option value="has_ai">Has AI data</option>
              <option value="missing_phone">Missing phone</option>
              <option value="missing_email">Missing email</option>
            </select>
            <select value={inviteFilter} onChange={(e) => updateUrl({ inviteFilter: e.target.value, page: 1 })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="all">Invite status</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="no_response">No response</option>
              <option value="no_match">No match</option>
            </select>
            <select value={dateFilter} onChange={(e) => updateUrl({ dateFilter: e.target.value, page: 1 })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="all">All dates</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="year">This year</option>
            </select>
            <select value={sortBy} onChange={(e) => updateUrl({ sortBy: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="name">Sort by name</option>
              <option value="date">Sort by date</option>
              <option value="usage">Sort by usage</option>
            </select>
            {departments.length > 0 && (
              <select value={deptFilter} onChange={(e) => updateUrl({ deptFilter: e.target.value, page: 1 })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                <option value="all">All departments</option>
                {departments.sort().map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {programs.length > 0 && (
              <select value={progFilter} onChange={(e) => updateUrl({ progFilter: e.target.value, page: 1 })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                <option value="all">All programmes</option>
                {programs.sort().map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {(titles.length > 0 || hasEmptyTitle) && (
              <select value={titleFilter} onChange={(e) => updateUrl({ titleFilter: e.target.value, page: 1 })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                <option value="all">All titles</option>
                {hasEmptyTitle && <option value="__empty__">(No title)</option>}
                {titles.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {(topics.length > 0 || hasEmptyTopic) && (
              <select value={topicFilter} onChange={(e) => updateUrl({ topicFilter: e.target.value, page: 1 })} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                <option value="all">All topics</option>
                {hasEmptyTopic && <option value="__empty__">(No topic)</option>}
                {topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Admin actions - dropdown */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setActionsMenuOpen(!actionsMenuOpen); setImportMenuOpen(false); }}
                className={`${btnSecondary} flex items-center gap-1.5`}
              >
                AI & bulk
                <span className={`text-xs ${actionsMenuOpen ? "rotate-180" : ""} transition-transform`}>▾</span>
              </button>
              {actionsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActionsMenuOpen(false)} aria-hidden="true" />
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <button type="button" onClick={() => { runExtraction(); setActionsMenuOpen(false); }} disabled={extracting} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      {extracting ? "Scanning..." : "Scan invoices for contact info"}
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg" className="hidden" aria-label="Select invoice files" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                      Select files (max 10)
                    </button>
                    <button type="button" onClick={() => { runBulkUpload(); setActionsMenuOpen(false); }} disabled={bulkUploading} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      {bulkUploading ? "Processing..." : "Upload and extract contacts"}
                    </button>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <button type="button" onClick={() => { runBulkAiSearch(); setActionsMenuOpen(false); }} disabled={bulkSearching || filteredContacts.length === 0} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      {bulkSearching ? "Searching..." : `Bulk AI search (${selectedGuests.size || "all"})`}
                    </button>
                    <button type="button" onClick={() => { setBulkEmailModal(true); setActionsMenuOpen(false); }} disabled={selectedGuests.size === 0} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      Bulk email ({selectedGuests.size})
                    </button>
                    <button type="button" onClick={() => { runCategorize(); setActionsMenuOpen(false); }} disabled={categorizing} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      {categorizing ? "Categorizing..." : "AI categorize all"}
                    </button>
                    <button type="button" onClick={() => { runFindDuplicates(); setActionsMenuOpen(false); }} disabled={duplicatesLoading} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      {duplicatesLoading ? "Searching..." : "Find duplicates"}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setImportMenuOpen(!importMenuOpen); setActionsMenuOpen(false); }}
                className={`${btnSecondary} flex items-center gap-1.5`}
              >
                Import
                <span className={`text-xs ${importMenuOpen ? "rotate-180" : ""} transition-transform`}>▾</span>
              </button>
              {importMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setImportMenuOpen(false)} aria-hidden="true" />
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <button type="button" onClick={() => guestLogInputRef.current?.click()} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                      {guestLogFile ? guestLogFile.name : "Select Guest Log"}
                    </button>
                    <button type="button" onClick={() => { runGuestLogImport(); setImportMenuOpen(false); }} disabled={guestLogImporting || !guestLogFile} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      {guestLogImporting ? "Importing..." : "Import Guest Log"}
                    </button>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <button type="button" onClick={() => guestListInputRef.current?.click()} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                      {guestListFile ? guestListFile.name : "Select Guest List"}
                    </button>
                    <button type="button" onClick={() => { runGuestListImport(); setImportMenuOpen(false); }} disabled={guestListImporting || !guestListFile} title="Overwrites guest list" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700">
                      {guestListImporting ? "Importing..." : "Import & Overwrite"}
                    </button>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <button type="button" onClick={() => { setDeleteBackupModal(true); setImportMenuOpen(false); }} disabled={totalCount === 0} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20">
                      Delete list
                    </button>
                    <button type="button" onClick={() => { setRestoreModal(true); fetchBackups(); setImportMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                      Restore
                    </button>
                  </div>
                </>
              )}
            </div>
            <input ref={guestLogInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setGuestLogFile(e.target.files?.[0] ?? null)} aria-label="Select Guest Log" />
            <input ref={guestListInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setGuestListFile(e.target.files?.[0] ?? null)} aria-label="Select Guest List" />
          </div>
        )}

        {(extractMessage || bulkMessage || categorizeMessage || guestLogMessage || guestListMessage) && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {extractMessage || bulkMessage || categorizeMessage || guestLogMessage || guestListMessage}
          </p>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount} contacts
          {(filterBy !== "all" || inviteFilter !== "all" || dateFilter !== "all" || deptFilter !== "all" || progFilter !== "all" || titleFilter !== "all" || topicFilter !== "all" || favoriteFilter != null) && " (filtered)"}
          </p>
          {isAdmin && totalCount > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              {filteredContacts.every((c) => selectedGuests.has(c.guest_name)) ? "Clear selection" : "Select all filtered"}
            </button>
          )}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateUrl({ page: Math.max(1, page - 1) })}
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
              onClick={() => updateUrl({ page: Math.min(totalPages, page + 1) })}
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
          {similarNames.slice(0, 3).map((arr, i) => (
            <span key={arr.join(",")}>
              {i > 0 && " • "}
              <span className="inline-flex items-center gap-1">
                {arr.join(" / ")}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setMergeModal(arr)}
                    className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200 dark:hover:bg-amber-800/50"
                  >
                    Merge
                  </button>
                )}
              </span>
            </span>
          ))}
          {similarNames.length > 3 && ` (+${similarNames.length - 3} more)`}
        </div>
      )}

      {mergeModal && (
        <MergeModal
          names={mergeModal}
          onClose={() => setMergeModal(null)}
          onMerge={runMerge}
          merging={merging}
        />
      )}

      {duplicatesModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Potential duplicates</h3>
              <button
                type="button"
                onClick={() => setDuplicatesModal(null)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
            {duplicatesModal.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No potential duplicates found.</p>
            ) : (
              <ul className="space-y-3">
                {duplicatesModal.map((g, i) => (
                  <li key={i} className="rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                    <span className="font-medium text-gray-900 dark:text-white">{g.primary}</span>
                    <span className="text-gray-500 dark:text-gray-400"> ← </span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{g.duplicates.map((d) => d.guest_name).join(", ")}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setMergeModal([g.primary, ...g.duplicates.map((d) => d.guest_name)]);
                          setDuplicatesModal(null);
                        }}
                        className="ml-2 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                      >
                        Merge
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                    checked={contacts.length > 0 && selectedGuests.size >= Array.from(new Set(contacts.map((c) => c.guest_name))).length}
                    onChange={toggleSelectAll}
                    aria-label="Select all guests"
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                </th>
              )}
              {visibleColumns.has("guest_name") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Guest Name</th>
              )}
              {visibleColumns.has("last_appearance") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Last appearance</th>
              )}
              {visibleColumns.has("last_invited") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Last invited</th>
              )}
              {visibleColumns.has("usage") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Usage</th>
              )}
              {visibleColumns.has("department") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Dept</th>
              )}
              {visibleColumns.has("programme") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Programme</th>
              )}
              {visibleColumns.has("title") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Title</th>
              )}
              {visibleColumns.has("organization") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Organization</th>
              )}
              {visibleColumns.has("title_category") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Title category</th>
              )}
              {visibleColumns.has("topic") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Topic</th>
              )}
              {visibleColumns.has("phone") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Phone</th>
              )}
              {visibleColumns.has("email") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Email</th>
              )}
              {visibleColumns.has("invoice") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Invoice</th>
              )}
              {visibleColumns.has("ai_found") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">AI Found</th>
              )}
              {visibleColumns.has("ai_assessment") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">AI Assessment</th>
              )}
              {isAdmin && visibleColumns.has("actions") && (
                <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={(isAdmin ? 1 : 0) + COLUMN_IDS.filter((id) => (id === "actions" ? isAdmin : true) && visibleColumns.has(id)).length} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {contacts.length === 0
                    ? "No guest data found yet. Data appears from invoices (guest name, title, phone, email when available)."
                    : "No matches for your search."}
                </td>
              </tr>
            ) : (
              contacts.map((c) => {
                const rowBg =
                  c.invite_status === "accepted"
                    ? "bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30"
                    : c.invite_status === "rejected"
                      ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30"
                      : c.invite_status === "no_response"
                        ? "bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/30"
                        : c.invite_status === "no_match"
                          ? "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50";
                return (
                <tr key={c.guest_contact_id ?? `guest-${c.guest_name}`} className={rowBg}>
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
                  {visibleColumns.has("guest_name") && (
                    <td className="max-w-[180px] px-3 py-2 align-top text-sm font-medium text-gray-900 dark:text-white">
                      <span className="flex items-center gap-2">
                        {canUseRiskResearch && (
                          <button
                            type="button"
                            onClick={() => runFullEvaluation(c.guest_name)}
                            className="shrink-0 rounded p-1 text-sky-500 hover:bg-sky-100 hover:text-sky-600 dark:hover:bg-sky-900/30 dark:hover:text-sky-400"
                            title="Full evaluation (TRT programs + risk analysis)"
                            aria-label="Full evaluation"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(c)}
                          className="shrink-0 text-amber-500 hover:text-amber-600"
                          title={c.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          {c.is_favorite ? "★" : "☆"}
                        </button>
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                            {(c.guest_name || "?")[0].toUpperCase()}
                          </span>
                        )}
                        <span className="block truncate" title={c.guest_name}>{c.guest_name}</span>
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("last_appearance") && (
                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400">
                      {(c.last_appearance_date || c.created_at) ? new Date(c.last_appearance_date || c.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                  )}
                  {visibleColumns.has("last_invited") && (
                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400">
                      {c.last_invited_at ? new Date(c.last_invited_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                  )}
                  {visibleColumns.has("usage") && (
                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400">
                      {(c.appearance_count ?? 0) > 0 ? (
                        <span title={`${c.appearance_count} appearance(s)`}>{c.appearance_count}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500" title="Never used">—</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.has("department") && (
                    <td className="max-w-[100px] px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400 truncate" title={c.department_name ?? undefined}>
                      {c.department_name || "—"}
                    </td>
                  )}
                  {visibleColumns.has("programme") && (
                    <td className="max-w-[100px] px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400 truncate" title={c.program_name ?? undefined}>
                      {c.program_name || "—"}
                    </td>
                  )}
                  {visibleColumns.has("title") && (
                    <td className="max-w-[200px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate" title={c.title || undefined}>{c.title || "—"}</span>
                    </td>
                  )}
                  {visibleColumns.has("organization") && (
                    <td className="max-w-[140px] px-3 py-2 align-top text-sm text-gray-500 dark:text-gray-400">
                      <span className="block truncate" title={c.organization || undefined}>{c.organization || "—"}</span>
                    </td>
                  )}
                  {visibleColumns.has("title_category") && (
                    <td className="max-w-[120px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate" title={c.title_category || undefined}>{c.title_category || "—"}</span>
                    </td>
                  )}
                  {visibleColumns.has("topic") && (
                    <td className="max-w-[160px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                      <span className="block truncate" title={c.topic || c.topic_category || undefined}>{c.topic_category || c.topic || "—"}</span>
                    </td>
                  )}
                  {visibleColumns.has("phone") && (
                    <td className="max-w-[120px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} title={c.phone} className="block truncate text-sky-600 hover:underline dark:text-sky-400">
                          {c.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {visibleColumns.has("email") && (
                    <td className="max-w-[160px] px-3 py-2 align-top text-sm text-gray-600 dark:text-gray-300">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} title={c.email} className="block truncate text-sky-600 hover:underline dark:text-sky-400">
                          {c.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {visibleColumns.has("invoice") && (
                    <td className="px-3 py-2 align-top text-sm">
                      {c.invoice_id ? (
                        <a
                          href={`/api/invoices/${c.invoice_id}/pdf?redirect=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:underline dark:text-sky-400"
                        >
                          View invoice
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">Bulk upload</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.has("ai_found") && (
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
                        {typeof c.ai_contact_info.confidence === "number" && (
                          <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400" title="AI confidence">
                            {c.ai_contact_info.confidence}%
                          </span>
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
                  )}
                  {visibleColumns.has("ai_assessment") && (
                    <td className="px-3 py-2 align-top text-sm">
                      <button
                        type="button"
                        onClick={() => openGuestAssessment(c.guest_name)}
                        className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
                      >
                        View AI Assessment
                      </button>
                    </td>
                  )}
                  {isAdmin && visibleColumns.has("actions") && (
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
              );
              })
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => {
            const cardBg =
              c.invite_status === "accepted"
                ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                : c.invite_status === "rejected"
                  ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                  : c.invite_status === "no_response"
                    ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                    : c.invite_status === "no_match"
                      ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";
            return (
            <div
              key={c.guest_contact_id ?? `guest-${c.guest_name}`}
              className={`rounded-xl border p-4 shadow ${cardBg}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {canUseRiskResearch && (
                      <button
                        type="button"
                        onClick={() => runFullEvaluation(c.guest_name)}
                        className="shrink-0 rounded p-1 text-sky-500 hover:bg-sky-100 hover:text-sky-600 dark:hover:bg-sky-900/30 dark:hover:text-sky-400"
                        title="Full evaluation (TRT programs + risk analysis)"
                        aria-label="Full evaluation"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </button>
                    )}
                    <button type="button" onClick={() => toggleFavorite(c)} className="shrink-0 text-amber-500 hover:text-amber-600">
                      {c.is_favorite ? "★" : "☆"}
                    </button>
                    {c.photo_url ? (
                      <img src={c.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                        {(c.guest_name || "?")[0].toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900 dark:text-white">{c.guest_name}</span>
                      {c.title && <p className="truncate text-sm text-gray-500 dark:text-gray-400">{c.title}</p>}
                      {c.organization && <p className="truncate text-xs text-gray-400 dark:text-gray-500">{c.organization}</p>}
                    </div>
                  </div>
                  {(c.topic || c.topic_category) && <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{c.topic_category || c.topic}</p>}
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
                {((c.appearance_count ?? 0) > 0 || c.last_appearance_date || c.created_at || c.last_invited_at) && (
                  <p className="text-xs text-gray-500">
                    {(c.appearance_count ?? 0) > 0 && <span>{c.appearance_count} appearance(s)</span>}
                    {(c.appearance_count ?? 0) > 0 && (c.last_appearance_date || c.created_at) && " • "}
                    {(c.last_appearance_date || c.created_at) && (
                      <span>Last: {new Date(c.last_appearance_date || c.created_at).toLocaleDateString()}</span>
                    )}
                    {c.last_invited_at && (
                      <span> • Invited: {new Date(c.last_invited_at).toLocaleDateString()}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.invoice_id && (
                  <a href={`/api/invoices/${c.invoice_id}/pdf?redirect=1`} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 dark:text-sky-400">View invoice</a>
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
            );
          })}
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
                {assessmentCached && (
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(cached)</span>
                )}
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
                          <a
                            href={`/api/invoices/${a.invoice_id}/pdf?redirect=1`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-sky-600 hover:underline dark:text-sky-400"
                          >
                            View invoice
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
            {canUseRiskResearch && (
            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
              <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Risk Analysis (internet search)
              </h3>
              {riskAnalysisLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Searching web for risk assessment...</p>
              ) : riskAnalysisError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{riskAnalysisError}</p>
              ) : riskAnalysis ? (
                <>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex-1 overflow-hidden rounded-xl border-l-4 border-amber-500 bg-gradient-to-br from-amber-50 to-white p-4 dark:border-amber-600 dark:from-amber-950/40 dark:to-gray-900">
                      <div className="text-gray-800 dark:text-gray-200">
                        <FormattedResearchText text={riskAnalysis} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={exportRiskAnalysisPdf}
                      className="shrink-0 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                    >
                      Export PDF
                    </button>
                  </div>
                  {riskAnalysisSources.length > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-200/60 bg-white/60 px-3 py-2 dark:border-amber-800/60 dark:bg-gray-800/40">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Sources</p>
                      <ul className="space-y-1">
                        {riskAnalysisSources.map((url, i) => (
                          <li key={i}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-sky-600 hover:underline dark:text-sky-400"
                            >
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={runRiskAnalysis}
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
                >
                  Run Risk Analysis
                </button>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {chatOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-title"
          onClick={() => setChatOpen(false)}
        >
          <div
            className="flex h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h2 id="chat-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Research chat
              </h2>
              <div className="flex items-center gap-2">
                {chatHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={exportChatReportPdf}
                    className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                  >
                    Export report
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Search across all guests (fetched fresh each time) or focus on a selected guest. Ask about risk factors, biography, recent appearances, etc.
                </p>
              ) : (
                chatHistory.map((h, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border-l-4 border-amber-500 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:border-amber-600 dark:from-amber-950/40 dark:to-gray-900"
                  >
                    <div className="mb-3 rounded-lg bg-amber-100/80 px-3 py-2 dark:bg-amber-900/40">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {h.guestName ? `Guest: ${h.guestName}` : "All guests"}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">{h.query}</p>
                    </div>
                    <div className="text-gray-800 dark:text-gray-200">
                      <FormattedResearchText text={h.summary} />
                    </div>
                    {h.sources.length > 0 && (
                      <div className="mt-3 rounded-lg border border-amber-200/60 bg-white/60 px-3 py-2 dark:border-amber-800/60 dark:bg-gray-800/40">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Sources</p>
                        <ul className="space-y-1">
                          {h.sources.slice(0, 5).map((url, j) => (
                            <li key={j}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-sky-600 hover:underline dark:text-sky-400"
                              >
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-gray-200 p-4 dark:border-gray-700">
              <div className="mb-3 flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="chatScope"
                    checked={chatScope === "all"}
                    onChange={() => setChatScope("all")}
                    className="h-4 w-4 border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  All guests (fetches latest from DB)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="chatScope"
                    checked={chatScope === "selected"}
                    onChange={() => setChatScope("selected")}
                    className="h-4 w-4 border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  Focus on specific guest
                </label>
                {chatScope === "selected" && (
                  <select
                    value={chatSelectedGuest ?? ""}
                    onChange={(e) => setChatSelectedGuest(e.target.value || null)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select guest...</option>
                    {filteredContacts.map((c) => (
                      <option key={c.guest_name} value={c.guest_name}>{c.guest_name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && runChatResearch()}
                  placeholder="e.g. Who is X? Any risk factors?"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={runChatResearch}
                  disabled={chatLoading || !chatInput.trim() || (chatScope === "selected" && !chatSelectedGuest)}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {chatLoading ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {fullEvalGuest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="full-eval-title"
          onClick={closeFullEval}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h2 id="full-eval-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Full evaluation — {fullEvalGuest}
              </h2>
              <button
                type="button"
                onClick={closeFullEval}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              {fullEvalLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading TRT programs and risk analysis...</p>
              ) : fullEvalError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{fullEvalError}</p>
              ) : fullEvalData ? (
                <>
                  {fullEvalData.appearances.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">TRT programs</h3>
                      <ul className="space-y-2">
                        {fullEvalData.appearances.map((a, i) => (
                          <li
                            key={i}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                          >
                            <span className="font-medium text-gray-900 dark:text-white">{a.date}</span>
                            <span className="text-gray-600 dark:text-gray-300">{a.topic}</span>
                            <span className="text-gray-500 dark:text-gray-400">({a.programme})</span>
                            <span className="text-gray-500 dark:text-gray-400">{a.amount}</span>
                            <a
                              href={`/api/invoices/${a.invoice_id}/pdf?redirect=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-sky-600 hover:underline dark:text-sky-400"
                            >
                              View invoice
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {fullEvalData.appearances.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No TRT program data in invoices.</p>
                  )}
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Risk analysis</h3>
                    <div className="overflow-hidden rounded-xl border-l-4 border-amber-500 bg-gradient-to-br from-amber-50 to-white p-4 dark:border-amber-600 dark:from-amber-950/40 dark:to-gray-900">
                      <FormattedResearchText text={fullEvalData.risk_analysis} />
                    </div>
                    {fullEvalData.sources.length > 0 && (
                      <div className="mt-2 rounded-lg border border-amber-200/60 bg-white/60 px-3 py-2 dark:border-amber-800/60 dark:bg-gray-800/40">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Sources</p>
                        <ul className="space-y-1">
                          {fullEvalData.sources.slice(0, 5).map((url, i) => (
                            <li key={i}>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:underline dark:text-sky-400">
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {editContact && (
        <ContactFormModal
          modalTitle="Edit contact"
          initial={{
            guest_name: editContact.guest_name,
            phone: editContact.phone,
            phone_country: inferPhoneCountry(editContact.phone),
            email: editContact.email,
            title: editContact.title,
            organization: editContact.organization ?? "",
            bio: editContact.bio ?? "",
            tags: editContact.tags,
            affiliated_orgs: editContact.affiliated_orgs ?? [],
            prohibited_topics: editContact.prohibited_topics ?? [],
            conflict_of_interest_notes: editContact.conflict_of_interest_notes ?? "",
          }}
          onSave={(payload) => saveContact(payload)}
          onClose={() => setEditContact(null)}
          saving={saving}
          showConflictOfInterest
        />
      )}

      {addModal && (
        <ContactFormModal
          modalTitle="Add contact"
          initial={{ guest_name: "", phone: "", phone_country: DEFAULT_PHONE_COUNTRY, email: "", title: "" }}
          onSave={(payload) => createContact(payload)}
          onClose={() => setAddModal(false)}
          saving={saving}
        />
      )}

      {bulkEmailModal && (
        <BulkEmailModal
          contacts={filteredContacts.filter((c) => selectedGuests.has(c.guest_name))}
          programs={programs}
          topics={topics}
          onClose={() => setBulkEmailModal(false)}
          onSent={() => { setBulkEmailModal(false); window.location.reload(); }}
        />
      )}

      {columnsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setColumnsModal(false)}>
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Columns</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Toggle columns to show or hide. Export uses visible columns only.</p>
            <div className="space-y-2">
              {COLUMN_IDS.filter((id) => id !== "actions" || isAdmin).map((id) => (
                <label key={id} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(id)}
                    onChange={() => toggleColumn(id)}
                    className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{COLUMN_LABELS[id] ?? id}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setColumnsModal(false)}
              className="mt-4 w-full rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {deleteBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteBackupModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Delete guest list</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              This will remove all {totalCount} contacts from the list. A backup will be created so you can restore later. Invoice data is not affected.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={runDeleteAndBackup}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete & backup"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteBackupModal(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {restoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRestoreModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Restore from backup</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Select a backup to restore. This will replace the current list with the backed-up contacts.
            </p>
            {backups.length === 0 ? (
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">No backups found.</p>
            ) : (
              <ul className="mb-4 max-h-48 space-y-2 overflow-y-auto">
                {backups.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {b.contact_count} contacts · {new Date(b.backed_up_at).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => runRestore(b.id)}
                      disabled={restoring}
                      className="rounded bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setRestoreModal(false)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MergeModal({
  names,
  onClose,
  onMerge,
  merging,
}: {
  names: string[];
  onClose: () => void;
  onMerge: (primary: string, mergeFrom: string[]) => void;
  merging: boolean;
}) {
  const [primary, setPrimary] = useState(names[0] ?? "");
  const mergeFrom = names.filter((n) => n !== primary);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Merge duplicates</h2>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          Choose which name to keep. Other contacts will be merged into it.
        </p>
        <div className="mb-4 space-y-2">
          {names.map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="primary"
                checked={primary === n}
                onChange={() => setPrimary(n)}
                className="h-4 w-4 text-sky-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{n}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onMerge(primary, mergeFrom)}
            disabled={merging || mergeFrom.length === 0}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {merging ? "Merging..." : "Merge"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type Producer = { id: string; full_name: string; email: string | null };
type Program = { id: string; name: string };

function BulkEmailModal({ contacts, programs: programNames, topics: topicNames, onClose, onSent }: { contacts: Contact[]; programs: string[]; topics: string[]; onClose: () => void; onSent: () => void }) {
  const [mode, setMode] = useState<"invite" | "custom">("invite");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [producers, setProducers] = useState<Producer[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [producerId, setProducerId] = useState("");
  const [programName, setProgramName] = useState("");
  const [generalTopic, setGeneralTopic] = useState("");
  const [programSpecificTopic, setProgramSpecificTopic] = useState("");
  const [greetingType, setGreetingType] = useState<GreetingType>("dear");
  const [recordDate, setRecordDate] = useState("");
  const [recordTime, setRecordTime] = useState("");
  const [format, setFormat] = useState<"remote" | "studio">("remote");
  const [studioAddress, setStudioAddress] = useState("TRT World London Studios 200 Gray's Inn Rd, London WC1X 8XZ");
  const [includeProgramDescription, setIncludeProgramDescription] = useState(true);
  const [attachCalendar, setAttachCalendar] = useState(true);
  const [bccProducer, setBccProducer] = useState(true);
  const [customGreetings, setCustomGreetings] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const withEmail = contacts.filter((c) => c.email || c.ai_contact_info?.email);

  const GENERAL_TOPIC_OPTIONS = ["News", "Foreign Policy", "Domestic Politics", "Security", "Economics", "Climate", "Culture", "Sports", "Technology", "Other"];
  const INVITE_TEMPLATES_KEY = "guest-invite-templates";
  const [savedTemplates, setSavedTemplates] = useState<Array<{ name: string; programName: string; generalTopic?: string; programSpecificTopic?: string; topic?: string; format: string; studioAddress: string }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const s = localStorage.getItem(INVITE_TEMPLATES_KEY);
      const parsed = s ? JSON.parse(s) : [];
      return parsed.map((t: { topic?: string; programSpecificTopic?: string; generalTopic?: string } & Record<string, unknown>) => ({
        ...t,
        programSpecificTopic: t.programSpecificTopic ?? t.topic ?? "",
        generalTopic: t.generalTopic ?? "",
      }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (mode !== "invite") return;
    const load = async () => {
      try {
        const [prodRes, progRes] = await Promise.all([
          fetch("/api/guest-contacts/producers", { credentials: "same-origin" }),
          fetch("/api/programs", { credentials: "same-origin" }),
        ]);
        if (prodRes.ok) {
          const data = await prodRes.json();
          setProducers(data ?? []);
          setProducerId((prev) => (prev ? prev : data?.[0]?.id ?? ""));
        }
        if (progRes.ok) {
          const data = await progRes.json();
          setPrograms(data ?? []);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [mode]);

  const selectedProducer = producers.find((p) => p.id === producerId);

  const recentlyInvited = withEmail.filter((c) => {
    const invited = c.last_invited_at;
    if (!invited) return false;
    const days = (Date.now() - new Date(invited).getTime()) / (24 * 60 * 60 * 1000);
    return days < 7;
  });

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (withEmail.length === 0) {
      toast.error("No selected contacts have email addresses");
      return;
    }
    const payload = {
      contacts: withEmail.map((c) => ({ guest_name: c.guest_name, email: c.email || c.ai_contact_info?.email })),
    };
    if (mode === "invite") {
      if (!selectedProducer?.email) {
        toast.error("Please select a producer (reply-to address required)");
        return;
      }
      if (!recordDate.trim() || !recordTime.trim()) {
        toast.error("Recording date and time are required");
        return;
      }
      Object.assign(payload, {
        use_template: true,
        producer_name: selectedProducer.full_name,
        producer_email: selectedProducer.email,
        producer_user_id: selectedProducer.id,
        program_name: programName.trim() || "our program",
        topic: programSpecificTopic.trim() || "the scheduled topic",
        record_date: recordDate.trim(),
        record_time: recordTime.trim(),
        format,
        studio_address: format === "studio" ? studioAddress.trim() : "",
        include_program_description: includeProgramDescription,
        attach_calendar: attachCalendar,
        bcc_producer: bccProducer,
        greeting_type: greetingType,
        custom_greetings: Object.keys(customGreetings).length ? customGreetings : undefined,
      });
    } else {
      if (!subject.trim() || !message.trim()) {
        toast.error("Subject and message are required");
        return;
      }
      Object.assign(payload, { subject: subject.trim(), message: message.trim() });
    }
    if (mode === "invite" && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);
    setSending(true);
    try {
      const res = await fetch("/api/guest-contacts/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "Email sent.");
        onSent();
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800 my-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bulk email</h2>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {withEmail.length} of {contacts.length} selected have email. {mode === "invite" ? "Invitation template will personalize each email." : "Email will be sent to each recipient."}
        </p>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("invite")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "invite" ? "bg-sky-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"}`}
          >
            Invite template
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === "custom" ? "bg-sky-600 text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"}`}
          >
            Custom message
          </button>
        </div>
        <form onSubmit={handleSend} className="space-y-4">
          {mode === "invite" ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Producer (reply-to) *</label>
                <select value={producerId} onChange={(e) => setProducerId(e.target.value)} required className={inputCls}>
                  <option value="">Select producer</option>
                  {producers.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name} {p.email ? `(${p.email})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Program name</label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="e.g. Newshour, Roundtable"
                  list="program-list"
                  className={inputCls}
                />
                <datalist id="program-list">
                  {Array.from(new Set([...programs.map((p) => p.name), ...programNames, ...Object.keys(PROGRAM_DESCRIPTIONS)])).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                {programName.trim() && getProgramDescription(programName) && (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 italic">
                    {getProgramDescription(programName)}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Greeting</label>
                <select value={greetingType} onChange={(e) => setGreetingType(e.target.value as GreetingType)} className={inputCls}>
                  <option value="dear">Dear [full name]</option>
                  <option value="mr_ms">Dear Mr./Ms. [surname]</option>
                  <option value="mr">Dear Mr [surname]</option>
                  <option value="ms">Dear Ms [surname]</option>
                  <option value="mrs">Dear Mrs [surname]</option>
                  <option value="miss">Dear Miss [surname]</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">General topic</label>
                <select value={generalTopic} onChange={(e) => setGeneralTopic(e.target.value)} className={inputCls}>
                  <option value="">— Select —</option>
                  {GENERAL_TOPIC_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">For internal use only (not shown in email)</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Program-specific topic *</label>
                <input
                  type="text"
                  value={programSpecificTopic}
                  onChange={(e) => setProgramSpecificTopic(e.target.value)}
                  placeholder="e.g. US-Turkey relations, Climate summit outcomes"
                  className={inputCls}
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Shown in the invitation email</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Recording date *</label>
                  <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Recording time *</label>
                  <input type="time" value={recordTime} onChange={(e) => setRecordTime(e.target.value)} required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Format</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="format" checked={format === "remote"} onChange={() => setFormat("remote")} className="h-4 w-4 text-sky-600" />
                    <span className="text-sm">Remote (Skype/Zoom)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="format" checked={format === "studio"} onChange={() => setFormat("studio")} className="h-4 w-4 text-sky-600" />
                    <span className="text-sm">In-studio</span>
                  </label>
                </div>
              </div>
              {format === "studio" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Studio address</label>
                  <textarea value={studioAddress} onChange={(e) => setStudioAddress(e.target.value)} placeholder="e.g. 1 Great Cumberland Place, London W1H 7AL" rows={2} className={inputCls} />
                </div>
              )}
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={includeProgramDescription} onChange={(e) => setIncludeProgramDescription(e.target.checked)} className="h-4 w-4 rounded text-sky-600" />
                  <span className="text-sm">Include program description in email</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={attachCalendar} onChange={(e) => setAttachCalendar(e.target.checked)} className="h-4 w-4 rounded text-sky-600" />
                  <span className="text-sm">Attach calendar (.ics) with recording date/time</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={bccProducer} onChange={(e) => setBccProducer(e.target.checked)} className="h-4 w-4 rounded text-sky-600" />
                  <span className="text-sm">BCC producer (copy of each email)</span>
                </label>
              </div>
              {savedTemplates.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Load template</label>
                  <select
                    className={inputCls}
                    onChange={(e) => {
                      const t = savedTemplates[Number(e.target.value)];
                      if (t) {
                        setProgramName(t.programName);
                        setGeneralTopic(t.generalTopic ?? "");
                        setProgramSpecificTopic(t.programSpecificTopic ?? (t as { topic?: string }).topic ?? "");
                        setGreetingType((t as { greetingType?: GreetingType }).greetingType ?? "dear");
                        setFormat(t.format as "remote" | "studio");
                        setStudioAddress(t.studioAddress);
                      }
                    }}
                  >
                    <option value="">— Select saved template —</option>
                    {savedTemplates.map((t, i) => (
                      <option key={i} value={i}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const name = prompt("Template name (e.g. Roundtable Studio)?");
                    if (name?.trim()) {
                      const next = [...savedTemplates, { name: name.trim(), programName, generalTopic, programSpecificTopic, format, studioAddress, greetingType }];
                      setSavedTemplates(next);
                      try {
                        localStorage.setItem(INVITE_TEMPLATES_KEY, JSON.stringify(next));
                      } catch {}
                      toast.success("Template saved");
                    }
                  }}
                  className="rounded-lg border px-3 py-1.5 text-sm"
                >
                  Save as template
                </button>
              </div>
              {recentlyInvited.length > 0 && (
                <p className="text-amber-600 text-sm dark:text-amber-400">
                  Note: {recentlyInvited.length} guest(s) were invited in the last 7 days.
                </p>
              )}
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">Custom greetings (optional)</summary>
                <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                  {withEmail.map((c) => (
                    <div key={c.guest_name} className="flex items-center gap-2">
                      <span className="shrink-0 w-24 truncate text-xs text-gray-500">{c.guest_name}</span>
                      <input
                        type="text"
                        value={customGreetings[c.guest_name] ?? ""}
                        onChange={(e) => setCustomGreetings((prev) => ({ ...prev, [c.guest_name]: e.target.value }))}
                        placeholder="e.g. Dear Professor Smith"
                        className="flex-1 rounded border px-2 py-1 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </details>
              {showPreview && withEmail[0] && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-900">
                  <p className="mb-2 font-medium">Preview (sample for {withEmail[0].guest_name}):</p>
                  <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {`Subject: TRT World – Invitation to the program: ${programName.trim() || "our program"}

${customGreetings[withEmail[0].guest_name] || buildInviteGreeting(withEmail[0].guest_name, greetingType)},

I hope this message finds you well.

I am writing to invite you to participate in ${programName.trim() || "our program"}, which will be broadcast on TRT World and will focus on ${programSpecificTopic.trim() || "the scheduled topic"}.${includeProgramDescription && programName.trim() && getProgramDescription(programName) ? `

${getProgramDescription(programName)}` : ""}

The recording is scheduled for ${recordDate.trim() || "TBD"} at ${recordTime.trim() || "TBD"}.

${format === "remote" ? "The recording will be conducted remotely via Skype or Zoom." : `The recording will take place in our studio. The address is: ${studioAddress || "—"}`}${format === "studio" ? `

We can arrange to pick you up from your preferred location and drop you back after the recording.` : ""}

Would you be interested in joining us for this program? Please reply to this email to confirm your participation.

Best regards,
${selectedProducer?.full_name || "Producer"}`}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPreview((p) => !p)} className="rounded-lg border px-3 py-1.5 text-sm">
                  {showPreview ? "Hide preview" : "Preview"}
                </button>
              </div>
              {showConfirm && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">
                    Send invitation to {withEmail.length} guest(s)?
                  </p>
                  <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
                    Each will receive a personalized email. Guests will be saved to the contact list with program topic.
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowConfirm(false)} className="rounded-lg border px-4 py-2 text-sm">Back</button>
                    <button type="button" onClick={() => handleSend()} className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white">Confirm & Send</button>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Each guest will receive a personalized email with polite greeting, program details, format (remote/studio), pick-up/drop-off offer, and a request to confirm participation. Replies go to the producer.
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">Subject *</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Message *</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} className={inputCls} />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
            {!showConfirm && (
              <button
                type="submit"
                disabled={
                  sending ||
                  withEmail.length === 0 ||
                  (mode === "invite" &&
                    (!producerId || !programSpecificTopic.trim() || !recordDate.trim() || !recordTime.trim()))
                }
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            )}
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
  showConflictOfInterest,
}: {
  modalTitle: string;
  initial: { guest_name: string; phone: string | null; phone_country?: string; email: string | null; title: string | null; organization?: string; bio?: string; tags?: string[]; affiliated_orgs?: string[]; prohibited_topics?: string[]; conflict_of_interest_notes?: string };
  onSave: (p: { guest_name: string; phone?: string | null; phone_country?: string; email?: string | null; title?: string | null; organization?: string | null; bio?: string | null; tags?: string[]; affiliated_orgs?: string[]; prohibited_topics?: string[]; conflict_of_interest_notes?: string | null }) => void;
  onClose: () => void;
  saving: boolean;
  showConflictOfInterest?: boolean;
}) {
  const [guestName, setGuestName] = useState(initial.guest_name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [phoneCountry, setPhoneCountry] = useState(initial.phone_country ?? DEFAULT_PHONE_COUNTRY);
  const [email, setEmail] = useState(initial.email ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [organization, setOrganization] = useState(initial.organization ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [tagsStr, setTagsStr] = useState((initial.tags ?? []).join(", "));
  const [affiliatedOrgsStr, setAffiliatedOrgsStr] = useState((initial.affiliated_orgs ?? []).join(", "));
  const [prohibitedTopicsStr, setProhibitedTopicsStr] = useState((initial.prohibited_topics ?? []).join(", "));
  const [coiNotes, setCoiNotes] = useState(initial.conflict_of_interest_notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name || name.length < 2) {
      toast.error("Guest name is required (min 2 chars)");
      return;
    }
    const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    const affiliatedOrgs = affiliatedOrgsStr.split(",").map((t) => t.trim()).filter(Boolean);
    const prohibitedTopics = prohibitedTopicsStr.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({
      guest_name: name,
      phone: phone.trim() || null,
      phone_country: phoneCountry,
      email: email.trim() || null,
      title: title.trim() || null,
      organization: organization.trim() || null,
      bio: bio.trim() || null,
      tags: tags.length > 0 ? tags : undefined,
      ...(showConflictOfInterest && {
        affiliated_orgs: affiliatedOrgs.length > 0 ? affiliatedOrgs : undefined,
        prohibited_topics: prohibitedTopics.length > 0 ? prohibitedTopics : undefined,
        conflict_of_interest_notes: coiNotes.trim() || null,
      }),
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
              placeholder="e.g. Political Analyst"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="organization" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Organization
            </label>
            <input
              id="organization"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. Reuters, BBC"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              placeholder="Short professional bio"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          {showConflictOfInterest && (
            <>
              <div>
                <label htmlFor="affiliated_orgs" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Affiliated organizations (comma-separated)
                </label>
                <input
                  id="affiliated_orgs"
                  type="text"
                  value={affiliatedOrgsStr}
                  onChange={(e) => setAffiliatedOrgsStr(e.target.value)}
                  placeholder="e.g. BBC, Reuters"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="prohibited_topics" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Prohibited topics (comma-separated)
                </label>
                <input
                  id="prohibited_topics"
                  type="text"
                  value={prohibitedTopicsStr}
                  onChange={(e) => setProhibitedTopicsStr(e.target.value)}
                  placeholder="e.g. Company X, Stock Y"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="coi_notes" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Conflict of interest notes
                </label>
                <textarea
                  id="coi_notes"
                  value={coiNotes}
                  onChange={(e) => setCoiNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Phone
            </label>
            <div className="flex gap-2">
              <select
                id="phone_country"
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value)}
                className="w-36 shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                aria-label="Country code"
              >
                {PHONE_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.dial} {c.name}
                  </option>
                ))}
              </select>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 7740 123456"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
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
