"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  links?: { label: string; url: string }[];
};

function FormattedChatText({ text }: { text: string }) {
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
      parts.push(<strong key={key++} className="font-semibold">{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("*") && raw.endsWith("*")) {
      parts.push(<em key={key++} className="italic">{raw.slice(1, -1)}</em>);
    } else {
      parts.push(<span key={key++}>{raw}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return <>{parts}</>;
}

export function RequestChatPanel() {
  const searchParams = useSearchParams();
  const dept = searchParams.get("dept") || "";
  const month = searchParams.get("month") || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const chatHistory = [...messages, { role: "user" as const, content: text }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/contractor-availability/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          department_id: dept || undefined,
        }),
      });

      let data: { content?: string; links?: { label: string; url: string }[]; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { error: res.status === 503 ? "Service unavailable. Check OPENAI_API_KEY." : `Request failed (${res.status}).` };
      }

      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.content ?? "No response.",
            links: Array.isArray(data.links) ? data.links : [],
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${data.error ?? "Request failed."}` },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection error. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900/40 min-h-[480px]">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Schedule chat</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Ask questions or create requirements (e.g. &quot;I need 4 outputs every day in March&quot;). Select department in Requirements tab first for create.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[320px]">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/30">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ask questions or create requirements:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-500">
              <li>• I need 4 outputs every day in March</li>
              <li>• Who is scheduled for next week?</li>
              <li>• Who worked on March 15?</li>
              <li>• What are the requirements for April?</li>
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl p-4 ${
              m.role === "user"
                ? "ml-8 bg-violet-50 dark:bg-violet-900/20 border-l-4 border-violet-500"
                : "mr-8 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400 dark:border-gray-500"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              {m.role === "user" ? "You" : "Assistant"}
            </p>
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              <FormattedChatText text={m.content} />
            </div>
            {m.role === "assistant" && m.links && m.links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {m.links.map((link, j) => (
                  <Link
                    key={j}
                    href={link.url}
                    className="inline-flex items-center rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="rounded-xl p-4 mr-8 bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400 animate-pulse">
            <p className="text-xs text-gray-500">Thinking…</p>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about schedules, assignments, requirements..."
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800/80 dark:text-white dark:placeholder-gray-500"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        {(dept || month) && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Using department and month from URL when relevant.
          </p>
        )}
      </div>
    </div>
  );
}
