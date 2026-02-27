/**
 * Delete all guest contacts and save a backup for restore.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function POST() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const supabase = createAdminClient();

    const { data: rows } = await supabase
      .from("guest_contacts")
      .select("guest_name, phone, email, title, title_category, topic, topic_category, organization, bio, photo_url, primary_program, ai_contact_info, ai_searched_at, ai_assessment, ai_assessed_at, is_favorite, tags, affiliated_orgs, prohibited_topics, conflict_of_interest_notes, source");

    const snapshot = (rows ?? []).map((r) => {
      const { ...rest } = r as Record<string, unknown>;
      return rest;
    });

    const { error: backupError } = await supabase.from("guest_contacts_backup").insert({
      contact_count: snapshot.length,
      snapshot,
    });

    if (backupError) {
      return NextResponse.json({ error: backupError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabase.from("guest_contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `List cleared. ${snapshot.length} contacts backed up. You can restore from backups.`,
      backed_up: snapshot.length,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
