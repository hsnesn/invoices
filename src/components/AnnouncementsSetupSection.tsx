"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

type Announcement = { id: string; message: string; is_active: boolean; created_at: string };

export function AnnouncementsSetupSection() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const res = await fetch("/api/announcements?active=false");
    if (res.ok) setAnnouncements(await res.json());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAnnouncements().finally(() => setLoading(false));
  }, [fetchAnnouncements]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMsg.trim(), is_active: true }),
      });
      if (res.ok) {
        toast.success("Announcement added");
        setNewMsg("");
        fetchAnnouncements();
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? "Announcement hidden" : "Announcement shown");
        fetchAnnouncements();
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        fetchAnnouncements();
      }
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 border-l-4 border-l-amber-500 bg-white p-6 dark:border-gray-700 dark:bg-gray-900/80">
      <h2 className="mb-1 font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        Announcements
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Show a banner to all users after login. Users can dismiss for the session.
      </p>

      <form onSubmit={handleAdd} className="mb-6 flex gap-2">
        <input
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Enter announcement message..."
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <button type="submit" disabled={saving} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50">
          {saving ? "Adding..." : "Add"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-gray-500">No announcements. Add one to show a banner to all users.</p>
      ) : (
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
              <span className="flex-1 text-sm text-gray-900 dark:text-white">{a.message}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(a.id, a.is_active)}
                  className={`rounded px-2 py-1 text-xs font-medium ${a.is_active ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}`}
                >
                  {a.is_active ? "Visible" : "Hidden"}
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 text-xs">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
