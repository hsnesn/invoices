"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AcceptInvitePage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setMessage({ type: "success", text: "Welcome! Redirecting to your dashboard..." });
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-blue-500/25">
            <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Welcome!</h1>
          <p className="mt-2 text-sm text-slate-400">
            Set your password to complete your account setup
          </p>
          {userEmail && (
            <p className="mt-1 text-sm font-medium text-sky-400">{userEmail}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              New Password
            </label>
            <input
              id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
              Confirm Password
            </label>
            <input
              id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              placeholder="Re-enter your password"
            />
          </div>
          {password.length > 0 && (
            <div className="flex items-center gap-2">
              <div className={`h-1.5 flex-1 rounded-full ${password.length >= 8 ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className={`text-xs ${password.length >= 8 ? "text-emerald-400" : "text-red-400"}`}>
                {password.length >= 8 ? "Strong enough" : `${8 - password.length} more chars needed`}
              </span>
            </div>
          )}
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors shadow-sm shadow-sky-500/20">
            {loading ? "Setting up..." : "Set Password & Get Started"}
          </button>
        </form>

        {message && (
          <div className={`rounded-lg border p-3 text-sm ${message.type === "success" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-red-500/50 bg-red-500/10 text-red-200"}`}>
            {message.type === "success" && <span className="mr-1.5">✓</span>}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
