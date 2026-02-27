/**
 * AI categorization of guest contact titles and topics.
 * Maps raw values (e.g. "Journalist", "Politics") to standardized categories.
 */

const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, "");
const model = process.env.EXTRACTION_MODEL || "gpt-4o-mini";

export type CategorizeResult = { raw: string; category: string };

/**
 * Categorize a batch of titles into standardized categories.
 * Returns mapping: raw_title -> category
 */
export async function categorizeTitles(rawTitles: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(rawTitles.map((t) => t.trim()).filter(Boolean)));
  if (unique.length === 0) return new Map();

  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set - skipping title categorization");
    return new Map(unique.map((t) => [t, t]));
  }

  const list = unique.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const systemPrompt = `You are a data analyst. Your task is to categorize guest titles (job roles, professions) from a TV/broadcast company's invoice system into standardized categories.

## Rules
- Output ONLY a JSON array. No markdown, no explanation.
- Each item: {"raw": "exact input string", "category": "standardized category"}
- Use concise, consistent category names (e.g. "Media", "Political analyst", "Academic", "Sports", "Entertainment", "Business", "Diplomat", "Other").
- Group similar titles: "Journalist" and "Reporter" -> "Media"; "Professor" and "Academic" -> "Academic".
- Preserve the exact "raw" string from the input.
- If unsure, use "Other".`;

  const userPrompt = `Categorize these titles:\n${list}`;

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
      }),
    });

    const text = await res.text();
    const data = (text ? JSON.parse(text) : {}) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return new Map(unique.map((t) => [t, t]));

    const parsed = JSON.parse(content) as CategorizeResult[];
    const map = new Map<string, string>();
    for (const p of Array.isArray(parsed) ? parsed : []) {
      if (p?.raw && p?.category) map.set(String(p.raw).trim(), String(p.category).trim());
    }
    for (const t of unique) {
      if (!map.has(t)) map.set(t, t);
    }
    return map;
  } catch (e) {
    console.error("Title categorization failed:", e);
    return new Map(unique.map((t) => [t, t]));
  }
}

/**
 * Categorize a batch of topics into standardized categories.
 */
export async function categorizeTopics(rawTopics: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(rawTopics.map((t) => t.trim()).filter(Boolean)));
  if (unique.length === 0) return new Map();

  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set - skipping topic categorization");
    return new Map(unique.map((t) => [t, t]));
  }

  const list = unique.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const systemPrompt = `You are a data analyst. Your task is to categorize programme topics from a TV/broadcast company's invoice system into standardized categories.

## Rules
- Output ONLY a JSON array. No markdown, no explanation.
- Each item: {"raw": "exact input string", "category": "standardized category"}
- Prefer these high-level categories when applicable: "Foreign Policy / Security", "Domestic Politics", "Business", "Culture", "Sports", "Other".
- "Foreign Policy / Security": international relations, defence, security, diplomacy, conflict, migration, global affairs.
- "Domestic Politics": elections, parliament, devolution, UK politics, policy, government.
- Group similar topics into one of the above.
- Preserve the exact "raw" string from the input.
- If unsure, use "Other".`;

  const userPrompt = `Categorize these topics:\n${list}`;

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
      }),
    });

    const text = await res.text();
    const data = (text ? JSON.parse(text) : {}) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return new Map(unique.map((t) => [t, t]));

    const parsed = JSON.parse(content) as CategorizeResult[];
    const map = new Map<string, string>();
    for (const p of Array.isArray(parsed) ? parsed : []) {
      if (p?.raw && p?.category) map.set(String(p.raw).trim(), String(p.category).trim());
    }
    for (const t of unique) {
      if (!map.has(t)) map.set(t, t);
    }
    return map;
  } catch (e) {
    console.error("Topic categorization failed:", e);
    return new Map(unique.map((t) => [t, t]));
  }
}
