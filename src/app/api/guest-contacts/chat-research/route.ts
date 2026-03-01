/**
 * Chat-style research for Guest Contacts.
 * Can search across all guests or focus on a selected guest.
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
    const query = typeof body?.query === "string" ? body.query.trim() : null;
    const guestName = typeof body?.guest_name === "string" ? body.guest_name.trim() || null : null;
    const guestList = Array.isArray(body?.guest_list)
      ? (body.guest_list as string[]).filter((n): n is string => typeof n === "string" && n.trim().length > 0).slice(0, 50)
      : [];

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PERPLEXITY_API_KEY not configured. Add it in Vercel env." },
        { status: 503 }
      );
    }

    let scope: string;
    if (guestName) {
      scope = `Focus ONLY on this specific person: "${guestName}".`;
    } else if (guestList.length > 0) {
      scope = `The user has provided their internal guest list. Research the following people (${guestList.length} guests):\n${guestList.map((n) => `- ${n}`).join("\n")}\n\nAnswer the user's query about these specific guests. If the query asks to analyze or compare them, do so for the people listed above.`;
    } else {
      scope = "Search across public figures, experts, and potential TV guests in general.";
    }
    const prompt = `You are a research assistant for a broadcast/TV production company. ${scope}

**User query:** ${query}

Provide a concise answer in English. When relevant, include risk-related checks:
- Anti-Turkey stance
- Pro-Israel stance
- Sexual assault/harassment allegations
- PKK or FETÖ sympathies
- Anti-Erdoğan statements

Be factual; cite sources. Use [1], [2], etc. for citations. Keep under 400 words.`;

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
