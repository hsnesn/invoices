/**
 * Fetch guest contacts with optional full-text search.
 * Uses PostgreSQL tsvector when search is provided.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export async function fetchGuestContacts(searchQuery?: string | null) {
  const supabase = createAdminClient();
  const search = searchQuery?.trim() || null;

  if (search && search.length >= 2) {
    const { data, error } = await supabase.rpc("search_guest_contacts", {
      search_query: search,
    });
    if (error) {
      console.warn("search_guest_contacts RPC failed, falling back to full fetch:", error.message);
      const { data: fallback } = await supabase
        .from("guest_contacts")
        .select("id, guest_name, phone, email, title, title_category, topic, topic_category, organization, bio, photo_url, ai_contact_info, ai_searched_at, ai_assessment, ai_assessed_at, updated_at, is_favorite, tags, affiliated_orgs, prohibited_topics, conflict_of_interest_notes")
        .order("guest_name");
      return fallback ?? [];
    }
    return data ?? [];
  }

  const { data } = await supabase
    .from("guest_contacts")
    .select("id, guest_name, phone, email, title, title_category, topic, topic_category, organization, bio, photo_url, ai_contact_info, ai_searched_at, ai_assessment, ai_assessed_at, updated_at, is_favorite, tags, affiliated_orgs, prohibited_topics, conflict_of_interest_notes")
    .order("guest_name");
  return data ?? [];
}
