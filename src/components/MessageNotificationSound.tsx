"use client";

import { useEffect, useRef } from "react";

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
 * Polls for unread messages. When count increases: plays sound and shows browser notification.
 * Runs on all authenticated pages (in Nav).
 */
export function MessageNotificationSound() {
  const lastUnreadRef = useRef(-1);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/messages/unread?list=true", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number; messages?: { sender_name: string; content: string }[] };
        const unread = data.unread ?? 0;
        const prev = lastUnreadRef.current;
        lastUnreadRef.current = unread;

        if (prev >= 0 && unread > prev) {
          playNotificationSound();
          const msg = data.messages?.[0];
          const title = msg?.sender_name ?? "New message";
          const body = msg?.content?.slice(0, 60) ?? "You have a new message";
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            new Notification("Clari: " + title, { body, tag: "clari-msg", requireInteraction: false });
          }
        }
      } catch {
        /* ignore */
      }
    };

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    void poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
