"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data?.error ?? "Login failed" });
        return;
      }
      await new Promise((r) => setTimeout(r, 150));
      window.location.assign("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed. Please try again.";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setMessage({ type: "error", text: "Enter your email first." });
      return;
    }

    setResetLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setMessage({
      type: "success",
      text: "Password reset link sent. Check your email.",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm space-y-8 rounded-xl border border-slate-700 bg-slate-900/50 p-8 shadow-xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Invoice Approval Workflow
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Invite-only access
          </p>
        </div>

        {errorParam === "deactivated" && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
            Your account has been deactivated. Contact an administrator.
          </div>
        )}
        {(errorParam || errorDescription) && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
            {errorParam && errorParam !== "deactivated"
              ? decodeURIComponent(errorParam.replace(/\+/g, " "))
              : errorDescription
                ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
                : null}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Login"}
          </button>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetLoading}
            className="w-full rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {resetLoading ? "Sending reset..." : "Forgot password?"}
          </button>
        </form>

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
