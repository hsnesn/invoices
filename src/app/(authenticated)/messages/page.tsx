"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  invoice_id: string | null;
  invoice_display: string | null;
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

function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* ignore */
  }
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const invoiceIdFromUrl = searchParams.get("invoiceId");

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState<{ id: string; invoice_number: string; beneficiary: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState<{ id: string; invoice_number: string } | null>(
    invoiceIdFromUrl ? { id: invoiceIdFromUrl, invoice_number: "…" } : null
  );
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const lastUnreadCountRef = useRef(-1);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAllMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages?folder=all");
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

        const unreadToMe = list.filter((m) => m.is_to_me && !m.read_at).length;
        if (lastUnreadCountRef.current >= 0 && unreadToMe > lastUnreadCountRef.current) {
          playNotificationSound();
        }
        lastUnreadCountRef.current = unreadToMe;
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

  useEffect(() => {
    fetchAllMessages();
    fetchRecipients();
  }, [fetchAllMessages, fetchRecipients]);

  useEffect(() => {
    if (invoiceIdFromUrl) {
      fetch(`/api/invoices/search?id=${encodeURIComponent(invoiceIdFromUrl)}`)
        .then((r) => r.json())
        .then((data) => {
          const inv = Array.isArray(data) && data[0] ? data[0] : null;
          setInvoiceRef(
            inv
              ? { id: inv.id, invoice_number: inv.invoice_number }
              : { id: invoiceIdFromUrl, invoice_number: "…" }
          );
        })
        .catch(() => setInvoiceRef({ id: invoiceIdFromUrl, invoice_number: "…" }));
    }
  }, [invoiceIdFromUrl]);

  useEffect(() => {
    if (selectedUserId) {
      fetchConversation(selectedUserId);
    } else {
      fetchAllMessages();
    }
  }, [selectedUserId, fetchConversation, fetchAllMessages]);

  useEffect(() => {
    const t = setTimeout(() => fetchInvoiceSearch(invoiceSearchQuery), 300);
    return () => clearTimeout(t);
  }, [invoiceSearchQuery, fetchInvoiceSearch]);

  useEffect(() => {
    pollIntervalRef.current = setInterval(fetchAllMessages, 15000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchAllMessages]);

  const sendMessage = async () => {
    const to = selectedUserId;
    if (!to || !content.trim()) {
      toast.error("Select a conversation and enter a message");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_id: to,
          content: content.trim(),
          invoice_id: invoiceRef?.id ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setContent("");
        setInvoiceRef(null);
        fetchConversation(to);
        fetchAllMessages();
      } else {
        toast.error(data.error ?? "Failed to send");
      }
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/messages/${id}/read`, { method: "PATCH" });
      fetchAllMessages();
      if (selectedUserId) fetchConversation(selectedUserId);
    } catch {
      /* ignore */
    }
  };

  const startNewChat = () => {
    setSelectedUserId(null);
    setMessages([]);
  };

  const selectConversation = (userId: string) => {
    setSelectedUserId(userId);
    const conv = conversations.find((c) => c.userId === userId);
    if (conv?.unread) {
      const toMark = messages.filter((m) => m.recipient_id === userId && m.is_to_me && !m.read_at);
      toMark.forEach((m) => markAsRead(m.id));
    }
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
      {/* Left: conversation list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700">
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
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Start chat with</p>
              <div className="flex flex-wrap gap-1">
                {recipients
                  .filter((r) => !conversations.some((c) => c.userId === r.id))
                  .slice(0, 8)
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => startChatWith(r.id)}
                      className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      {r.full_name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {selectedUserId ? (
          <>
            <div className="flex items-center border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h2 className="font-medium text-gray-900 dark:text-white">{otherName}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sortedThread.map((msg) => {
                if (msg.recipient_id !== selectedUserId && msg.sender_id !== selectedUserId) return null;
                const isMe = msg.is_from_me;
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
                        <a
                          href={`/invoices/${msg.invoice_id}`}
                          className="mb-1 block text-xs font-medium underline opacity-90"
                        >
                          Re: Invoice {msg.invoice_display ?? msg.invoice_id.slice(0, 8)}
                        </a>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`mt-1 text-[10px] ${isMe ? "text-sky-100" : "text-gray-500 dark:text-gray-400"}`}>
                        {new Date(msg.created_at).toLocaleString("en-GB", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200 p-4 dark:border-gray-700">
              <div className="space-y-2">
                {invoiceRef && (
                  <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm dark:bg-sky-950/30">
                    <span className="text-sky-700 dark:text-sky-300">
                      Re: Invoice {invoiceRef.invoice_number}
                    </span>
                    <a
                      href={`/invoices/${invoiceRef.id}`}
                      className="text-sky-600 underline hover:text-sky-500 dark:text-sky-400"
                    >
                      View
                    </a>
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
                              setInvoiceRef({ id: inv.id, invoice_number: inv.invoice_number });
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
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
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
