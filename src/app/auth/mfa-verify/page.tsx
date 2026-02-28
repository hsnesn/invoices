"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MfaVerifyPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const sendCode = async () => {
    setSending(true);
    setMessage(null);
    const res = await fetch("/api/auth/mfa/send-otp", { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setCodeSent(true);
      setMessage({ type: "success", text: "Code sent. Check your email." });
    } else if (res.status === 429) {
      setMessage({ type: "error", text: data?.error ?? "Please wait before requesting a new code" });
    } else if (data?.error?.includes("not required")) {
      router.replace("/dashboard");
    } else {
      setMessage({ type: "error", text: data?.error ?? "Failed to send code" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setMessage({ type: "error", text: data?.error ?? "Invalid code" });
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-700 bg-slate-900/50 p-8 shadow-xl">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">
              Verification Required
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Loading...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-700 bg-slate-900/50 p-8 shadow-xl">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Verification Required
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {codeSent ? "Enter the 6-digit code sent to your email." : "Click below to receive a verification code by email."}
          </p>
        </div>

        {!codeSent ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={sendCode}
              disabled={sending}
              className="w-full rounded-lg bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send verification code"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-slate-300">
                Verification code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                required
                className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-center text-xl tracking-[0.5em] text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={sending}
              className="w-full rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              Resend code
            </button>
          </form>
        )}

        {message && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              message.type === "success"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/50 bg-red-500/10 text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
