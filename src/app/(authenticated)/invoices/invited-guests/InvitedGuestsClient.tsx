"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getProgramDescription, PROGRAM_DESCRIPTIONS } from "@/lib/program-descriptions";
import { buildInviteGreeting, type GreetingType } from "@/lib/invite-greeting";

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
  created_at: string;
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
  const [sending, setSending] = useState(false);

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
    greeting_type: "dear" as "dear" | "mr_ms",
  });

  const [showPreview, setShowPreview] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const GENERAL_TOPIC_OPTIONS = ["News", "Foreign Policy", "Domestic Politics", "Security", "Economics", "Climate", "Culture", "Sports", "Technology", "Other"];

  useEffect(() => {
    fetch("/api/producer-guests", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        setGuests(Array.isArray(data) ? data : []);
      })
      .catch(() => setGuests([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/guest-titles", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        setTitles(Array.isArray(data) ? data.map((t: { name: string }) => t.name) : initialTitles);
      })
      .catch(() => {});
  }, [initialTitles]);

  const selectedProducer = producers.find((p) => p.id === currentUserId) ?? { id: currentUserId, full_name: currentUserFullName };

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
          producer_guest_id: inviteModal && inviteModal !== "new" ? inviteModal.id : undefined,
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

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white";

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="text-sky-600 hover:underline dark:text-sky-400">
            ← Guest Invoices
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {isAdmin ? "All Invited Guests" : "My Invited Guests"}
          </h1>
        </div>
        <button
          onClick={() => {
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
          }}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + Invite Guest
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {isAdmin && <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Producer</th>}
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Guest</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Title</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Program</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Email</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Invited</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Matched</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Accepted</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {guests.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-500">
                    No invited guests yet. Click &quot;Invite Guest&quot; to add one.
                  </td>
                </tr>
              ) : (
                guests.map((g) => {
                  const noMatch = g.invited_at && !g.matched_at;
                  return (
                    <tr
                      key={g.id}
                      className={noMatch ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                    >
                      {isAdmin && (
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{g.producer_name}</td>
                      )}
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{g.guest_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{g.title || "—"}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{g.program_name || "—"}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {g.email ? (
                          <span className="truncate max-w-[180px] block" title={g.email}>{g.email}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
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
                          <span className={noMatch ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={g.accepted === true ? "yes" : g.accepted === false ? "no" : ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateAccepted(g.id, v === "yes" ? true : v === "no" ? false : null);
                          }}
                          className="rounded border px-2 py-1 text-xs"
                        >
                          <option value="">—</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
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
                      </td>
                    </tr>
                  );
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
              <div>
                <label className="mb-1 block text-sm font-medium">Guest name *</label>
                <input
                  type="text"
                  value={form.guest_name}
                  onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
                  className={inputCls}
                  placeholder="e.g. John Smith"
                />
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
                <select value={form.greeting_type} onChange={(e) => setForm((p) => ({ ...p, greeting_type: e.target.value as "dear" | "mr_ms" }))} className={inputCls}>
                  <option value="dear">Dear [full name]</option>
                  <option value="mr_ms">Dear Mr./Ms. [surname]</option>
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
    </div>
  );
}
