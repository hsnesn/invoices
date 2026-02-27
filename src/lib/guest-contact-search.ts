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

  const combined: SerperOrganic[] = [
    ...(searchResult?.organic ?? []),
    ...(socialResult?.organic ?? []),
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
    .select("id, ai_contact_info, ai_searched_at")
    .eq("guest_name_key", key)
    .maybeSingle();

  const hasUsefulAiData = (info: unknown): boolean => {
    if (!info || typeof info !== "object") return false;
    const o = info as { phone?: unknown; email?: unknown; social_media?: unknown[] };
    return !!(o.phone || o.email || (Array.isArray(o.social_media) && o.social_media.length > 0));
  };
  if (existing?.id && hasUsefulAiData((existing as { ai_contact_info?: unknown }).ai_contact_info)) {
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

  let extracted: { phone?: string; email?: string; social_media?: string[] } = {};
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.EXTRACTION_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: `Extract contact info for "${name}" from these search results. Return JSON only:
{"phone": "number or null", "email": "address or null", "social_media": ["url1", "url2"]}
Only include URLs that look like Twitter/X, LinkedIn, Instagram, Facebook profiles. No other sites. If nothing found, use null for phone/email and [] for social_media.

SEARCH RESULTS:
${text.slice(0, 8000)}`,
            },
          ],
          max_tokens: 500,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (raw) {
        const parsed = JSON.parse(raw.replace(/```json?\s*|\s*```/g, "").trim()) as Record<string, unknown>;
        extracted = {
          phone: typeof parsed.phone === "string" && parsed.phone !== "null" ? parsed.phone : undefined,
          email: typeof parsed.email === "string" && parsed.email !== "null" ? parsed.email : undefined,
          social_media: Array.isArray(parsed.social_media) ? parsed.social_media.filter((u): u is string => typeof u === "string") : undefined,
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
  };

  if (existing) {
    await supabase
      .from("guest_contacts")
      .update({
        ai_contact_info: aiFound,
        ai_searched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("guest_contacts").insert({
      guest_name: name,
      ai_contact_info: aiFound,
      ai_searched_at: new Date().toISOString(),
      source: "ai_search",
    });
  }
}
