"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  sender_name: string;
  recipient_name: string;
  is_from_me: boolean;
  is_to_me: boolean;
};

type Recipient = { id: string; full_name: string; role?: string };

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<"all" | "inbox" | "sent">("inbox");
  const [composing, setComposing] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?folder=${folder}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [folder]);

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

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (composing || replyTo) fetchRecipients();
  }, [composing, replyTo, fetchRecipients]);

  const sendMessage = async () => {
    const to = replyTo ? replyTo.sender_id : recipientId;
    if (!to || !content.trim()) {
      toast.error("Select a recipient and enter a message");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: to, content: content.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        toast.success("Message sent");
        setContent("");
        setReplyTo(null);
        setComposing(false);
        setRecipientId("");
        fetchMessages();
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
      fetchMessages();
    } catch {
      /* ignore */
    }
  };

  const openReply = (msg: Message) => {
    setReplyTo(msg);
    setContent("");
    if (msg.is_to_me) markAsRead(msg.id);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setComposing(true)}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            New message
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Send messages to colleagues. They appear in notifications when unread.
      </p>

      {/* Folder tabs */}
      <div className="flex gap-2">
        {(["inbox", "sent", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFolder(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              folder === f
                ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {f === "inbox" ? "Inbox" : f === "sent" ? "Sent" : "All"}
          </button>
        ))}
      </div>

      {/* Compose / Reply modal */}
      {(composing || replyTo) && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
            {replyTo ? `Reply to ${replyTo.sender_name}` : "New message"}
          </h3>
          {!replyTo && (
            <div className="mb-3">
              <label className="mb-1 block text-xs text-gray-500">To</label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select recipient</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name} {r.role ? `(${r.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-500">Message</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !content.trim()}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
            <button
              onClick={() => {
                setReplyTo(null);
                setComposing(false);
                setContent("");
                setRecipientId("");
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No messages. {folder === "inbox" ? "Inbox is empty." : folder === "sent" ? "You haven't sent any messages." : "No messages yet."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  msg.is_to_me && !msg.read_at ? "bg-sky-50/50 dark:bg-sky-950/20" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {msg.is_from_me ? "To: " : "From: "}
                        {msg.is_from_me ? msg.recipient_name : msg.sender_name}
                      </span>
                      {msg.is_to_me && !msg.read_at && (
                        <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">{msg.content}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(msg.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  {msg.is_to_me && (
                    <button
                      onClick={() => openReply(msg)}
                      className="shrink-0 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-200 dark:hover:bg-sky-800/50"
                    >
                      Reply
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
