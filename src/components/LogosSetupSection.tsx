"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const LOGO_OPTIONS = [
  { key: "logo_trt", label: "TRT Logo", desc: "Nav, Dashboard, Upload overlay, LogoLoader" },
  { key: "logo_trt_world", label: "TRT World Logo", desc: "Booking Form PDFs" },
  { key: "logo_email", label: "Email Logo", desc: "Emails (invoice notifications, etc.)" },
] as const;

export function LogosSetupSection() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploadFilenames, setUploadFilenames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [previewStamp, setPreviewStamp] = useState(() => Date.now());

  const fetchLogos = () => {
    fetch(`/api/admin/app-settings?_=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const v: Record<string, string> = {};
        for (const opt of LOGO_OPTIONS) {
          const raw = d[opt.key];
          v[opt.key] = typeof raw === "string" ? raw : raw?.value ?? "";
        }
        setValues(v);
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load." }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogos();
  }, []);

  const savePath = async (key: string) => {
    const val = values[key]?.trim();
    if (!val) {
      setMessage({ type: "error", text: "Enter a filename (e.g. trt-logo.png) or full URL." });
      return;
    }
    setSaving(key);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/logos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: val }),
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewStamp(Date.now());
        setMessage({ type: "success", text: "Saved and applied." });
        window.dispatchEvent(new CustomEvent("logos-updated"));
        router.refresh();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save." });
      }
    } catch {
      setMessage({ type: "error", text: "Connection error." });
    } finally {
      setSaving(null);
    }
  };

  const handleUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(key);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("key", key);
      formData.set("file", file);
      const customName = uploadFilenames[key]?.trim();
      if (customName) formData.set("filename", customName);

      const res = await fetch("/api/admin/logos/upload", { method: "POST", body: formData });

      let data: { ok?: boolean; value?: string; error?: string };
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { error: `Server returned ${res.status}. Please refresh the page and try again.` };
      }

      if (res.ok && data.ok) {
        setValues((prev) => ({ ...prev, [key]: data.value ?? prev[key] }));
        setPreviewStamp(Date.now());

        // Verify the database actually saved the new URL
        let verifyMsg = "";
        try {
          const checkRes = await fetch(`/api/settings/logos?_=${Date.now()}`, { cache: "no-store" });
          const checkData = await checkRes.json();
          const savedUrl = checkData?.[key] || "(empty)";
          verifyMsg = ` | DB check: ${savedUrl}`;
        } catch {
          verifyMsg = " | DB check failed";
        }

        setMessage({ type: "success", text: `Upload OK. New URL: ${data.value}${verifyMsg}` });
        window.dispatchEvent(new CustomEvent("logos-updated"));
      } else {
        setMessage({ type: "error", text: data.error || `Upload failed (HTTP ${res.status}). Please refresh and try again.` });
      }
    } catch (err) {
      setMessage({ type: "error", text: `Upload error: ${(err as Error).message}. Please refresh the page.` });
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading logos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 border-l-4 border-l-rose-500 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900/80">
        <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          Logos
        </h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Different logos for different scenarios. Upload with a custom name (e.g. trt-logo.png) or enter a path/URL below. Changes apply immediately.
        </p>

        {message && (
          <div
            className={`mb-4 rounded-lg border p-3 text-xs break-all select-all ${
              message.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          {LOGO_OPTIONS.map(({ key, label, desc }) => (
            <div key={key} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex h-12 w-24 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 overflow-hidden shrink-0">
                  <img
                    src={(() => {
                      const v = values[key] || "";
                      const base = v.startsWith("http") ? v : `/${v.replace(/^\//, "")}`;
                      const sep = base.includes("?") ? "&" : "?";
                      return `${base}${sep}_p=${previewStamp}`;
                    })()}
                    alt={label}
                    className="max-h-10 max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={values[key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="trt-logo.png or https://..."
                  className="flex-1 min-w-[140px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <div className="flex gap-2 flex-wrap items-center">
                  <input
                    type="text"
                    value={uploadFilenames[key] ?? ""}
                    onChange={(e) => setUploadFilenames((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="Save as (e.g. trt-logo.png)"
                    className="w-36 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <label className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                    {uploading === key ? "Uploading..." : "Upload"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => handleUpload(key, e)}
                      disabled={!!uploading}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => savePath(key)}
                    disabled={saving === key || !values[key]?.trim()}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                  >
                    {saving === key ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
