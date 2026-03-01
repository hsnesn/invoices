"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getProgramDescription, PROGRAM_DESCRIPTIONS } from "@/lib/program-descriptions";
import { buildInviteGreeting, type GreetingType } from "@/lib/invite-greeting";
import { SendInvoiceLinkModal } from "@/components/SendInvoiceLinkModal";
import { BankDetailsFields, BANK_DETAILS_DEFAULT, validateBankDetails, type BankDetailsValues } from "@/components/BankDetailsFields";

type ProducerGuest = {
  id: string;
  producer_user_id: string;
  producer_name: string;
  guest_name: string;
  email: string | null;
  title: string | null;
  program_name: string | null;
  invited_at: string | null;
  accepted: boolean | null;
  matched_invoice_id: string | null;
  matched_at: string | null;
  payment_received?: boolean | null;
  payment_amount?: number | null;
  payment_currency?: string | null;
  recording_date?: string | null;
  recording_topic?: string | null;
  notes?: string | null;
  is_favorite?: boolean | null;
  created_at: string;
  source?: "producer_guests" | "guest_invitations";
};

export function InvitedGuestsClient({
  programs,
  producers,
  titles: initialTitles,
  defaultProgramName,
  currentUserId,
  currentUserFullName,
  isAdmin,
}: {
  programs: { id: string; name: string }[];
  producers: { id: string; full_name: string }[];
  titles: string[];
  defaultProgramName: string;
  currentUserId: string;
  currentUserFullName: string;
  isAdmin: boolean;
}) {
  const [guests, setGuests] = useState<ProducerGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [titles, setTitles] = useState<string[]>(initialTitles);
  const [inviteModal, setInviteModal] = useState<ProducerGuest | "new" | null>(null);
  const [bulkInviteModal, setBulkInviteModal] = useState(false);
  const [acceptanceModal, setAcceptanceModal] = useState<ProducerGuest | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkAcceptModal, setBulkAcceptModal] = useState(false);
  const [sending, setSending] = useState(false);

  const [acceptanceForm, setAcceptanceForm] = useState({
    payment_received: true,
    payment_amount: 0,
    payment_currency: "GBP" as "GBP" | "EUR" | "USD",
    recording_date: new Date().toISOString().slice(0, 10),
    recording_topic: "",
    program_name: "",
    generate_invoice: false,
    save_as_template: false,
    invoice_number: "",
    invoice_date: new Date().toISOString().slice(0, 10),
    account_name: "",
    account_number: "",
    sort_code: "",
    bank_name: "",
    bank_address: "",
    paypal: "",
    bank_type: "uk" as "uk" | "international",
    iban: "",
    swift_bic: "",
  });
  const [acceptanceBankDetails, setAcceptanceBankDetails] = useState<BankDetailsValues>(BANK_DETAILS_DEFAULT);

  const [form, setForm] = useState({
    guest_name: "",
    email: "",
    title: "",
    program_name: defaultProgramName,
    general_topic: "",
    program_specific_topic: "",
    record_date: "",
    record_time: "",
    format: "remote" as "remote" | "studio",
    studio_address: "TRT World London Studios 200 Gray's Inn Rd, London WC1X 8XZ",
    include_program_description: true,
    attach_calendar: true,
    bcc_producer: true,
    greeting_type: "dear" as "dear" | "mr_ms" | "mr" | "ms" | "mrs" | "miss",
  });

  const [showPreview, setShowPreview] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [invoiceTemplates, setInvoiceTemplates] = useState<{ id: string; name: string; guest_name: string | null; account_name: string | null; account_number: string | null; sort_code: string | null; bank_name: string | null; bank_address: string | null; paypal: string | null; bank_type?: string | null; iban?: string | null; swift_bic?: string | null }[]>([]);
  const [bulkAcceptForm, setBulkAcceptForm] = useState({
    payment_received: true,
    payment_amount: 0,
    payment_currency: "GBP" as "GBP" | "EUR" | "USD",
    recording_date: new Date().toISOString().slice(0, 10),
    recording_topic: "",
    program_name: "",
  });
  const [invoiceNumberConflict, setInvoiceNumberConflict] = useState(false);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());
  const [guestSuggestions, setGuestSuggestions] = useState<{ guest_name: string; email: string | null; title: string | null; program_name: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notesModal, setNotesModal] = useState<ProducerGuest | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [bulkImportModal, setBulkImportModal] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [quickAddModal, setQuickAddModal] = useState(false);
  const [quickAddPaste, setQuickAddPaste] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [sendInvoiceLinkModal, setSendInvoiceLinkModal] = useState<{ guest_name: string; email: string | null; program_name?: string; title?: string; payment_currency?: string | null } | null>(null);
  const GENERAL_TOPIC_OPTIONS = ["News", "Foreign Policy", "Domestic Politics", "Security", "Economics", "Climate", "Culture", "Sports", "Technology", "Other"];

  const router = useRouter();
  const searchParams = useSearchParams();

  const loadGuests = React.useCallback(() => {
    setLoading(true);
    fetch("/api/producer-guests", { credentials: "same-origin" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          const err = (data as { error?: string }).error || `HTTP ${r.status}`;
          toast.error(`Failed to load guests: ${err}`);
          return [];
        }
        if (Array.isArray(data)) return data;
        if ((data as { error?: string }).error) {
          toast.error(`Failed to load guests: ${(data as { error?: string }).error}`);
          return [];
        }
        return [];
      })
      .then(setGuests)
      .catch((err) => {
        toast.error("Failed to load invited guests");
        setGuests([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  const resendHandled = React.useRef(false);
  useEffect(() => {
    const resendId = searchParams.get("resend");
    if (!resendId || resendHandled.current) return;
    resendHandled.current = true;
    fetch(`/api/producer-guests/${resendId}/resend-post-recording-email`, { method: "POST", credentials: "same-origin" })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          toast.success((data as { message?: string }).message ?? "New link sent to guest");
        } else {
          toast.error((data as { error?: string }).error ?? "Failed to resend");
        }
      })
      .catch(() => toast.error("Failed to resend"))
      .finally(() => {
        router.replace("/invoices/invited-guests", { scroll: false });
      });
  }, [searchParams, router]);

  useEffect(() => {
    if (acceptanceModal && acceptanceForm.generate_invoice) {
      fetch("/api/guest-invoice-templates", { credentials: "same-origin" })
        .then((r) => r.json())
        .then((data) => setInvoiceTemplates(Array.isArray(data) ? data : []))
        .catch(() => setInvoiceTemplates([]));
    } else {
      setInvoiceTemplates([]);
    }
  }, [acceptanceModal, acceptanceForm.generate_invoice]);

  useEffect(() => {
    fetch("/api/guest-titles", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        setTitles(Array.isArray(data) ? data.map((t: { name: string }) => t.name) : initialTitles);
      })
      .catch(() => {});
  }, [initialTitles]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInviteModal(null);
        setAcceptanceModal(null);
        setNotesModal(null);
        setBulkImportModal(false);
        setQuickAddModal(false);
        setBulkInviteModal(false);
        setBulkAcceptModal(false);
        setExpandedGroupKeys(new Set());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!acceptanceForm.invoice_number.trim()) {
      setInvoiceNumberConflict(false);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/invoices/next-invoice-number?check=${encodeURIComponent(acceptanceForm.invoice_number)}`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => setInvoiceNumberConflict(d.exists === true))
        .catch(() => setInvoiceNumberConflict(false));
    }, 400);
    return () => clearTimeout(t);
  }, [acceptanceForm.invoice_number]);

  // One-click re-invite: fetch last invitation when opening invite modal for existing guest
  useEffect(() => {
    if (!inviteModal || inviteModal === "new" || inviteModal.source === "guest_invitations") return;
    const guestId = inviteModal.id;
    fetch(`/api/producer-guests/${guestId}/last-invitation`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (data.record_date || data.program_name || data.program_specific_topic || data.record_time) {
          setForm((p) => ({
            ...p,
            record_date: data.record_date || p.record_date,
            record_time: data.record_time || p.record_time,
            program_name: data.program_name || p.program_name,
            program_specific_topic: data.program_specific_topic || p.program_specific_topic,
            format: data.format === "studio" ? "studio" : data.format === "remote" ? "remote" : p.format,
            studio_address: data.studio_address || p.studio_address,
          }));
        }
      })
      .catch(() => {});
  }, [inviteModal]);

  // Duplicate detection when adding guest
  useEffect(() => {
    if (!inviteModal || inviteModal === "new") return;
    const name = form.guest_name.trim();
    if (name.length < 2) {
      setDuplicateWarning(false);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/producer-guests/check-duplicate?name=${encodeURIComponent(name)}&email=${encodeURIComponent(form.email.trim())}`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => setDuplicateWarning(d.exists === true))
        .catch(() => setDuplicateWarning(false));
    }, 400);
    return () => clearTimeout(t);
  }, [inviteModal, form.guest_name, form.email]);

  // Smart autocomplete: debounced search for guest suggestions
  useEffect(() => {
    const q = form.guest_name.trim();
    if (q.length < 2) {
      setGuestSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/producer-guests/search-guests?q=${encodeURIComponent(q)}&limit=8`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((data) => {
          setGuestSuggestions(Array.isArray(data) ? data : []);
          setShowSuggestions(true);
        })
        .catch(() => setGuestSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [form.guest_name]);

  const selectedProducer = producers.find((p) => p.id === currentUserId) ?? { id: currentUserId, full_name: currentUserFullName };

  const filteredGuests = guests.filter((g) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "favorites") return g.is_favorite === true;
    if (statusFilter === "accepted") return g.accepted === true;
    if (statusFilter === "rejected") return g.accepted === false;
    if (statusFilter === "no_response") return g.accepted === null && g.invited_at;
    if (statusFilter === "no_match") return g.invited_at && !g.matched_at;
    return true;
  });

  const searchLower = searchQuery.trim().toLowerCase();
  const displayedGuests = searchLower
    ? filteredGuests.filter(
        (g) =>
          g.guest_name.toLowerCase().includes(searchLower) ||
          (g.email ?? "").toLowerCase().includes(searchLower) ||
          (g.program_name ?? "").toLowerCase().includes(searchLower) ||
          (g.title ?? "").toLowerCase().includes(searchLower) ||
          (g.notes ?? "").toLowerCase().includes(searchLower)
      )
    : filteredGuests;

  function groupKey(g: ProducerGuest): string {
    return `${g.producer_user_id}|${(g.guest_name || "").toLowerCase().trim()}|${(g.email || "").toLowerCase().trim()}`;
  }

  type GroupedGuest = {
    key: string;
    appearances: ProducerGuest[];
    appearanceCount: number;
    lastAppearanceDate: string | null;
    paidAmounts: { amount: number; currency: string }[];
    anyPaid: boolean;
    anyUnpaid: boolean;
  };

  const groupedByKey = useMemo(() => {
    const map = new Map<string, ProducerGuest[]>();
    for (const g of displayedGuests) {
      const k = groupKey(g);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    for (const arr of Array.from(map.values())) {
      arr.sort((a, b) => {
        const da = a.recording_date || a.matched_at || a.invited_at || a.created_at || "";
        const db = b.recording_date || b.matched_at || b.invited_at || b.created_at || "";
        return new Date(db).getTime() - new Date(da).getTime();
      });
    }
    return map;
  }, [displayedGuests]);

  const groupedList = useMemo((): GroupedGuest[] => {
    return Array.from(groupedByKey.entries()).map(([key, appearances]) => {
      const dates = appearances
        .map((a) => a.recording_date || a.matched_at || a.invited_at)
        .filter(Boolean) as string[];
      const lastDate = dates.length ? dates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null;
      const paidAmounts = appearances
        .filter((a) => a.payment_received && a.payment_amount != null && a.payment_amount > 0)
        .map((a) => ({ amount: a.payment_amount!, currency: a.payment_currency || "GBP" }));
      const anyPaid = appearances.some((a) => a.payment_received);
      const anyUnpaid = appearances.some((a) => a.accepted === true && !a.payment_received);
      return { key, appearances, appearanceCount: appearances.length, lastAppearanceDate: lastDate, paidAmounts, anyPaid, anyUnpaid };
    });
  }, [groupedByKey]);

  const selectedGuests = filteredGuests.filter((g) => selectedIds.has(g.id));
  const selectedWithEmail = selectedGuests.filter((g) => g.email && g.email.includes("@"));
  const selectedDeletable = selectedGuests;

  const handleSendInvite = async () => {
    if (!form.guest_name.trim()) {
      toast.error("Guest name is required");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      toast.error("Valid email is required");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required before sending");
      return;
    }
    if (!form.record_date.trim() || !form.record_time.trim()) {
      toast.error("Recording date and time are required");
      return;
    }
    setSending(true);
    try {
      const profileRes = await fetch("/api/profile", { credentials: "same-origin" });
      const profileData = profileRes.ok ? await profileRes.json() : {};
      const producerEmailRes = profileData?.email ?? null;
      const res = await fetch("/api/producer-guests/invite-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producer_guest_id: inviteModal && inviteModal !== "new" && inviteModal.source === "producer_guests" ? inviteModal.id : undefined,
          guest_name: form.guest_name.trim(),
          email: form.email.trim(),
          title: form.title.trim(),
          program_name: form.program_name.trim() || "our program",
          topic: form.program_specific_topic.trim() || "the scheduled topic",
          record_date: form.record_date.trim(),
          record_time: form.record_time.trim(),
          format: form.format,
          studio_address: form.studio_address,
          producer_name: selectedProducer.full_name,
          producer_email: producerEmailRes,
          producer_user_id: currentUserId,
          include_program_description: form.include_program_description,
          attach_calendar: form.attach_calendar,
          bcc_producer: form.bcc_producer,
          greeting_type: form.greeting_type,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "Invitation sent");
        setInviteModal(null);
        setForm({ ...form, guest_name: "", email: "", title: "" });
        const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
        setGuests(Array.isArray(list) ? list : []);
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  };

  const handleBulkSendInvite = async () => {
    if (selectedWithEmail.length === 0) {
      toast.error("Select at least one guest with email");
      return;
    }
    if (!form.program_specific_topic.trim() || !form.record_date.trim() || !form.record_time.trim()) {
      toast.error("Program-specific topic, date and time are required");
      return;
    }
    setSending(true);
    try {
      const profileRes = await fetch("/api/profile", { credentials: "same-origin" });
      const profileData = profileRes.ok ? await profileRes.json() : {};
      const producerEmailRes = profileData?.email ?? null;
      const res = await fetch("/api/producer-guests/bulk-invite-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guests: selectedWithEmail.map((g) => ({
            producer_guest_id: g.source === "producer_guests" ? g.id : undefined,
            guest_name: g.guest_name,
            email: g.email!,
            title: g.title || "Guest",
          })),
          program_name: form.program_name.trim() || "our program",
          topic: form.program_specific_topic.trim() || "the scheduled topic",
          record_date: form.record_date.trim(),
          record_time: form.record_time.trim(),
          format: form.format,
          studio_address: form.studio_address,
          producer_name: selectedProducer.full_name,
          producer_email: producerEmailRes,
          producer_user_id: currentUserId,
          include_program_description: form.include_program_description,
          attach_calendar: form.attach_calendar,
          bcc_producer: form.bcc_producer,
          greeting_type: form.greeting_type,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "Invitations sent");
        setBulkInviteModal(false);
        setSelectedIds(new Set());
        const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
        setGuests(Array.isArray(list) ? list : []);
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  };

  const addTitle = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await fetch("/api/guest-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok && data?.name) {
        if (!titles.includes(trimmed)) setTitles([...titles, trimmed].sort());
        return trimmed;
      }
    } catch {}
    return null;
  };

  const handleBulkMarkAccepted = async () => {
    const idsToAccept = selectedGuests
      .filter((g) => g.accepted !== true && g.email?.includes("@") && g.source === "producer_guests")
      .map((g) => g.id);
    if (idsToAccept.length === 0) {
      toast.error("Select at least one invited guest (not yet accepted) with email");
      return;
    }
    if (bulkAcceptForm.payment_received && bulkAcceptForm.payment_amount <= 0) {
      toast.error("Payment amount is required when guests receive payment");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/producer-guests/bulk-mark-accepted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: idsToAccept,
          payment_received: bulkAcceptForm.payment_received,
          payment_amount: bulkAcceptForm.payment_received ? bulkAcceptForm.payment_amount : undefined,
          payment_currency: bulkAcceptForm.payment_received ? bulkAcceptForm.payment_currency : undefined,
          recording_date: bulkAcceptForm.recording_date,
          recording_topic: bulkAcceptForm.recording_topic,
          program_name: bulkAcceptForm.program_name || undefined,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? "Guests marked as accepted");
        setBulkAcceptModal(false);
        setSelectedIds(new Set());
        const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
        setGuests(Array.isArray(list) ? list : []);
      } else {
        toast.error(data.error ?? "Failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  };

  const exportToCsv = () => {
    const headers = ["Guest", "Title", "Program", "Email", "Invited", "Matched", "Accepted", "Payment", "Recording Date", "Appearances"];
    const guestToCount = new Map<string, number>();
    for (const g of displayedGuests) {
      const k = groupKey(g);
      guestToCount.set(k, (guestToCount.get(k) ?? 0) + 1);
    }
    const rows = displayedGuests.map((g) => [
      g.guest_name,
      g.title || "",
      g.program_name || "",
      g.email || "",
      g.invited_at ? new Date(g.invited_at).toLocaleDateString() : "",
      g.matched_at ? new Date(g.matched_at).toLocaleDateString() : "",
      g.accepted === true ? "Yes" : g.accepted === false ? "No" : "—",
      g.payment_received ? `${g.payment_amount ?? 0} ${g.payment_currency ?? ""}` : "Unpaid",
      g.recording_date ? new Date(g.recording_date).toLocaleDateString() : "",
      guestToCount.get(groupKey(g)) ?? 1,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invited-guests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateAccepted = async (id: string, accepted: boolean | null) => {
    try {
      const res = await fetch(`/api/producer-guests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
        credentials: "same-origin",
      });
      if (res.ok) {
        setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, accepted } : g)));
      }
    } catch {}
  };

  const fetchNextInvoiceNumber = async () => {
    try {
      const res = await fetch("/api/invoices/next-invoice-number", { credentials: "same-origin" });
      const data = await res.json();
      if (res.ok && data?.next_invoice_number) {
        setAcceptanceForm((p) => ({ ...p, invoice_number: data.next_invoice_number }));
        if (data.is_auto_suggested) {
          toast.info("Invoice number auto-suggested based on existing records");
        }
      }
    } catch {}
  };

  const handleMarkAccepted = async () => {
    if (!acceptanceModal) return;
    if (!acceptanceModal.email?.includes("@")) {
      toast.error("Guest email is required");
      return;
    }
    if (acceptanceForm.payment_received && acceptanceForm.payment_amount <= 0) {
      toast.error("Payment amount is required when guest receives payment");
      return;
    }
    if (acceptanceForm.generate_invoice) {
      if (!acceptanceForm.invoice_number.trim()) {
        toast.error("Invoice number is required to generate invoice");
        return;
      }
      const bankErr = validateBankDetails(acceptanceBankDetails);
      if (bankErr) {
        toast.error(bankErr);
        return;
      }
      if (invoiceNumberConflict) {
        toast.error("This invoice number already exists. Please use a different number.");
        return;
      }
    }
    setSending(true);
    try {
      let guestId = acceptanceModal.id;
      if (acceptanceModal.source === "guest_invitations") {
        const createRes = await fetch("/api/producer-guests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guest_name: acceptanceModal.guest_name,
            email: acceptanceModal.email,
            program_name: acceptanceForm.program_name || acceptanceModal.program_name,
          }),
          credentials: "same-origin",
        });
        const created = await createRes.json();
        if (!createRes.ok || !created?.id) {
          toast.error(created?.error ?? "Failed to create guest record");
          setSending(false);
          return;
        }
        guestId = created.id;
      }
      const res = await fetch(`/api/producer-guests/${guestId}/mark-accepted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_received: acceptanceForm.payment_received,
          payment_amount: acceptanceForm.payment_received ? acceptanceForm.payment_amount : undefined,
          payment_currency: acceptanceForm.payment_received ? acceptanceForm.payment_currency : undefined,
          recording_date: acceptanceForm.recording_date,
          recording_topic: acceptanceForm.recording_topic,
          program_name: acceptanceForm.program_name || acceptanceModal.program_name,
          generate_invoice_for_guest: acceptanceForm.generate_invoice,
          invoice_number: acceptanceForm.generate_invoice ? acceptanceForm.invoice_number : undefined,
          invoice_date: acceptanceForm.generate_invoice ? acceptanceForm.invoice_date : undefined,
          account_name: acceptanceForm.generate_invoice ? acceptanceBankDetails.accountName : undefined,
          bank_name: acceptanceForm.generate_invoice ? acceptanceBankDetails.bankName : undefined,
          bank_address: acceptanceForm.generate_invoice ? acceptanceBankDetails.bankAddress : undefined,
          paypal: acceptanceForm.generate_invoice ? acceptanceBankDetails.paypal : undefined,
          bank_type: acceptanceForm.generate_invoice ? acceptanceBankDetails.bankType : undefined,
          account_number: acceptanceForm.generate_invoice && acceptanceBankDetails.bankType === "uk" ? acceptanceBankDetails.accountNumber : undefined,
          sort_code: acceptanceForm.generate_invoice && acceptanceBankDetails.bankType === "uk" ? acceptanceBankDetails.sortCode : undefined,
          iban: acceptanceForm.generate_invoice && acceptanceBankDetails.bankType === "international" ? acceptanceBankDetails.iban : undefined,
          swift_bic: acceptanceForm.generate_invoice && acceptanceBankDetails.bankType === "international" ? acceptanceBankDetails.swiftBic : undefined,
        }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (res.ok) {
        if (acceptanceForm.save_as_template && acceptanceBankDetails.accountName && acceptanceModal) {
          const bankValid = !validateBankDetails(acceptanceBankDetails);
          if (bankValid) {
            try {
              await fetch("/api/guest-invoice-templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: `${acceptanceModal.guest_name} – ${acceptanceForm.program_name || "template"}`,
                  guest_name: acceptanceModal.guest_name,
                  account_name: acceptanceBankDetails.accountName,
                  account_number: acceptanceBankDetails.accountNumber,
                  sort_code: acceptanceBankDetails.sortCode,
                  bank_name: acceptanceBankDetails.bankName,
                  bank_address: acceptanceBankDetails.bankAddress,
                  paypal: acceptanceBankDetails.paypal,
                  bank_type: acceptanceBankDetails.bankType,
                  iban: acceptanceBankDetails.iban,
                  swift_bic: acceptanceBankDetails.swiftBic,
                }),
                credentials: "same-origin",
              });
              toast.success("Guest marked as accepted. Bank details saved as template.");
            } catch {
              toast.success(data.message ?? "Guest marked as accepted");
            }
          } else {
            toast.success(data.message ?? "Guest marked as accepted");
          }
        } else {
          toast.success(data.message ?? "Guest marked as accepted");
        }
        setAcceptanceModal(null);
        const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
        setGuests(Array.isArray(list) ? list : []);
        if (data.invoice_id) {
          router.push(`/invoices?expand=${data.invoice_id}`);
        }
      } else {
        const msg = data.message ?? data.error ?? "Failed";
        toast.error(msg);
        if (data.guest_marked_accepted) {
          setAcceptanceModal(null);
          const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
          setGuests(Array.isArray(list) ? list : []);
        }
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setSending(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white";

  const openInviteModal = () => {
    setInviteModal("new");
    setForm({
      guest_name: "",
      email: "",
      title: "",
      program_name: defaultProgramName,
      general_topic: "",
      program_specific_topic: "",
      record_date: "",
      record_time: "",
      format: "remote",
      studio_address: "TRT World London Studios 200 Gray's Inn Rd, London WC1X 8XZ",
      include_program_description: true,
      attach_calendar: true,
      bcc_producer: true,
      greeting_type: "dear",
    });
  };

  const openBulkAcceptModal = () => {
    setBulkAcceptModal(true);
    setBulkAcceptForm({
      payment_received: true,
      payment_amount: 0,
      payment_currency: "GBP",
      recording_date: new Date().toISOString().slice(0, 10),
      recording_topic: "",
      program_name: defaultProgramName,
    });
  };

  const btnBase = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  const btnSecondary = "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
  const btnSky = "border border-sky-500/50 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/60";
  const btnEmerald = "border border-emerald-500/50 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60";
  const btnPrimary = "bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 shadow-sm";

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/invoices" className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300">
            ← Guest Invoices
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">
            {isAdmin ? "All Invited Guests" : "My Invited Guests"}
          </h1>
        </div>
        <button
          onClick={openInviteModal}
          className={`${btnBase} ${btnPrimary} shrink-0 self-start sm:self-center`}
        >
          <span className="text-lg">+</span> Invite Guest
        </button>
      </div>

      {/* Search, filter & actions */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search guest, email, program..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 sm:max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:w-36"
          >
            <option value="all">All</option>
            <option value="favorites">Favorites</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="no_response">No response</option>
            <option value="no_match">No match</option>
          </select>
          <button
            onClick={() => loadGuests()}
            disabled={loading}
            className={`${btnBase} ${btnSecondary}`}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportToCsv} className={`${btnBase} ${btnSecondary}`}>
            Export CSV
          </button>
          <button
            onClick={() => { setBulkInviteModal(true); setForm({ ...form, guest_name: "", email: "", title: "" }); }}
            disabled={selectedWithEmail.length === 0}
            className={`${btnBase} ${btnSky} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Bulk invite ({selectedWithEmail.length})
          </button>
          <button
            onClick={openBulkAcceptModal}
            disabled={selectedGuests.filter((g) => g.accepted !== true && g.email?.includes("@") && g.source === "producer_guests").length === 0}
            className={`${btnBase} ${btnEmerald} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Bulk mark accepted
          </button>
          <button
            onClick={async () => {
              if (selectedDeletable.length === 0) return;
              if (!confirm(`Remove ${selectedDeletable.length} guest(s) from invited guests? They will remain in the contact list.`)) return;
              try {
                const res = await fetch("/api/producer-guests/bulk-delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ids: selectedDeletable.map((g) => g.id) }),
                  credentials: "same-origin",
                });
                const data = await res.json();
                if (res.ok) {
                  toast.success(`Removed ${(data as { deleted?: number }).deleted ?? selectedDeletable.length} guest(s) from invited guests`);
                  setSelectedIds(new Set());
                  loadGuests();
                } else {
                  toast.error((data as { error?: string }).error ?? "Failed to remove");
                }
              } catch {
                toast.error("Failed to remove");
              }
            }}
            disabled={selectedDeletable.length === 0}
            className={`${btnBase} border border-red-500/50 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Remove from invited guests (contact list unchanged)"
          >
            Bulk remove ({selectedDeletable.length})
          </button>
          <button
            onClick={() => { setQuickAddModal(true); setQuickAddPaste(""); }}
            className={`${btnBase} ${btnSecondary}`}
          >
            Quick add from email
          </button>
          <button onClick={() => setBulkImportModal(true)} className={`${btnBase} ${btnSecondary}`}>
            Bulk import CSV
          </button>
          <button
            onClick={() => {
              const one = selectedIds.size === 1 ? guests.find((g) => g.id === Array.from(selectedIds)[0]) : null;
              setSendInvoiceLinkModal(one ? { guest_name: one.guest_name, email: one.email, program_name: one.program_name ?? "", title: one.title ?? undefined, payment_currency: one.payment_currency ?? undefined } : { guest_name: "", email: null });
            }}
            className={`${btnBase} ${btnSecondary}`}
          >
            Send invoice link
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/50">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={groupedList.length > 0 && groupedList.flatMap((grp) => grp.appearances).filter((g) => g.email).every((g) => selectedIds.has(g.id))}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const allIds = groupedList.flatMap((grp) => grp.appearances).filter((g) => g.email).map((g) => g.id);
                      setSelectedIds(checked ? new Set(allIds) : new Set());
                    }}
                    className="h-4 w-4 rounded"
                  />
                </th>
                {isAdmin && <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Producer</th>}
                <th className="px-4 py-2 w-8 text-center text-xs font-semibold uppercase text-gray-600 dark:text-gray-300" title="Favorite">★</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Guest</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Title</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Program</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Appearances</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Invited</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Matched</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Accepted</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Payment</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Last appearance</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Notes</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 15 : 14} className="px-4 py-8 text-center text-gray-500">
                    No invited guests yet. Click &quot;Invite Guest&quot; to add one.
                  </td>
                </tr>
              ) : groupedList.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 15 : 14} className="px-4 py-8 text-center text-gray-500">
                    No guests match your search.
                  </td>
                </tr>
              ) : (
                groupedList.flatMap((grp) => {
                  const first = grp.appearances[0]!;
                  const isExpanded = expandedGroupKeys.has(grp.key);
                  const noMatch = first.invited_at && !first.matched_at;
                  const rowBg =
                    first.accepted === true
                      ? "bg-green-50 dark:bg-green-950/20"
                      : first.accepted === false
                        ? "bg-red-50 dark:bg-red-950/20"
                        : first.accepted === null && first.invited_at
                          ? "bg-orange-50 dark:bg-orange-950/20"
                          : noMatch
                            ? "bg-amber-50 dark:bg-amber-950/20"
                            : "";
                  const allIds = grp.appearances.map((a) => a.id);
                  const allSelected = allIds.every((id) => selectedIds.has(id));
                  const paymentTooltip = grp.paidAmounts.length
                    ? grp.paidAmounts.map((p) => `${p.amount} ${p.currency}`).join(", ")
                    : "";
                  const rows: React.ReactNode[] = [];
                  rows.push(
                    <tr
                      key={grp.key}
                      className={`${rowBg} cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/50`}
                      onClick={() => setExpandedGroupKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(grp.key)) next.delete(grp.key);
                        else next.add(grp.key);
                        return next;
                      })}
                    >
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        {first.email && (
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) allIds.forEach((id) => next.add(id));
                                else allIds.forEach((id) => next.delete(id));
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded"
                          />
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{first.producer_name}</td>
                      )}
                      <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            fetch(`/api/producer-guests/${first.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ is_favorite: !first.is_favorite }),
                              credentials: "same-origin",
                            })
                              .then((r) => r.json())
                              .then(() => fetch("/api/producer-guests", { credentials: "same-origin" }).then((res) => res.json()))
                              .then((list) => setGuests(Array.isArray(list) ? list : []))
                              .catch(() => toast.error("Failed to update"));
                          }}
                          className={`text-lg ${first.is_favorite ? "text-amber-500" : "text-gray-300 hover:text-amber-400 dark:text-gray-500"}`}
                          title={first.is_favorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          ★
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                        {first.guest_name}
                        {grp.appearanceCount > 1 && (
                          <span className="ml-1 text-gray-500">({grp.appearanceCount})</span>
                        )}
                        {grp.appearanceCount >= 5 && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" title="Regular contributor">Regular</span>
                        )}
                        {grp.appearanceCount >= 3 && grp.appearanceCount < 5 && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/50 dark:text-sky-200" title="Frequent guest">Frequent</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {grp.appearanceCount === 1 ? (first.title || "—") : "—"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {grp.appearanceCount === 1 ? (first.program_name || "—") : "Multiple"}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {first.email ? (
                          <span className="truncate max-w-[180px] block" title={first.email}>{first.email}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 font-medium">
                        {grp.appearanceCount}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {(() => {
                          const dates = grp.appearances.map((a) => a.invited_at).filter(Boolean) as string[];
                          return dates.length ? new Date(dates.reduce((a, b) => (a > b ? a : b))).toLocaleDateString() : "—";
                        })()}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {grp.appearances.some((a) => a.matched_at) ? (
                          grp.appearances.filter((a) => a.matched_at).length === grp.appearanceCount ? (
                            first.matched_invoice_id ? (
                              <Link href={`/invoices/${first.matched_invoice_id}`} className="text-sky-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                {new Date(first.matched_at!).toLocaleDateString()}
                              </Link>
                            ) : (
                              new Date(first.matched_at!).toLocaleDateString()
                            )
                          ) : (
                            <span>{grp.appearances.filter((a) => a.matched_at).length} of {grp.appearanceCount}</span>
                          )
                        ) : (
                          <span className={noMatch ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {grp.appearances.every((a) => a.accepted === true)
                          ? "Yes"
                          : grp.appearances.every((a) => a.accepted === false)
                            ? "No"
                            : grp.appearances.some((a) => a.accepted !== null)
                              ? "Mixed"
                              : "—"}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          title={paymentTooltip || undefined}
                          className={
                            grp.anyPaid
                              ? "text-emerald-600 dark:text-emerald-400 cursor-help"
                              : grp.anyUnpaid
                                ? "text-gray-500 cursor-help"
                                : "cursor-default"
                          }
                        >
                          {grp.anyPaid
                            ? grp.paidAmounts.length
                              ? (() => {
                                  const byCurr = new Map<string, number>();
                                  for (const p of grp.paidAmounts) {
                                    byCurr.set(p.currency, (byCurr.get(p.currency) ?? 0) + p.amount);
                                  }
                                  const parts = Array.from(byCurr.entries()).map(([c, a]) => `${a.toLocaleString()} ${c}`);
                                  return parts.length === 1 ? parts[0]! : parts.join(" + ");
                                })()
                              : "Paid"
                            : grp.anyUnpaid
                              ? "Unpaid"
                              : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {grp.lastAppearanceDate ? new Date(grp.lastAppearanceDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2 max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotesModal(first);
                            setNotesDraft(first.notes || "");
                          }}
                          className="text-left text-xs text-gray-600 hover:text-sky-600 dark:text-gray-400 dark:hover:text-sky-400 truncate block max-w-full"
                          title={first.notes || "Add note"}
                        >
                          {first.notes ? (first.notes.length > 30 ? `${first.notes.slice(0, 30)}…` : first.notes) : "Add"}
                        </button>
                      </td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-gray-400 text-xs mr-1">{isExpanded ? "▼" : "▶"}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSendInvoiceLinkModal({ guest_name: first.guest_name, email: first.email, program_name: first.program_name ?? "", title: first.title ?? undefined, payment_currency: first.payment_currency ?? undefined });
                          }}
                          className="text-sky-600 hover:underline text-xs mr-2"
                        >
                          Send link
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInviteModal(first);
                            setForm({
                              guest_name: first.guest_name,
                              email: first.email || "",
                              title: first.title || "",
                              program_name: first.program_name || defaultProgramName,
                              general_topic: "",
                              program_specific_topic: "",
                              record_date: "",
                              record_time: "",
                              format: "remote",
                              studio_address: "TRT World London Studios 200 Gray's Inn Rd, London WC1X 8XZ",
                              include_program_description: true,
                              attach_calendar: true,
                              bcc_producer: true,
                              greeting_type: "dear",
                            });
                          }}
                          className="text-sky-600 hover:underline text-xs"
                        >
                          Invite again
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm(`Remove "${first.guest_name}" from invited guests? They will remain in the contact list.`)) return;
                            fetch(`/api/producer-guests/${first.id}`, { method: "DELETE", credentials: "same-origin" })
                              .then(async (r) => {
                                const data = await r.json();
                                if (r.ok) {
                                  toast.success("Removed from invited guests");
                                  loadGuests();
                                } else {
                                  toast.error((data as { error?: string }).error ?? "Failed to remove");
                                }
                              })
                              .catch(() => toast.error("Failed to remove"));
                          }}
                          className="text-red-600 hover:underline text-xs ml-2"
                          title="Remove from invited guests (contact list unchanged)"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                  if (isExpanded) {
                    grp.appearances.forEach((g) => {
                      const subNoMatch = g.invited_at && !g.matched_at;
                      const subRowBg =
                        g.accepted === true
                          ? "bg-green-50/70 dark:bg-green-950/10"
                          : g.accepted === false
                            ? "bg-red-50/70 dark:bg-red-950/10"
                            : "";
                      rows.push(
                        <tr key={g.id} className={`${subRowBg} border-l-4 border-sky-200 dark:border-sky-800`}>
                          <td className="px-4 py-2 pl-8">
                            {g.email && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(g.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setSelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(g.id)) next.delete(g.id);
                                    else next.add(g.id);
                                    return next;
                                  });
                                }}
                                className="h-4 w-4 rounded"
                              />
                            )}
                          </td>
                          {isAdmin && <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{g.producer_name}</td>}
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetch(`/api/producer-guests/${g.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ is_favorite: !g.is_favorite }),
                                  credentials: "same-origin",
                                })
                                  .then((r) => r.json())
                                  .then(() => fetch("/api/producer-guests", { credentials: "same-origin" }).then((res) => res.json()))
                                  .then((list) => setGuests(Array.isArray(list) ? list : []))
                                  .catch(() => toast.error("Failed to update"));
                              }}
                              className={`text-sm ${g.is_favorite ? "text-amber-500" : "text-gray-300 hover:text-amber-400"}`}
                            >
                              ★
                            </button>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{g.guest_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{g.title || "—"}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{g.program_name || "—"}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{g.email || "—"}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">—</td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {g.invited_at ? new Date(g.invited_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {g.matched_at ? (
                              g.matched_invoice_id ? (
                                <Link href={`/invoices/${g.matched_invoice_id}`} className="text-sky-600 hover:underline">
                                  {new Date(g.matched_at).toLocaleDateString()}
                                </Link>
                              ) : (
                                new Date(g.matched_at).toLocaleDateString()
                              )
                            ) : (
                              <span className={subNoMatch ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={g.accepted === true ? "yes" : g.accepted === false ? "no" : ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "yes") {
                                  setAcceptanceModal(g);
                                  setAcceptanceBankDetails(BANK_DETAILS_DEFAULT);
                                  const baseForm = {
                                    payment_received: true,
                                    payment_amount: 0,
                                    payment_currency: "GBP" as const,
                                    recording_date: new Date().toISOString().slice(0, 10),
                                    recording_topic: "",
                                    program_name: g.program_name || defaultProgramName,
                                    generate_invoice: false,
                                    save_as_template: false,
                                    invoice_number: "",
                                    invoice_date: new Date().toISOString().slice(0, 10),
                                    account_name: "",
                                    account_number: "",
                                    sort_code: "",
                                    bank_name: "",
                                    bank_address: "",
                                    paypal: "",
                                    bank_type: "uk" as const,
                                    iban: "",
                                    swift_bic: "",
                                  };
                                  setAcceptanceForm(baseForm);
                                  fetch(`/api/producer-guests/${g.id}/last-invitation`, { credentials: "same-origin" })
                                    .then((r) => r.json())
                                    .then((data) => {
                                      setAcceptanceForm((p) => ({
                                        ...p,
                                        ...(data?.record_date && { recording_date: data.record_date }),
                                        ...(data?.program_name && { program_name: data.program_name }),
                                        ...(data?.program_specific_topic && { recording_topic: data.program_specific_topic }),
                                      }));
                                    })
                                    .catch(() => {});
                                } else {
                                  updateAccepted(g.id, v === "no" ? false : null);
                                }
                              }}
                              className="rounded border px-2 py-1 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="">—</option>
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {g.payment_received ? (
                              <span title={g.payment_amount != null ? `${g.payment_amount} ${g.payment_currency ?? ""}` : ""} className="text-emerald-600 dark:text-emerald-400 cursor-help">
                                {g.payment_amount != null ? `${g.payment_amount} ${g.payment_currency ?? ""}` : "Paid"}
                              </span>
                            ) : g.accepted === true ? (
                              <span className="text-gray-500">Unpaid</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {g.recording_date ? new Date(g.recording_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-2 max-w-[120px]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotesModal(g);
                                setNotesDraft(g.notes || "");
                              }}
                              className="text-left text-xs text-gray-600 hover:text-sky-600 truncate block max-w-full"
                            >
                              {g.notes ? (g.notes.length > 20 ? `${g.notes.slice(0, 20)}…` : g.notes) : "Add"}
                            </button>
                          </td>
                          <td className="px-4 py-2 flex flex-wrap gap-1">
                            <Link
                              href={`/submit?guest_id=${g.id}&tab=generate`}
                              className="text-emerald-600 hover:underline text-xs"
                            >
                              Create invoice
                            </Link>
                            {g.accepted === true && g.email?.includes("@") && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/producer-guests/${g.id}/resend-post-recording-email`, { method: "POST", credentials: "same-origin" });
                                    const data = await res.json();
                                    if (res.ok) toast.success(data.message ?? "Email resent");
                                    else toast.error(data.error ?? "Failed");
                                  } catch {
                                    toast.error("Failed to resend");
                                  }
                                }}
                                className="text-amber-600 hover:underline text-xs"
                              >
                                Resend email
                              </button>
                            )}
                            <button
                              onClick={() => setSendInvoiceLinkModal({ guest_name: g.guest_name, email: g.email, program_name: g.program_name ?? "", title: g.title ?? undefined, payment_currency: g.payment_currency ?? undefined })}
                              className="text-sky-600 hover:underline text-xs"
                            >
                              Send link
                            </button>
                            <button
                              onClick={() => {
                                setInviteModal(g);
                                setForm({
                                  guest_name: g.guest_name,
                                  email: g.email || "",
                                  title: g.title || "",
                                  program_name: g.program_name || defaultProgramName,
                                  general_topic: "",
                                  program_specific_topic: "",
                                  record_date: "",
                                  record_time: "",
                                  format: "remote",
                                  studio_address: "TRT World London Studios 200 Gray's Inn Rd, London WC1X 8XZ",
                                  include_program_description: true,
                                  attach_calendar: true,
                                  bcc_producer: true,
                                  greeting_type: "dear",
                                });
                              }}
                              className="text-sky-600 hover:underline text-xs"
                            >
                              Invite again
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!confirm(`Remove "${g.guest_name}" from invited guests? They will remain in the contact list.`)) return;
                                fetch(`/api/producer-guests/${g.id}`, { method: "DELETE", credentials: "same-origin" })
                                  .then(async (r) => {
                                    const data = await r.json();
                                    if (r.ok) {
                                      toast.success("Removed from invited guests");
                                      loadGuests();
                                    } else {
                                      toast.error((data as { error?: string }).error ?? "Failed to remove");
                                    }
                                  })
                                  .catch(() => toast.error("Failed to remove"));
                              }}
                              className="text-red-600 hover:underline text-xs ml-2"
                              title="Remove from invited guests (contact list unchanged)"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  }
                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setInviteModal(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              {inviteModal === "new" ? "Invite New Guest" : "Send Invitation"}
            </h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Title is required before sending. Guest is saved to main contact list and your list after send.
            </p>
            {guests.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium">Load from previous guest</label>
                <select
                  className={inputCls}
                  value=""
                  onChange={(e) => {
                    const g = guests.find((x) => x.guest_name === e.target.value);
                    if (g) {
                      setForm((p) => ({
                        ...p,
                        guest_name: g.guest_name,
                        email: g.email || "",
                        title: g.title || "",
                        program_name: g.program_name || defaultProgramName,
                      }));
                    }
                  }}
                >
                  <option value="">— Select to pre-fill —</option>
                  {guests.map((g) => (
                    <option key={g.id} value={g.guest_name}>{g.guest_name} {g.email ? `(${g.email})` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-4">
              <div className="relative">
                <label className="mb-1 block text-sm font-medium">Guest name *</label>
                <input
                  type="text"
                  value={form.guest_name}
                  onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
                  onFocus={() => form.guest_name.trim().length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className={inputCls}
                  placeholder="e.g. John Smith (suggestions as you type)"
                  autoComplete="off"
                />
                {showSuggestions && guestSuggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                    {guestSuggestions.map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            setForm((p) => ({
                              ...p,
                              guest_name: s.guest_name,
                              email: s.email || p.email,
                              title: s.title || p.title,
                              program_name: s.program_name || p.program_name,
                            }));
                            setShowSuggestions(false);
                          }}
                        >
                          {s.guest_name}
                          {s.email ? ` · ${s.email}` : ""}
                          {s.title ? ` · ${s.title}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className={inputCls}
                  placeholder="Enter email manually"
                />
                {form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Check email format (e.g. name@domain.com)</p>
                )}
                {duplicateWarning && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">This guest may already be in your list. You can still send to update their record.</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Title *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    list="title-list"
                    className={inputCls}
                    placeholder="e.g. Professor, Dr"
                  />
                  <datalist id="title-list">
                    {titles.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={async () => {
                      const n = prompt("New title?");
                      if (n) {
                        const added = await addTitle(n);
                        if (added) {
                          setForm((p) => ({ ...p, title: p.title || added }));
                          toast.success("Title added");
                        }
                      }
                    }}
                    className="shrink-0 rounded-lg border px-2 text-xs"
                  >
                    + Add
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Program (default: your program)</label>
                <input
                  type="text"
                  value={form.program_name}
                  onChange={(e) => setForm((p) => ({ ...p, program_name: e.target.value }))}
                  list="program-list"
                  className={inputCls}
                />
                <datalist id="program-list">
                  {programs.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                  {Object.keys(PROGRAM_DESCRIPTIONS).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                {form.program_name && getProgramDescription(form.program_name) && (
                  <p className="mt-1 text-xs italic text-gray-500">{getProgramDescription(form.program_name)}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Greeting</label>
                <select value={form.greeting_type} onChange={(e) => setForm((p) => ({ ...p, greeting_type: e.target.value as "dear" | "mr_ms" | "mr" | "ms" | "mrs" | "miss" }))} className={inputCls}>
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
                <select value={form.general_topic} onChange={(e) => setForm((p) => ({ ...p, general_topic: e.target.value }))} className={inputCls}>
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
                  value={form.program_specific_topic}
                  onChange={(e) => setForm((p) => ({ ...p, program_specific_topic: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. US-Turkey relations, Climate summit outcomes"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Shown in the invitation email</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Recording date *</label>
                  <input type="date" value={form.record_date} onChange={(e) => setForm((p) => ({ ...p, record_date: e.target.value }))} required className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Recording time *</label>
                  <input type="time" value={form.record_time} onChange={(e) => setForm((p) => ({ ...p, record_time: e.target.value }))} required className={inputCls} />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={form.format === "remote"} onChange={() => setForm((p) => ({ ...p, format: "remote" }))} className="h-4 w-4 text-sky-600" />
                  <span className="text-sm">Remote (Skype/Zoom)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={form.format === "studio"} onChange={() => setForm((p) => ({ ...p, format: "studio" }))} className="h-4 w-4 text-sky-600" />
                  <span className="text-sm">In-studio</span>
                </label>
              </div>
              {form.format === "studio" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Studio address</label>
                  <textarea value={form.studio_address} onChange={(e) => setForm((p) => ({ ...p, studio_address: e.target.value }))} rows={2} className={inputCls} />
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.include_program_description} onChange={(e) => setForm((p) => ({ ...p, include_program_description: e.target.checked }))} className="h-4 w-4 rounded text-sky-600" />
                <span className="text-sm">Include program description in email</span>
              </label>
              <div>
                <button type="button" onClick={() => setShowPreview((p) => !p)} className="rounded-lg border px-3 py-1.5 text-sm">
                  {showPreview ? "Hide preview" : "Preview email"}
                </button>
              </div>
              {showPreview && form.guest_name.trim() && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-600 dark:bg-gray-900">
                  <p className="mb-2 font-medium">Email preview:</p>
                  <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {`Subject: TRT World – Invitation to the program: ${form.program_name.trim() || "our program"}

${buildInviteGreeting(form.guest_name, form.greeting_type)},

I hope this message finds you well.

I am writing to invite you to participate in ${form.program_name.trim() || "our program"}, which will be broadcast on TRT World and will focus on ${form.program_specific_topic.trim() || "the scheduled topic"}.${form.include_program_description && form.program_name.trim() && getProgramDescription(form.program_name) ? `

${getProgramDescription(form.program_name)}` : ""}

The recording is scheduled for ${form.record_date.trim() || "TBD"} at ${form.record_time.trim() || "TBD"}.

${form.format === "remote" ? "The recording will be conducted remotely via Skype or Zoom." : `The recording will take place in our studio. The address is: ${form.studio_address || "—"}`}${form.format === "studio" ? `

We can arrange to pick you up from your preferred location and drop you back after the recording.` : ""}

Would you be interested in joining us for this program? Please reply to this email to confirm your participation.

Best regards,
${selectedProducer.full_name}`}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setInviteModal(null)} className="rounded-lg border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingDraft || !form.guest_name.trim()}
                  onClick={async () => {
                    if (!form.guest_name.trim()) return;
                    setSavingDraft(true);
                    try {
                      const res = await fetch("/api/producer-guests", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          guest_name: form.guest_name.trim(),
                          email: form.email.trim() || null,
                          title: form.title.trim() || null,
                          program_name: form.program_name.trim() || null,
                        }),
                        credentials: "same-origin",
                      });
                      if (res.ok) {
                        toast.success("Guest saved to your list");
                        const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
                        setGuests(Array.isArray(list) ? list : []);
                      } else {
                        const d = await res.json();
                        toast.error(d.error ?? "Failed to save");
                      }
                    } catch {
                      toast.error("Failed to save");
                    } finally {
                      setSavingDraft(false);
                    }
                  }}
                  className="rounded-lg border border-sky-600 px-4 py-2 text-sm text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 disabled:opacity-50"
                >
                  {savingDraft ? "Saving..." : "Save draft"}
                </button>
                <button
                  type="button"
                  onClick={handleSendInvite}
                  disabled={sending || !form.guest_name.trim() || !form.email.trim() || !form.email.includes("@") || !form.title.trim() || !form.program_specific_topic.trim() || !form.record_date.trim() || !form.record_time.trim()}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {quickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setQuickAddModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Quick add from email</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Paste an email or &quot;Name &lt;email@example.com&gt;&quot; from Outlook or your contacts
            </p>
            <textarea
              value={quickAddPaste}
              onChange={(e) => setQuickAddPaste(e.target.value)}
              placeholder="e.g. john@example.com or John Smith <john@example.com>"
              rows={3}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setQuickAddModal(false)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const raw = quickAddPaste.trim();
                  if (!raw) return;
                  let name = "";
                  let email = "";
                  const angleMatch = raw.match(/^(.+?)\s*<([^>]+)>$/);
                  if (angleMatch) {
                    name = angleMatch[1]!.trim();
                    email = angleMatch[2]!.trim();
                  } else {
                    const parts = raw.split(/\s+/);
                    const emailPart = parts.find((p) => p.includes("@"));
                    if (emailPart) {
                      email = emailPart;
                      name = parts.filter((p) => p !== emailPart).join(" ").trim();
                    } else if (raw.includes("@")) {
                      email = raw;
                    }
                  }
                  if (!email || !email.includes("@")) {
                    toast.error("Could not find a valid email address");
                    return;
                  }
                  if (!name) name = email.split("@")[0]!.replace(/[._]/g, " ");
                  setInviteModal("new");
                  setForm((p) => ({
                    ...p,
                    guest_name: name,
                    email,
                  }));
                  setQuickAddModal(false);
                  setQuickAddPaste("");
                }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500"
              >
                Add & invite
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setBulkImportModal(false)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Bulk import from CSV</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Upload a CSV with columns: <strong>guest_name</strong> (required), email, title, program_name
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => setBulkImportFile(e.target.files?.[0] ?? null)}
              className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-50 file:px-4 file:py-2 file:text-sky-600 dark:file:bg-sky-950/30 dark:file:text-sky-400"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setBulkImportModal(false)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkImportFile || bulkImporting}
                onClick={async () => {
                  if (!bulkImportFile) return;
                  setBulkImporting(true);
                  try {
                    const formData = new FormData();
                    formData.append("file", bulkImportFile);
                    const res = await fetch("/api/producer-guests/bulk-import", {
                      method: "POST",
                      body: formData,
                      credentials: "same-origin",
                    });
                    const data = await res.json();
                    if (res.ok) {
                      toast.success(`Imported ${data.imported} guest(s)`);
                      if (data.errors?.length) toast.warning(data.errors.slice(0, 3).join("; "));
                      setBulkImportModal(false);
                      setBulkImportFile(null);
                      const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
                      setGuests(Array.isArray(list) ? list : []);
                    } else {
                      toast.error(data.error ?? "Import failed");
                    }
                  } catch {
                    toast.error("Import failed");
                  } finally {
                    setBulkImporting(false);
                  }
                }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {bulkImporting ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sendInvoiceLinkModal !== null && (
        <SendInvoiceLinkModal
          initialGuestName={sendInvoiceLinkModal.guest_name}
          initialEmail={sendInvoiceLinkModal.email}
          initialProgramName={sendInvoiceLinkModal.program_name ?? ""}
          initialTitle={sendInvoiceLinkModal.title}
          initialPaymentCurrency={sendInvoiceLinkModal.payment_currency ?? undefined}
          programs={programs.map((p) => p.name)}
          onClose={() => setSendInvoiceLinkModal(null)}
          onSent={(msg) => {
            setSendInvoiceLinkModal(null);
            toast.success(msg ?? "Invoice submit link sent.");
            loadGuests();
          }}
        />
      )}

      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setNotesModal(null)}>
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Guest notes</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Private notes for <strong>{notesModal.guest_name}</strong> (e.g. preferences, topics)
            </p>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="e.g. Prefers morning slots, strong on Middle East"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setNotesModal(null)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/producer-guests/${notesModal.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ notes: notesDraft.trim() || null }),
                      credentials: "same-origin",
                    });
                    if (res.ok) {
                      toast.success("Notes saved");
                      setNotesModal(null);
                      const list = await fetch("/api/producer-guests", { credentials: "same-origin" }).then((r) => r.json());
                      setGuests(Array.isArray(list) ? list : []);
                    } else {
                      toast.error("Failed to save");
                    }
                  } catch {
                    toast.error("Failed to save");
                  }
                }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {acceptanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setAcceptanceModal(null)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Mark as Accepted (Post-Recording)</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Guest: <strong>{acceptanceModal.guest_name}</strong>
              {acceptanceModal.email && <> ({acceptanceModal.email})</>}
            </p>
            {(!acceptanceModal.email || !acceptanceModal.email.includes("@")) && (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Email is required to send the post-recording thank-you email. Please add the guest&apos;s email before marking as accepted.
              </p>
            )}
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Does the guest receive payment?</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={acceptanceForm.payment_received}
                      onChange={() => setAcceptanceForm((p) => ({ ...p, payment_received: true }))}
                      className="h-4 w-4 text-sky-600"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={!acceptanceForm.payment_received}
                      onChange={() => setAcceptanceForm((p) => ({ ...p, payment_received: false }))}
                      className="h-4 w-4 text-sky-600"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>

              {!acceptanceForm.payment_received && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Program (for thank-you, optional)</label>
                  <input
                    type="text"
                    value={acceptanceForm.program_name}
                    onChange={(e) => setAcceptanceForm((p) => ({ ...p, program_name: e.target.value }))}
                    list="program-list-accept-unpaid"
                    placeholder={acceptanceModal.program_name || "e.g. Newsline"}
                    className="rounded border border-gray-300 px-3 py-2 text-sm w-full dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <datalist id="program-list-accept-unpaid">
                    {programs.map((p) => (<option key={p.id} value={p.name} />))}
                  </datalist>
                </div>
              )}

              {acceptanceForm.payment_received && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium">Amount *</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={acceptanceForm.payment_amount || ""}
                        onChange={(e) => setAcceptanceForm((p) => ({ ...p, payment_amount: parseFloat(e.target.value) || 0 }))}
                        className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium">Currency</label>
                      <select
                        value={acceptanceForm.payment_currency}
                        onChange={(e) => setAcceptanceForm((p) => ({ ...p, payment_currency: e.target.value as "GBP" | "EUR" | "USD" }))}
                        className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Program (for thank-you)</label>
                    <input
                      type="text"
                      value={acceptanceForm.program_name}
                      onChange={(e) => setAcceptanceForm((p) => ({ ...p, program_name: e.target.value }))}
                      list="program-list-accept"
                      className="rounded border border-gray-300 px-3 py-2 text-sm w-full dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                    <datalist id="program-list-accept">
                      {programs.map((p) => (<option key={p.id} value={p.name} />))}
                    </datalist>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Recording date</label>
                    <input
                      type="date"
                      value={acceptanceForm.recording_date}
                      onChange={(e) => setAcceptanceForm((p) => ({ ...p, recording_date: e.target.value }))}
                      className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Recording topic</label>
                    <input
                      type="text"
                      value={acceptanceForm.recording_topic}
                      onChange={(e) => setAcceptanceForm((p) => ({ ...p, recording_topic: e.target.value }))}
                      placeholder="e.g. US-Turkey relations"
                      className="rounded border border-gray-300 px-3 py-2 text-sm w-full dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={acceptanceForm.generate_invoice}
                        onChange={(e) => {
                          const gen = e.target.checked;
                          setAcceptanceForm((p) => ({ ...p, generate_invoice: gen }));
                          if (gen && !acceptanceForm.invoice_number) fetchNextInvoiceNumber();
                        }}
                        className="h-4 w-4 rounded text-sky-600"
                      />
                      <span className="text-sm font-medium">Generate invoice on behalf of guest</span>
                    </label>
                  </div>

                  {acceptanceForm.generate_invoice && (
                    <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                      {invoiceTemplates.length > 0 && (
                        <div>
                          <label className="mb-1 block text-sm font-medium">Load bank details from template</label>
                          <select
                            className="rounded border border-gray-300 px-3 py-2 text-sm w-full dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            value=""
                            onChange={(e) => {
                              const t = invoiceTemplates.find((x) => x.id === e.target.value);
                              if (t) {
                                setAcceptanceBankDetails({
                                  bankType: t.bank_type === "international" ? "international" : "uk",
                                  accountName: t.account_name ?? "",
                                  bankName: t.bank_name ?? "",
                                  accountNumber: t.account_number ?? "",
                                  sortCode: t.sort_code ?? "",
                                  bankAddress: t.bank_address ?? "",
                                  iban: t.iban ?? "",
                                  swiftBic: t.swift_bic ?? "",
                                  paypal: t.paypal ?? "",
                                });
                              }
                            }}
                          >
                            <option value="">— Select template —</option>
                            {invoiceTemplates.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}{t.guest_name ? ` (${t.guest_name})` : ""}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Invoice number is auto-suggested from existing records. You can edit if needed.
                      </p>
                      {invoiceNumberConflict && (
                        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                          This invoice number already exists. Please use a different number.
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium">Invoice number *</label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={acceptanceForm.invoice_number}
                              onChange={(e) => setAcceptanceForm((p) => ({ ...p, invoice_number: e.target.value }))}
                              placeholder="e.g. INV-2025-001"
                              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => fetchNextInvoiceNumber()}
                              title="Get next invoice number"
                              className="rounded border border-gray-300 px-2 py-2 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-600"
                            >
                              ↻
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium">Invoice date</label>
                          <input
                            type="date"
                            value={acceptanceForm.invoice_date}
                            onChange={(e) => setAcceptanceForm((p) => ({ ...p, invoice_date: e.target.value }))}
                            className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>
                      <BankDetailsFields
                        values={acceptanceBankDetails}
                        onChange={setAcceptanceBankDetails}
                        inputCls="rounded border border-gray-300 px-3 py-2 text-sm w-full dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={acceptanceForm.save_as_template}
                          onChange={(e) => setAcceptanceForm((p) => ({ ...p, save_as_template: e.target.checked }))}
                          className="h-4 w-4 rounded text-sky-600"
                        />
                        <span className="text-sm">Save bank details as template for future use</span>
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setAcceptanceModal(null)} className="rounded-lg border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkAccepted}
                disabled={sending || !acceptanceModal.email?.includes("@") || (acceptanceForm.payment_received && acceptanceForm.payment_amount <= 0) || (acceptanceForm.generate_invoice && (invoiceNumberConflict || !acceptanceForm.invoice_number.trim() || !!validateBankDetails(acceptanceBankDetails)))}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {sending ? "Processing..." : "Mark Accepted & Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setBulkInviteModal(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bulk invite</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Sending to {selectedWithEmail.length} guest(s). Fill the shared invite details below.
            </p>
            <div className="mb-4 max-h-24 overflow-y-auto rounded border p-2 text-xs">
              {selectedWithEmail.map((g) => (
                <div key={g.id}>{g.guest_name} ({g.email})</div>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Program *</label>
                <input type="text" value={form.program_name} onChange={(e) => setForm((p) => ({ ...p, program_name: e.target.value }))} list="program-list-bulk" className={inputCls} />
                <datalist id="program-list-bulk">
                  {programs.map((p) => (<option key={p.id} value={p.name} />))}
                  {Object.keys(PROGRAM_DESCRIPTIONS).map((n) => (<option key={n} value={n} />))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Program-specific topic *</label>
                <input type="text" value={form.program_specific_topic} onChange={(e) => setForm((p) => ({ ...p, program_specific_topic: e.target.value }))} className={inputCls} placeholder="e.g. US-Turkey relations" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Recording date *</label>
                  <input type="date" value={form.record_date} onChange={(e) => setForm((p) => ({ ...p, record_date: e.target.value }))} required className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Recording time *</label>
                  <input type="time" value={form.record_time} onChange={(e) => setForm((p) => ({ ...p, record_time: e.target.value }))} required className={inputCls} />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={form.format === "remote"} onChange={() => setForm((p) => ({ ...p, format: "remote" }))} className="h-4 w-4 text-sky-600" />
                  <span className="text-sm">Remote</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="radio" checked={form.format === "studio"} onChange={() => setForm((p) => ({ ...p, format: "studio" }))} className="h-4 w-4 text-sky-600" />
                  <span className="text-sm">In-studio</span>
                </label>
              </div>
              {form.format === "studio" && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Studio address</label>
                  <textarea value={form.studio_address} onChange={(e) => setForm((p) => ({ ...p, studio_address: e.target.value }))} rows={2} className={inputCls} />
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.include_program_description} onChange={(e) => setForm((p) => ({ ...p, include_program_description: e.target.checked }))} className="h-4 w-4 rounded text-sky-600" />
                <span className="text-sm">Include program description</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setBulkInviteModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={handleBulkSendInvite}
                  disabled={sending || !form.program_specific_topic.trim() || !form.record_date.trim() || !form.record_time.trim()}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {sending ? "Sending..." : `Send to ${selectedWithEmail.length} guest(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkAcceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => setBulkAcceptModal(false)}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Bulk mark accepted</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Marking {selectedGuests.filter((g) => g.accepted !== true && g.email?.includes("@") && g.source === "producer_guests").length} guest(s) as accepted. Invoice generation is not available for bulk; use single flow for that.
            </p>
            <div className="mb-4 max-h-24 overflow-y-auto rounded border p-2 text-xs">
              {selectedGuests.filter((g) => g.accepted !== true && g.email?.includes("@")).map((g) => (
                <div key={g.id}>{g.guest_name} ({g.email})</div>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Do guests receive payment?</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" checked={bulkAcceptForm.payment_received} onChange={() => setBulkAcceptForm((p) => ({ ...p, payment_received: true }))} className="h-4 w-4 text-sky-600" />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" checked={!bulkAcceptForm.payment_received} onChange={() => setBulkAcceptForm((p) => ({ ...p, payment_received: false }))} className="h-4 w-4 text-sky-600" />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>
              {bulkAcceptForm.payment_received && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Amount *</label>
                    <input type="number" min={0} step={0.01} value={bulkAcceptForm.payment_amount || ""} onChange={(e) => setBulkAcceptForm((p) => ({ ...p, payment_amount: parseFloat(e.target.value) || 0 }))} className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Currency</label>
                    <select value={bulkAcceptForm.payment_currency} onChange={(e) => setBulkAcceptForm((p) => ({ ...p, payment_currency: e.target.value as "GBP" | "EUR" | "USD" }))} className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Program (for thank-you)</label>
                <input type="text" value={bulkAcceptForm.program_name} onChange={(e) => setBulkAcceptForm((p) => ({ ...p, program_name: e.target.value }))} list="program-list-bulk-accept" className="rounded border border-gray-300 px-3 py-2 text-sm w-full dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                <datalist id="program-list-bulk-accept">{programs.map((p) => (<option key={p.id} value={p.name} />))}</datalist>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Recording date</label>
                <input type="date" value={bulkAcceptForm.recording_date} onChange={(e) => setBulkAcceptForm((p) => ({ ...p, recording_date: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Recording topic</label>
                <input type="text" value={bulkAcceptForm.recording_topic} onChange={(e) => setBulkAcceptForm((p) => ({ ...p, recording_topic: e.target.value }))} placeholder="e.g. US-Turkey relations" className="rounded border border-gray-300 px-3 py-2 text-sm w-full dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setBulkAcceptModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                <button type="button" onClick={handleBulkMarkAccepted} disabled={sending || (bulkAcceptForm.payment_received && bulkAcceptForm.payment_amount <= 0)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                  {sending ? "Processing..." : "Mark Accepted & Send Emails"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
