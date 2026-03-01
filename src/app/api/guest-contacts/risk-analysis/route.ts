/**
 * Guest risk analysis using Perplexity API (internet search).
 * Finds controversial statements, biography, recent programs.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_risk_research"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const guestName = typeof body?.guest_name === "string" ? body.guest_name.trim() : null;
    const title = typeof body?.title === "string" ? body.title.trim() : null;
    if (!guestName) {
      return NextResponse.json({ error: "guest_name is required" }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PERPLEXITY_API_KEY not configured. Add it in Vercel env for guest risk analysis." },
        { status: 503 }
      );
    }

    const context = title ? `${guestName}, ${title}` : guestName;
    const prompt = `Research this person for a broadcast/TV production company considering them as a guest:

**Person:** ${context}

Provide a concise risk assessment in English. Include:

1. **Who they are** – Brief biography, expertise, current role.
2. **Recent media appearances** – Last 2–3 TV/radio/podcast programs if found.
3. **Risk notes** – Check and report (be factual; cite sources; if none found, state "None found"):
   - Anti-Turkey stance or statements critical of Turkey
   - Pro-Israel stance or statements
   - Sexual assault or sexual harassment allegations
   - PKK sympathies or supportive statements
   - FETÖ sympathies or supportive statements
   - Anti-Erdoğan or anti-government statements
4. **Sources** – List the URLs you used (as [1], [2], etc. in text).

Keep the response under 500 words. Use bullet points for clarity.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `Perplexity API error (${res.status}): ${err.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      citations?: string[];
      search_results?: { title?: string; url?: string; snippet?: string }[];
    };

    const content = data.choices?.[0]?.message?.content ?? "No response from Perplexity.";
    const citations = data.citations ?? [];
    const searchResults = data.search_results ?? [];

    return NextResponse.json({
      summary: content,
      sources: citations.length > 0 ? citations : searchResults.map((s) => s.url).filter(Boolean),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
