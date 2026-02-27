/**
 * Get or create category for a title/topic. Used when new guest contacts are created.
 * Looks up mapping first; if not found, calls AI and caches.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { categorizeTitles, categorizeTopics } from "./categorize-title-topic";

export async function getOrCreateTitleCategory(rawTitle: string | null | undefined): Promise<string | null> {
  const t = rawTitle?.trim();
  if (!t) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("title_category_mapping")
    .select("category")
    .eq("raw_title", t)
    .maybeSingle();

  if (data?.category) return data.category;

  const map = await categorizeTitles([t]);
  const category = map.get(t) || t;
  await supabase.from("title_category_mapping").upsert(
    { raw_title: t, category },
    { onConflict: "raw_title" }
  );
  return category;
}

export async function getOrCreateTopicCategory(rawTopic: string | null | undefined): Promise<string | null> {
  const t = rawTopic?.trim();
  if (!t) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("topic_category_mapping")
    .select("category")
    .eq("raw_topic", t)
    .maybeSingle();

  if (data?.category) return data.category;

  const map = await categorizeTopics([t]);
  const category = map.get(t) || t;
  await supabase.from("topic_category_mapping").upsert(
    { raw_topic: t, category },
    { onConflict: "raw_topic" }
  );
  return category;
}
