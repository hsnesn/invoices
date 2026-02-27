/**
 * Restore guest contacts from a backup.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = (await request.json()) as { backup_id?: string };
    const backupId = body?.backup_id;
    if (!backupId || typeof backupId !== "string") {
      return NextResponse.json({ error: "backup_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: backup, error: fetchError } = await supabase
      .from("guest_contacts_backup")
      .select("snapshot")
      .eq("id", backupId)
      .single();

    if (fetchError || !backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    const snapshot = backup.snapshot as Record<string, unknown>[];
    if (!Array.isArray(snapshot) || snapshot.length === 0) {
      return NextResponse.json({ message: "Backup is empty", restored: 0 });
    }

    // Replace current list: delete all, then insert from backup
    const { data: existing } = await supabase.from("guest_contacts").select("id");
    const ids = (existing ?? []).map((r) => (r as { id: string }).id);
    if (ids.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const { error: deleteError } = await supabase.from("guest_contacts").delete().in("id", batch);
        if (deleteError) {
          return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }
      }
    }

    const rows = snapshot.map((r) => ({
      guest_name: r.guest_name ?? "",
      phone: r.phone ?? null,
      email: r.email ?? null,
      title: r.title ?? null,
      title_category: r.title_category ?? null,
      topic: r.topic ?? null,
      topic_category: r.topic_category ?? null,
      organization: r.organization ?? null,
      bio: r.bio ?? null,
      photo_url: r.photo_url ?? null,
      primary_program: r.primary_program ?? null,
      ai_contact_info: r.ai_contact_info ?? null,
      ai_searched_at: r.ai_searched_at ?? null,
      ai_assessment: r.ai_assessment ?? null,
      ai_assessed_at: r.ai_assessed_at ?? null,
      is_favorite: r.is_favorite ?? false,
      tags: Array.isArray(r.tags) ? r.tags : [],
      affiliated_orgs: Array.isArray(r.affiliated_orgs) ? r.affiliated_orgs : [],
      prohibited_topics: Array.isArray(r.prohibited_topics) ? r.prohibited_topics : [],
      conflict_of_interest_notes: r.conflict_of_interest_notes ?? null,
      source: r.source ?? "restore",
    }));

    const { error: insertError } = await supabase.from("guest_contacts").insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Restored ${rows.length} contacts.`,
      restored: rows.length,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
