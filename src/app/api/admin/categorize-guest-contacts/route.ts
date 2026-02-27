import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { categorizeTitles, categorizeTopics } from "@/lib/categorize-title-topic";

export const maxDuration = 120;

function parseServiceDesc(desc: string | null | undefined): Record<string, string> {
  if (!desc?.trim()) return {};
  const out: Record<string, string> = {};
  for (const line of desc.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const idx = l.indexOf(":");
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim().toLowerCase().replace(/\s+/g, " ");
    const val = l.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function fromMeta(meta: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) {
    const v = meta[k];
    if (v?.trim()) return v.trim();
  }
  return null;
}

/** POST /api/admin/categorize-guest-contacts - AI categorize all titles/topics and assign to contacts */
export async function POST() {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const supabase = createAdminClient();

    // 1. Collect all titles and topics from invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, service_description, generated_invoice_data")
      .neq("invoice_type", "freelancer")
      .neq("invoice_type", "guest_contact_scan");

    const allTitles = new Set<string>();
    const allTopics = new Set<string>();
    const guestTitleTopic: Map<string, { title: string | null; topic: string | null }> = new Map();

    for (const inv of invoices ?? []) {
      const meta = parseServiceDesc(inv.service_description);
      const gen = inv.generated_invoice_data as {
        guest_name?: string | null;
        title?: string | null;
      } | null;
      const extRaw = (inv as { invoice_extracted_fields?: { raw_json?: Record<string, unknown> }[] | { raw_json?: Record<string, unknown> } | null })
        .invoice_extracted_fields;
      const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw;
      const raw = ext?.raw_json ?? {};

      const guestName =
        gen?.guest_name?.trim() ||
        fromMeta(meta, ["guest name", "guest", "guest_name"]) ||
        (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name.trim() : null) ||
        null;
      if (!guestName) continue;

      const title =
        gen?.title?.trim() ||
        fromMeta(meta, ["title", "programme title", "program title"]) ||
        null;
      const topic = fromMeta(meta, ["topic", "description", "service description"]) || null;

      if (title?.trim()) {
        allTitles.add(title.trim());
      }
      if (topic?.trim()) {
        allTopics.add(topic.trim());
      }

      const key = guestName.toLowerCase().trim();
      const existing = guestTitleTopic.get(key);
      if (!existing || (topic && !existing.topic) || (title && !existing.title)) {
        guestTitleTopic.set(key, {
          title: title?.trim() || existing?.title || null,
          topic: topic?.trim() || existing?.topic || null,
        });
      }
    }

    // 2. Add titles from guest_contacts
    const { data: contacts } = await supabase
      .from("guest_contacts")
      .select("guest_name, title");
    for (const c of contacts ?? []) {
      const t = (c.title as string)?.trim();
      if (t) allTitles.add(t);
      const key = (c.guest_name as string).toLowerCase().trim();
      if (!guestTitleTopic.has(key)) {
        guestTitleTopic.set(key, { title: t || null, topic: null });
      } else {
        const ex = guestTitleTopic.get(key)!;
        if (t && !ex.title) ex.title = t;
      }
    }

    const titleList = Array.from(allTitles);
    const topicList = Array.from(allTopics);

    // 3. AI categorize in batches (max 30 per batch)
    const BATCH = 30;
    const titleMap = new Map<string, string>();
    const topicMap = new Map<string, string>();

    for (let i = 0; i < titleList.length; i += BATCH) {
      const batch = titleList.slice(i, i + BATCH);
      const result = await categorizeTitles(batch);
      for (const [raw, cat] of Array.from(result.entries())) titleMap.set(raw, cat);
    }
    for (let i = 0; i < topicList.length; i += BATCH) {
      const batch = topicList.slice(i, i + BATCH);
      const result = await categorizeTopics(batch);
      for (const [raw, cat] of Array.from(result.entries())) topicMap.set(raw, cat);
    }

    // 4. Upsert mappings
    for (const [raw, category] of Array.from(titleMap.entries())) {
      await supabase.from("title_category_mapping").upsert(
        { raw_title: raw, category },
        { onConflict: "raw_title" }
      );
    }
    for (const [raw, category] of Array.from(topicMap.entries())) {
      await supabase.from("topic_category_mapping").upsert(
        { raw_topic: raw, category },
        { onConflict: "raw_topic" }
      );
    }

    // 5. Update guest_contacts with title_category, topic, topic_category
    const { data: allContacts } = await supabase.from("guest_contacts").select("id, guest_name, title");
    let updated = 0;
    for (const c of allContacts ?? []) {
      const key = (c.guest_name as string).toLowerCase().trim();
      const pair = guestTitleTopic.get(key);
      const title = (c.title as string)?.trim() || pair?.title || null;
      const topic = pair?.topic || null;
      const titleCategory = title ? titleMap.get(title) || title : null;
      const topicCategory = topic ? topicMap.get(topic) || topic : null;

      const { error } = await supabase
        .from("guest_contacts")
        .update({
          title_category: titleCategory,
          topic,
          topic_category: topicCategory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id);
      if (!error) updated++;
    }

    return NextResponse.json({
      message: "Categorization complete",
      titlesCategorized: titleMap.size,
      topicsCategorized: topicMap.size,
      contactsUpdated: updated,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
