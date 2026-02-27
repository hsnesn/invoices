"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

function playNotificationSound() {
  try {
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.6;
    void audio.play().catch(() => {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
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
        }
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }
}

/**
 * Real-time + fallback poll for new messages. Plays sound, shows toast (when visible) or browser notification (when hidden).
 */
export function MessageNotificationSound() {
  const router = useRouter();
  const lastUnreadRef = useRef(-1);

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    const goToMessages = (senderId: string) => {
      router.push(`/messages?recipientId=${encodeURIComponent(senderId)}`);
    };

    const onNewMessage = (senderName: string, content: string, senderId: string) => {
      playNotificationSound();
      const title = senderName ? `${senderName} sent you a message` : "New message";
      const body = content?.slice(0, 60) || "Click to open";
      if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification("Clari: " + title, { body, tag: "clari-msg", requireInteraction: false });
        n.onclick = () => {
          window.focus();
          goToMessages(senderId);
        };
      } else {
        toast.info(title, {
          description: body,
          duration: 5000,
          action: { label: "Open", onClick: () => goToMessages(senderId) },
        });
      }
    };

    let disposed = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId || disposed) return;

        channel = supabase
          .channel("msg-notify")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            async (payload) => {
              if (disposed) return;
              const row = payload.new as { recipient_id?: string; sender_id?: string; content?: string };
              if (row?.recipient_id !== userId) return;
              const senderId = row.sender_id ?? "";
              const content = row.content ?? "";
              const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", senderId).single();
              const senderName = (prof as { full_name?: string } | null)?.full_name ?? "Someone";
              onNewMessage(senderName, content, senderId);
            }
          )
          .subscribe();
      } catch {
        /* realtime not critical */
      }
    })();

    const poll = async () => {
      try {
        const res = await fetch("/api/messages/unread?list=true", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number; messages?: { sender_name: string; sender_id: string; content: string }[] };
        const unread = data.unread ?? 0;
        const prev = lastUnreadRef.current;
        lastUnreadRef.current = unread;
        if (prev >= 0 && unread > prev) {
          const msg = data.messages?.[0];
          onNewMessage(msg?.sender_name ?? "Someone", msg?.content ?? "", msg?.sender_id ?? "");
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const interval = setInterval(poll, 10000);

    return () => {
      disposed = true;
      channel?.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return null;
}
