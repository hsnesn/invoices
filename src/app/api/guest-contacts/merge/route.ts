import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_contacts"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Only admin can merge contacts" }, { status: 403 });
    }

    const body = await request.json();
    const primary = typeof body?.primary === "string" ? body.primary.trim() : null;
    const mergeFrom = Array.isArray(body?.merge_from)
      ? (body.merge_from as unknown[]).filter((n): n is string => typeof n === "string").map((n) => n.trim()).filter(Boolean)
      : [];

    if (!primary || mergeFrom.length === 0) {
      return NextResponse.json({ error: "primary and merge_from (array) required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const primaryKey = primary.toLowerCase().trim();
    const mergeKeys = mergeFrom.map((n) => n.toLowerCase().trim());

    const { data: primaryRow } = await supabase
      .from("guest_contacts")
      .select("id, guest_name, phone, email, title, ai_contact_info, ai_assessment, is_favorite, tags")
      .eq("guest_name_key", primaryKey)
      .maybeSingle();

    const merged: {
      phone: string | null;
      email: string | null;
      title: string | null;
      ai_contact_info: Record<string, unknown> | null;
      ai_assessment: string | null;
      is_favorite: boolean;
      tags: string[];
    } = primaryRow
      ? {
          phone: (primaryRow.phone as string) || null,
          email: (primaryRow.email as string) || null,
          title: (primaryRow.title as string) || null,
          ai_contact_info: (primaryRow.ai_contact_info as Record<string, unknown>) ?? null,
          ai_assessment: (primaryRow.ai_assessment as string) ?? null,
          is_favorite: !!(primaryRow.is_favorite as boolean),
          tags: Array.isArray(primaryRow.tags) ? [...(primaryRow.tags as string[])] : [],
        }
      : {
          phone: null,
          email: null,
          title: null,
          ai_contact_info: null,
          ai_assessment: null,
          is_favorite: false,
          tags: [],
        };

    for (const key of mergeKeys) {
      if (key === primaryKey) continue;
      const { data: row } = await supabase
        .from("guest_contacts")
        .select("id, phone, email, title, ai_contact_info, ai_assessment, is_favorite, tags")
        .eq("guest_name_key", key)
        .maybeSingle();

      if (!row?.id) continue;

      if (row.phone && !merged.phone) merged.phone = row.phone as string;
      if (row.email && !merged.email) merged.email = row.email as string;
      if (row.title && !merged.title) merged.title = row.title as string;
      if (row.is_favorite) merged.is_favorite = true;
      if (Array.isArray(row.tags)) {
        for (const t of row.tags as string[]) {
          if (t && !merged.tags.includes(t)) merged.tags.push(t);
        }
      }
      const ai = row.ai_contact_info as { phone?: string; email?: string; social_media?: string[] } | null;
      if (ai) {
        const current = (merged.ai_contact_info ?? {}) as { phone?: string; email?: string; social_media?: string[] };
        if (ai.phone && !current.phone) current.phone = ai.phone;
        if (ai.email && !current.email) current.email = ai.email;
        if (Array.isArray(ai.social_media)) {
          current.social_media = Array.from(new Set([...(current.social_media ?? []), ...ai.social_media]));
        }
        merged.ai_contact_info = Object.keys(current).length ? current : null;
      }
      if (row.ai_assessment && !merged.ai_assessment) merged.ai_assessment = row.ai_assessment as string;

      await supabase.from("guest_contacts").delete().eq("id", row.id);
    }

    if (primaryRow?.id) {
      await supabase
        .from("guest_contacts")
        .update({
          phone: merged.phone,
          email: merged.email,
          title: merged.title,
          ai_contact_info: merged.ai_contact_info,
          ai_assessment: merged.ai_assessment,
          is_favorite: merged.is_favorite,
          tags: merged.tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", primaryRow.id);
    } else {
      await supabase.from("guest_contacts").insert({
        guest_name: primary,
        phone: merged.phone,
        email: merged.email,
        title: merged.title,
        ai_contact_info: merged.ai_contact_info,
        ai_assessment: merged.ai_assessment,
        is_favorite: merged.is_favorite,
        tags: merged.tags,
        source: "merge",
      });
    }

    return NextResponse.json({
      message: `Merged ${mergeFrom.length} contact(s) into "${primary}".`,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
