"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { mutate } from "swr";
import { createClient } from "@/lib/supabase/client";
import { invoiceListUrl } from "@/lib/invoice-list-url";
import { parseMentions } from "@/lib/mention-utils";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  invoice_id: string | null;
  invoice_display: string | null;
  invoice_type?: string | null;
  parent_message_id?: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  sender_name: string;
  recipient_name: string;
  is_from_me: boolean;
  is_to_me: boolean;
};

type Recipient = { id: string; full_name: string; role?: string };

type Conversation = {
  userId: string;
  name: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
};

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const invoiceIdFromUrl = searchParams.get("invoiceId");
  const recipientIdFromUrl = searchParams.get("recipientId");

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState<{ id: string; invoice_number: string; beneficiary: string; invoice_type?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState<{ id: string; invoice_number: string; invoice_type?: string } | null>(
    invoiceIdFromUrl ? { id: invoiceIdFromUrl, invoice_number: "…" } : null
  );
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [typingPeer, setTypingPeer] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; content: string } | null>(null);
  const [attachment, setAttachment] = useState<{ path: string; name: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAllMessages = useCallback(async (searchQ?: string) => {
    try {
      const params = new URLSearchParams({ folder: "all" });
      if (searchQ?.trim()) params.set("q", searchQ.trim());
      const res = await fetch(`/api/messages?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as Message[];
        const list = Array.isArray(data) ? data : [];
        setMessages(list);

        const byPeer: Record<string, Message[]> = {};
        for (const m of list) {
          const peer = m.is_from_me ? m.recipient_id : m.sender_id;
          if (!byPeer[peer]) byPeer[peer] = [];
          byPeer[peer].push(m);
        }
        const convs: Conversation[] = [];
        for (const [userId, msgs] of Object.entries(byPeer)) {
          const sorted = [...msgs].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const last = sorted[0];
          const name = last.is_from_me ? last.recipient_name : last.sender_name;
          const unread = msgs.filter((m) => m.is_to_me && !m.read_at).length;
          convs.push({
            userId,
            name,
            lastMessage: last.content.slice(0, 60) + (last.content.length > 60 ? "…" : ""),
            lastAt: last.created_at,
            unread,
          });
        }
        convs.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
        setConversations(convs);

      }
    } catch {
      setMessages([]);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConversation = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/messages?conversation_with=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = (await res.json()) as Message[];
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch {
      setMessages([]);
    }
  }, []);

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/recipients");
      if (res.ok) {
        const data = await res.json();
        setRecipients(Array.isArray(data) ? data : []);
      }
    } catch {
      setRecipients([]);
    }
  }, []);

  const fetchInvoiceSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setInvoiceSearch([]);
      return;
    }
    try {
      const res = await fetch(`/api/invoices/search?q=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setInvoiceSearch(Array.isArray(data) ? data : []);
      } else {
        setInvoiceSearch([]);
      }
    } catch {
      setInvoiceSearch([]);
    }
  }, []);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/messages/${id}/read`, { method: "PATCH" });
        fetchAllMessages(messageSearch);
        if (selectedUserId) fetchConversation(selectedUserId);
        void mutate("/api/dashboard/my-tasks");
      } catch {
        /* ignore */
      }
    },
    [messageSearch, selectedUserId, fetchAllMessages, fetchConversation]
  );

  useEffect(() => {
    fetchAllMessages(messageSearch);
    fetchRecipients();
  }, [fetchAllMessages, fetchRecipients, messageSearch]);

  useEffect(() => {
    if (invoiceIdFromUrl) {
      fetch(`/api/invoices/search?id=${encodeURIComponent(invoiceIdFromUrl)}`)
        .then((r) => r.json())
        .then((data) => {
          const inv = Array.isArray(data) && data[0] ? data[0] : null;
          setInvoiceRef(
            inv
              ? { id: inv.id, invoice_number: inv.invoice_number, invoice_type: inv.invoice_type }
              : { id: invoiceIdFromUrl, invoice_number: "…" }
          );
        })
        .catch(() => setInvoiceRef({ id: invoiceIdFromUrl, invoice_number: "…" }));
    }
  }, [invoiceIdFromUrl]);

  useEffect(() => {
    if (!recipientIdFromUrl) return;
    setSelectedUserId(recipientIdFromUrl);
    const r = recipients.find((x) => x.id === recipientIdFromUrl);
    const name = r?.full_name ?? "Unknown";
    setConversations((prev) => {
      if (prev.some((c) => c.userId === recipientIdFromUrl)) return prev;
      return [{ userId: recipientIdFromUrl, name, lastMessage: "", lastAt: new Date().toISOString(), unread: 0 }, ...prev];
    });
  }, [recipientIdFromUrl, recipients]);

  useEffect(() => {
    if (selectedUserId) {
      fetchConversation(selectedUserId);
    } else {
      fetchAllMessages(messageSearch);
    }
  }, [selectedUserId, fetchConversation, fetchAllMessages, messageSearch]);

  /* Mark unread as read when viewing a conversation (covers URL open + click) */
  useEffect(() => {
    if (!selectedUserId) return;
    const toMark = messages.filter((m) => m.sender_id === selectedUserId && m.is_to_me && !m.read_at);
    toMark.forEach((m) => markAsRead(m.id));
  }, [selectedUserId, messages, markAsRead]);

  useEffect(() => {
    const t = setTimeout(() => fetchInvoiceSearch(invoiceSearchQuery), 300);
    return () => clearTimeout(t);
  }, [invoiceSearchQuery, fetchInvoiceSearch]);

  useEffect(() => {
    const fn = () => fetchAllMessages(messageSearch);
    pollIntervalRef.current = setInterval(fn, 15000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchAllMessages, messageSearch]);

  /* Supabase Realtime: refetch when messages change */
  useEffect(() => {
    let disposed = false;
    let sub: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId || disposed) return;

        const onMessageChange = () => {
          if (disposed) return;
          fetchAllMessages(messageSearch);
          if (selectedUserId) fetchConversation(selectedUserId);
        };

        sub = supabase
          .channel("messages-rt")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "messages" },
            (payload) => {
              const rec = (payload.new ?? payload.old) as Record<string, unknown> | null;
              if (!rec) return;
              const sid = rec.sender_id as string | undefined;
              const rid = rec.recipient_id as string | undefined;
              if (sid === userId || rid === userId) onMessageChange();
            }
          )
          .subscribe();
      } catch {
        /* realtime not critical */
      }
    })();
    return () => {
      disposed = true;
      sub?.unsubscribe();
    };
  }, [fetchAllMessages, fetchConversation, messageSearch, selectedUserId]);

  /* Typing indicator via Supabase presence */
  const typingChannelRef = useRef<{ track: (state: object) => Promise<void>; unsubscribe: () => void } | null>(null);
  useEffect(() => {
    if (!selectedUserId) {
      setTypingPeer(false);
      typingChannelRef.current?.unsubscribe();
      typingChannelRef.current = null;
      return;
    }
    let disposed = false;
    let myUserId: string | null = null;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        myUserId = session?.user?.id ?? null;
        if (!myUserId || disposed) return;

        const channelName = `typing:${[myUserId, selectedUserId].sort().join("-")}`;
        const ch = supabase.channel(channelName);

        ch.on("presence", { event: "sync" }, () => {
          if (disposed) return;
          const state = ch.presenceState() as Record<string, Array<{ user_id?: string; typing?: boolean }>>;
          const all = Object.values(state).flat() as { user_id?: string; typing?: boolean }[];
          const others = all.filter((p) => p?.user_id !== myUserId && p?.typing === true);
          setTypingPeer(others.length > 0);
        }).subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.track({ user_id: myUserId, typing: false });
            typingChannelRef.current = {
              track: async (s) => { await ch.track(s); },
              unsubscribe: () => ch.unsubscribe(),
            };
          }
        });
      } catch {
        /* presence not critical */
      }
    })();
    return () => {
      disposed = true;
      typingChannelRef.current?.unsubscribe();
      typingChannelRef.current = null;
    };
  }, [selectedUserId]);

  const sendTypingPresence = useCallback((typing: boolean) => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || !selectedUserId) return;
      await typingChannelRef.current?.track({ user_id: userId, typing });
    })();
  }, [selectedUserId]);

  const fetchMuted = useCallback(async (peerId: string) => {
    try {
      const res = await fetch(`/api/messages/mute?peer_id=${encodeURIComponent(peerId)}`);
      if (res.ok) {
        const data = (await res.json()) as { muted?: boolean };
        setMuted(!!data.muted);
      }
    } catch {
      setMuted(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUserId) fetchMuted(selectedUserId);
    else setMuted(false);
  }, [selectedUserId, fetchMuted]);

  const sendMessage = async () => {
    const to = selectedUserId;
    if (!to || !content.trim()) {
      toast.error("Select a conversation and enter a message");
      return;
    }
    setSending(true);
    sendTypingPresence(false);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: to,
          content: content.trim(),
          invoice_id: invoiceRef?.id ?? null,
          parent_message_id: replyTo?.id ?? null,
          attachment_path: attachment?.path ?? null,
          attachment_name: attachment?.name ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setContent("");
        setInvoiceRef(null);
        setReplyTo(null);
        setAttachment(null);
        fetchConversation(to);
        fetchAllMessages(messageSearch);
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const toggleMute = async () => {
    if (!selectedUserId) return;
    try {
      const method = muted ? "DELETE" : "POST";
      const res = await fetch(`/api/messages/mute?peer_id=${encodeURIComponent(selectedUserId)}`, { method });
      if (res.ok) {
        setMuted(!muted);
        toast.success(muted ? "Conversation unmuted" : "Conversation muted");
      }
    } catch {
      toast.error("Failed to update mute");
    }
  };

  const startNewChat = () => {
    setSelectedUserId(null);
    setMessages([]);
  };

  const selectConversation = (userId: string) => {
    setSelectedUserId(userId);
  };

  const startChatWith = (userId: string) => {
    setSelectedUserId(userId);
    setConversations((prev) => {
      const exists = prev.some((c) => c.userId === userId);
      if (exists) return prev;
      const r = recipients.find((x) => x.id === userId);
      return [{ userId, name: r?.full_name ?? userId, lastMessage: "", lastAt: new Date().toISOString(), unread: 0 }, ...prev];
    });
  };

  const otherName = selectedUserId
    ? conversations.find((c) => c.userId === selectedUserId)?.name ??
      recipients.find((r) => r.id === selectedUserId)?.full_name ??
      selectedUserId
    : null;

  const sortedThread = selectedUserId
    ? [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    : [];

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Left: conversation list - hidden on mobile when chat is open */}
      <div
        className={`flex w-72 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 ${
          selectedUserId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h1>
          <div className="flex gap-2">
            <button
              onClick={startNewChat}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              New chat
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Dashboard
            </Link>
          </div>
        </div>
        <div className="border-b border-gray-200 px-3 pb-2 dark:border-gray-700">
          <input
            type="text"
            placeholder="Search messages..."
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
          ) : conversations.length === 0 && !selectedUserId ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No conversations yet. Start a new chat or select a recipient below.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {conversations.map((c) => (
                <button
                  key={c.userId}
                  onClick={() => selectConversation(c.userId)}
                  className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    selectedUserId === c.userId ? "bg-sky-50 dark:bg-sky-950/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium text-gray-900 dark:text-white">{c.name}</span>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        {c.unread}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs text-gray-500 dark:text-gray-400">{c.lastMessage || "No messages"}</span>
                </button>
              ))}
            </div>
          )}
          {recipients.length > 0 && (
            <div className="border-t border-gray-200 p-2 dark:border-gray-700">
              <button
                onClick={() => setShowRecipientPicker((v) => !v)}
                className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {showRecipientPicker ? "− Hide" : "+"} Select person to chat with
              </button>
              {showRecipientPicker && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    {recipients
                      .filter((r) => {
                        const q = recipientSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (r.full_name ?? "").toLowerCase().includes(q) ||
                          (r.role ?? "").toLowerCase().includes(q);
                      })
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            startChatWith(r.id);
                            setShowRecipientPicker(false);
                            setRecipientSearch("");
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <span className="font-medium text-gray-900 dark:text-white">{r.full_name}</span>
                          {r.role && <span className="text-xs text-gray-500">({r.role})</span>}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: chat area - full width on mobile when open */}
      <div className={`flex flex-1 flex-col min-w-0 ${!selectedUserId ? "hidden md:flex" : "flex"}`}>
        {selectedUserId ? (
          <>
            <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <button
                onClick={() => setSelectedUserId(null)}
                className="md:hidden rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label="Back to conversations"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="flex-1 font-medium text-gray-900 dark:text-white">{otherName}</h2>
              <button
                onClick={toggleMute}
                title={muted ? "Unmute" : "Mute"}
                className={`rounded-lg p-1.5 text-sm ${muted ? "text-amber-600 dark:text-amber-400" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
            {typingPeer && (
              <p className="border-b border-gray-100 px-4 py-1 text-xs italic text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {otherName} is typing…
              </p>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sortedThread.map((msg) => {
                if (msg.recipient_id !== selectedUserId && msg.sender_id !== selectedUserId) return null;
                const isMe = msg.is_from_me;
                const parentMsg = msg.parent_message_id
                  ? sortedThread.find((m) => m.id === msg.parent_message_id)
                  : null;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        isMe
                          ? "bg-sky-600 text-white"
                          : "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                      }`}
                    >
                      {msg.invoice_id && (
                        <Link
                          href={invoiceListUrl(msg.invoice_id, msg.invoice_type ?? null)}
                          className="mb-1 block text-xs font-medium underline opacity-90"
                        >
                          Re: Invoice {msg.invoice_display ?? msg.invoice_id.slice(0, 8)}
                        </Link>
                      )}
                      {parentMsg && (
                        <p className="mb-1 border-l-2 border-current/40 pl-2 text-xs opacity-80">
                          {parentMsg.sender_name}: {parentMsg.content.slice(0, 60)}
                          {parentMsg.content.length > 60 ? "…" : ""}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">
                        {parseMentions(msg.content).map((seg, i) =>
                          seg.type === "mention" ? (
                            <span key={i} className="rounded bg-black/20 px-0.5 font-medium">
                              @{seg.text}
                            </span>
                          ) : (
                            <span key={i}>{seg.text}</span>
                          )
                        )}
                      </p>
                      {msg.attachment_path && msg.attachment_name && (
                        <a
                          href="#"
                          onClick={async (e) => {
                            e.preventDefault();
                            const r = await fetch(`/api/messages/attachment-url?path=${encodeURIComponent(msg.attachment_path!)}`);
                            const d = await r.json();
                            if (d?.url) window.open(d.url);
                          }}
                          className="mt-1 block text-xs font-medium underline opacity-90"
                        >
                          📎 {msg.attachment_name}
                        </a>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          onClick={() => setReplyTo({ id: msg.id, content: msg.content.slice(0, 80) })}
                          className="text-[10px] opacity-70 hover:opacity-100"
                        >
                          Reply
                        </button>
                        <p className={`text-[10px] ${isMe ? "text-sky-100" : "text-gray-500 dark:text-gray-400"}`}>
                          {new Date(msg.created_at).toLocaleString("en-GB", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {isMe && msg.read_at && (
                            <span className="ml-1.5 opacity-90">
                              · Read {new Date(msg.read_at).toLocaleString("en-GB", { timeStyle: "short" })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200 p-4 dark:border-gray-700">
              <div className="space-y-2">
                {replyTo && (
                  <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">Replying: {replyTo.content.slice(0, 50)}…</span>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {attachment && (
                  <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800">
                    <span className="text-gray-600 dark:text-gray-400">📎 {attachment.name}</span>
                    <button
                      onClick={() => setAttachment(null)}
                      className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {invoiceRef && (
                  <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm dark:bg-sky-950/30">
                    <span className="text-sky-700 dark:text-sky-300">
                      Re: Invoice {invoiceRef.invoice_number}
                    </span>
                    <Link
                      href={invoiceListUrl(invoiceRef.id, invoiceRef.invoice_type ?? null)}
                      className="text-sky-600 underline hover:text-sky-500 dark:text-sky-400"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => setInvoiceRef(null)}
                      className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {!invoiceRef && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search invoice to reference..."
                      value={invoiceSearchQuery}
                      onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    {invoiceSearch.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                        {invoiceSearch.map((inv) => (
                          <button
                            key={inv.id}
                            onClick={() => {
                              setInvoiceRef({ id: inv.id, invoice_number: inv.invoice_number, invoice_type: inv.invoice_type });
                              setInvoiceSearch([]);
                              setInvoiceSearchQuery("");
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            {inv.invoice_number} — {inv.beneficiary}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex cursor-pointer items-center rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        e.target.value = "";
                        try {
                          const fd = new FormData();
                          fd.append("file", f);
                          const res = await fetch("/api/messages/upload-attachment", { method: "POST", body: fd });
                          const data = (await res.json()) as { attachment_path?: string; attachment_name?: string };
                          if (res.ok && data.attachment_path) {
                            setAttachment({ path: data.attachment_path, name: data.attachment_name ?? f.name });
                          } else {
                            toast.error((data as { error?: string }).error ?? "Upload failed");
                          }
                        } catch {
                          toast.error("Upload failed");
                        }
                      }}
                    />
                    📎
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      sendTypingPresence(true);
                      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                      typingTimeoutRef.current = setTimeout(() => sendTypingPresence(false), 2000);
                    }}
                    placeholder="Type a message..."
                    rows={2}
                    className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={sending || !content.trim()}
                    className="self-end rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                  >
                    {sending ? "…" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Select a conversation or start a new chat
            </p>
            {invoiceIdFromUrl && (
              <p className="text-sm text-sky-600 dark:text-sky-400">
                You have an invoice reference. Start a chat to include it in your message.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
