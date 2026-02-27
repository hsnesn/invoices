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
 * Polls for unread messages and plays notification sound when count increases.
 * Runs on all authenticated pages (in Nav) so sound plays even when Messages page is closed.
 */
export function MessageNotificationSound() {
  const lastUnreadRef = useRef(-1);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/dashboard/my-tasks", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { messagesUnread?: number };
        const unread = data.messagesUnread ?? 0;
        if (lastUnreadRef.current >= 0 && unread > lastUnreadRef.current) {
          playNotificationSound();
        }
        lastUnreadRef.current = unread;
      } catch {
        /* ignore */
      }
    };

    void poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
