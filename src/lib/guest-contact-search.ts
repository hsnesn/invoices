/**
 * AI web search for guest contact info. Runs Serper + OpenAI extraction,
 * saves to guest_contacts. Used by Search web button and auto-trigger on new guest.
 */
import { createAdminClient } from "@/lib/supabase/admin";

type SerperOrganic = { title?: string; link?: string; snippet?: string };

async function searchWeb(query: string): Promise<{ organic?: SerperOrganic[] } | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10 }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { organic?: SerperOrganic[] };
  } catch {
    return null;
  }
}

export async function runGuestContactSearch(guestName: string): Promise<void> {
  const name = guestName?.trim();
  if (!name || name.length < 2) return;

  const searchResult = await searchWeb(`${name} contact email phone`);
  const socialResult = await searchWeb(`${name} Twitter LinkedIn Instagram`);
  const linkedInResult = await searchWeb(`${name} LinkedIn profile`);

  const combined: SerperOrganic[] = [
    ...(searchResult?.organic ?? []),
    ...(socialResult?.organic ?? []),
    ...(linkedInResult?.organic ?? []),
  ];
  const unique = Array.from(new Map(combined.map((o) => [o.link ?? o.title ?? "", o])).values());
  const text = unique
    .slice(0, 15)
    .map((o) => `Title: ${o.title ?? ""}\nLink: ${o.link ?? ""}\nSnippet: ${o.snippet ?? ""}`)
    .join("\n---\n");

  const supabase = createAdminClient();
  const key = name.toLowerCase().trim();
  const { data: existing } = await supabase
    .from("guest_contacts")
    .select("id, ai_contact_info, ai_searched_at, title, organization, bio, photo_url")
    .eq("guest_name_key", key)
    .maybeSingle();

  const ex = existing as { id?: string; ai_contact_info?: unknown; title?: string | null; organization?: string | null; bio?: string | null; photo_url?: string | null } | null;
  const hasUsefulAiData = (info: unknown): boolean => {
    if (!info || typeof info !== "object") return false;
    const o = info as { phone?: unknown; email?: unknown; social_media?: unknown[] };
    return !!(o.phone || o.email || (Array.isArray(o.social_media) && o.social_media.length > 0));
  };
  const hasEnrichment = ex?.title || ex?.organization || ex?.bio || ex?.photo_url;
  if (ex?.id && hasUsefulAiData(ex.ai_contact_info) && hasEnrichment) {
    return;
  }

  if (!text.trim()) {
    if (existing) {
      await supabase.from("guest_contacts").update({
        ai_contact_info: { phone: null, email: null, social_media: [] },
        ai_searched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("guest_contacts").insert({
        guest_name: name,
        ai_contact_info: { phone: null, email: null, social_media: [] },
        ai_searched_at: new Date().toISOString(),
        source: "ai_search",
      });
    }
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, "");

  type Extracted = {
    phone?: string;
    email?: string;
    social_media?: string[];
    confidence?: number;
    title?: string | null;
    organization?: string | null;
    bio?: string | null;
    photo_url?: string | null;
  };
  let extracted: Extracted = {};
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25_000);
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.EXTRACTION_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: `Extract contact and profile info for "${name}" from these search results. Return JSON only:
{"phone": "number or null", "email": "address or null", "social_media": ["url1", "url2"], "confidence": 0-100, "title": "job title or null", "organization": "company/institution or null", "bio": "short bio 1-2 sentences or null", "photo_url": "profile image URL or null"}
- confidence: 0-100, how confident you are that this info belongs to this person.
- social_media: only Twitter/X, LinkedIn, Instagram, Facebook profile URLs.
- title: current job title (e.g. "Political Analyst", "Journalist").
- organization: employer or institution (e.g. "Reuters", "BBC").
- bio: 1-2 sentence professional bio.
- photo_url: direct image URL for profile photo (must be a valid image URL ending in .jpg, .png, etc).
- If nothing found for a field, use null.

SEARCH RESULTS:
${text.slice(0, 10000)}`,
            },
          ],
          max_tokens: 700,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (raw) {
        const parsed = JSON.parse(raw.replace(/```json?\s*|\s*```/g, "").trim()) as Record<string, unknown>;
        const conf = typeof parsed.confidence === "number" ? Math.min(100, Math.max(0, parsed.confidence)) : undefined;
        const str = (v: unknown): string | undefined =>
          typeof v === "string" && v.trim() && v !== "null" ? v.trim() : undefined;
        extracted = {
          phone: str(parsed.phone),
          email: str(parsed.email),
          social_media: Array.isArray(parsed.social_media) ? parsed.social_media.filter((u): u is string => typeof u === "string") : undefined,
          confidence: conf,
          title: str(parsed.title) ?? null,
          organization: str(parsed.organization) ?? null,
          bio: str(parsed.bio) ?? null,
          photo_url: str(parsed.photo_url) ?? null,
        };
      }
    } catch {
      // ignore
    }
  }

  const aiFound = {
    phone: extracted?.phone ?? null,
    email: extracted?.email ?? null,
    social_media: extracted?.social_media ?? [],
    ...(typeof extracted?.confidence === "number" && { confidence: extracted.confidence }),
  };

  const updatePayload: Record<string, unknown> = {
    ai_contact_info: aiFound,
    ai_searched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (extracted?.title != null && !ex?.title) updatePayload.title = extracted.title;
  if (extracted?.organization != null && !ex?.organization) updatePayload.organization = extracted.organization;
  if (extracted?.bio != null && !ex?.bio) updatePayload.bio = extracted.bio;
  if (extracted?.photo_url != null && !ex?.photo_url) updatePayload.photo_url = extracted.photo_url;

  if (ex?.id) {
    await supabase.from("guest_contacts").update(updatePayload).eq("id", ex.id);
  } else {
    const insertPayload: Record<string, unknown> = {
      guest_name: name,
      ai_contact_info: aiFound,
      ai_searched_at: new Date().toISOString(),
      source: "ai_search",
    };
    if (extracted?.title) insertPayload.title = extracted.title;
    if (extracted?.organization) insertPayload.organization = extracted.organization;
    if (extracted?.bio) insertPayload.bio = extracted.bio;
    if (extracted?.photo_url) insertPayload.photo_url = extracted.photo_url;
    await supabase.from("guest_contacts").insert(insertPayload);
  }
}
