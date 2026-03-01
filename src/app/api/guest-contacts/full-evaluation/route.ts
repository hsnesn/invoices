/**
 * One-click full evaluation: TRT programs + risk analysis.
 * Combines internal appearance data with Perplexity risk search.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

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

    const supabase = createAdminClient();
    const guestKey = guestName.toLowerCase().trim();

    // 1. Fetch TRT appearances from invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, service_description, generated_invoice_data, created_at, service_date_from, department_id, program_id, invoice_extracted_fields(raw_json, gross_amount)")
      .neq("invoice_type", "freelancer")
      .order("created_at", { ascending: false })
      .limit(500);

    type InvItem = NonNullable<typeof invoices>[number];
    const appearances: { topic: string; date: string; programme: string; department: string; amount: string; invoice_id: string }[] = [];
    const pending: { inv: InvItem; meta: Record<string, string>; gen: { guest_name?: string | null; title?: string | null; appearances?: { topic: string; date: string; amount: number }[] } | null; topic: string | null; tx1: string | null; deptId: string | null; progId: string | null; amount: string }[] = [];

    for (const inv of invoices ?? []) {
      const meta = parseServiceDesc(inv.service_description);
      const gen = inv.generated_invoice_data as { guest_name?: string | null; title?: string | null; appearances?: { topic: string; date: string; amount: number }[] } | null;
      const extRaw = (inv as { invoice_extracted_fields?: { raw_json?: Record<string, unknown>; gross_amount?: number }[] | { raw_json?: Record<string, unknown>; gross_amount?: number } | null }).invoice_extracted_fields;
      const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw;
      const raw = ext?.raw_json ?? {};

      const invGuestName =
        gen?.guest_name?.trim() ||
        fromMeta(meta, ["guest name", "guest", "guest_name"]) ||
        (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name.trim() : null) ||
        null;

      if (!invGuestName || invGuestName.toLowerCase().trim() !== guestKey) continue;

      const topic = fromMeta(meta, ["topic", "description", "service description"]) || null;
      const tx1 = fromMeta(meta, ["tx date", "tx date 1", "1. tx date"]) || inv.service_date_from || null;
      const gross = ext?.gross_amount ?? (typeof raw.gross_amount === "number" ? raw.gross_amount : null);
      const amount = gross != null ? `£${Number(gross).toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "—";

      pending.push({
        inv,
        meta,
        gen,
        topic,
        tx1,
        deptId: inv.department_id ?? null,
        progId: inv.program_id ?? null,
        amount,
      });
    }

    const deptIds = Array.from(new Set(pending.map((p) => p.deptId).filter((id): id is string => Boolean(id))));
    const progIds = Array.from(new Set(pending.map((p) => p.progId).filter((id): id is string => Boolean(id))));

    const { data: depts } = deptIds.length > 0 ? await supabase.from("departments").select("id, name").in("id", deptIds) : { data: [] };
    const { data: progs } = progIds.length > 0 ? await supabase.from("programs").select("id, name").in("id", progIds) : { data: [] };

    const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));
    const progMap = new Map((progs ?? []).map((p) => [p.id, p.name]));

    for (const p of pending) {
      const deptName = p.deptId ? deptMap.get(p.deptId) ?? "—" : "—";
      const progName = p.progId ? progMap.get(p.progId) ?? "—" : "—";
      const programme = progName !== "—" ? progName : p.gen?.title || "—";

      if (p.gen?.appearances?.length) {
        for (const a of p.gen.appearances) {
          if (a.topic || a.date) {
            appearances.push({
              topic: a.topic || "—",
              date: a.date || "—",
              programme,
              department: deptName,
              amount: a.amount != null ? `£${Number(a.amount).toFixed(2)}` : p.amount,
              invoice_id: p.inv.id,
            });
          }
        }
      } else {
        appearances.push({
          topic: p.topic || "—",
          date: p.tx1 || p.inv.service_date_from || p.inv.created_at?.slice(0, 10) || "—",
          programme,
          department: deptName,
          amount: p.amount,
          invoice_id: p.inv.id,
        });
      }
    }

    // 2. Risk analysis via Perplexity
    let riskAnalysis = "";
    let sources: string[] = [];

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (apiKey) {
      const context = title ? `${guestName}, ${title}` : guestName;
      const prompt = `Research this person for a broadcast/TV production company:

**Person:** ${context}

Provide a concise risk assessment in English. Include:
1. **Who they are** – Brief biography, expertise, current role.
2. **Recent media appearances** – Last 2–3 TV/radio/podcast programs if found.
3. **Risk notes** – Check (be factual; cite sources; if none found, state "None found"):
   - Anti-Turkey stance
   - Pro-Israel stance
   - Sexual assault/harassment allegations
   - PKK or FETÖ sympathies
   - Anti-Erdoğan statements
4. **Sources** – Use [1], [2], etc. in text.

Keep under 500 words. Use bullet points.`;

      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: prompt }], max_tokens: 1024, temperature: 0.2 }),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; citations?: string[]; search_results?: { url?: string }[] };
        riskAnalysis = data.choices?.[0]?.message?.content ?? "";
        sources = data.citations?.length ? data.citations : (data.search_results ?? []).map((s) => s.url).filter(Boolean);
      } else {
        riskAnalysis = "Risk analysis unavailable (Perplexity API error).";
      }
    } else {
      riskAnalysis = "Risk analysis unavailable (PERPLEXITY_API_KEY not configured).";
    }

    return NextResponse.json({
      guest_name: guestName,
      appearances: appearances.map((a) => ({ ...a })),
      risk_analysis: riskAnalysis,
      sources,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
