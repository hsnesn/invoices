import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import OpenAI from "openai";
import type { PageKey } from "@/lib/types";

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
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_contacts"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const guestName = typeof body?.guest_name === "string" ? body.guest_name.trim() : null;
    if (!guestName) {
      return NextResponse.json({ error: "guest_name is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: invoices } = await supabase
      .from("invoices")
      .select(`
        id,
        service_description,
        generated_invoice_data,
        created_at,
        service_date_from,
        service_date_to,
        department_id,
        program_id,
        invoice_extracted_fields(raw_json, gross_amount)
      `)
      .neq("invoice_type", "freelancer")
      .order("created_at", { ascending: false })
      .limit(500);

    const guestKey = guestName.toLowerCase().trim();
    const appearances: { topic: string; date: string; programme: string; department: string; amount: string; invoice_id: string }[] = [];
    type InvItem = NonNullable<typeof invoices>[number];
    const pending: { inv: InvItem; meta: Record<string, string>; gen: { guest_name?: string | null; title?: string | null; appearances?: { topic: string; date: string; amount: number }[] } | null; title: string | null; topic: string | null; tx1: string | null; deptId: string | null; progId: string | null; amount: string }[] = [];

    for (const inv of invoices ?? []) {
      const meta = parseServiceDesc(inv.service_description);
      const gen = inv.generated_invoice_data as {
        guest_name?: string | null;
        title?: string | null;
        appearances?: { topic: string; date: string; amount: number }[];
      } | null;
      const extRaw = (inv as { invoice_extracted_fields?: { raw_json?: Record<string, unknown>; gross_amount?: number }[] | { raw_json?: Record<string, unknown>; gross_amount?: number } | null }).invoice_extracted_fields;
      const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw;
      const raw = ext?.raw_json ?? {};

      const invGuestName =
        gen?.guest_name?.trim() ||
        fromMeta(meta, ["guest name", "guest", "guest_name"]) ||
        (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name.trim() : null) ||
        null;

      if (!invGuestName || invGuestName.toLowerCase().trim() !== guestKey) continue;

      const title = gen?.title?.trim() || fromMeta(meta, ["title", "programme title", "program title"]) || null;
      const topic = fromMeta(meta, ["topic", "description", "service description"]) || null;
      const tx1 = fromMeta(meta, ["tx date", "tx date 1", "1. tx date"]) || inv.service_date_from || null;
      const gross = ext?.gross_amount ?? (typeof raw.gross_amount === "number" ? raw.gross_amount : null);
      const amount = gross != null ? `£${Number(gross).toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "—";

      pending.push({
        inv,
        meta,
        gen,
        title,
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
      const programme = progName !== "—" ? progName : p.title || "—";

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

    if (appearances.length === 0) {
      return NextResponse.json({
        assessment: `No invoice data found for guest "${guestName}".`,
        appearances: [],
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const appearancesPayload = appearances.map((a) => ({
      date: a.date,
      topic: a.topic,
      programme: a.programme,
      department: a.department,
      amount: a.amount,
      invoice_id: a.invoice_id,
    }));

    if (!apiKey) {
      return NextResponse.json({
        assessment: "AI assessment unavailable (OPENAI_API_KEY not configured in Vercel). Add it in Project Settings → Environment Variables.",
        appearances: appearancesPayload,
      });
    }

    const openai = new OpenAI({ apiKey });

    const appearancesText = appearances
      .map(
        (a, i) =>
          `${i + 1}. Date: ${a.date} | Topic: ${a.topic} | Programme: ${a.programme} | Department: ${a.department} | Amount: ${a.amount}`
      )
      .join("\n");

    const systemPrompt = `You are an analyst for a broadcast/TV production company. Your task is to write a concise guest assessment based on invoice and programme data.

## Your role
Summarise who a guest is, when they appeared, and what they contributed. Use only the data provided. Do not invent facts.

## Output format
Write 2–5 clear sentences in English. Structure as follows:
1. **Identity**: Who is this person? Infer from topics, programmes, and departments (e.g. "Expert commentator", "Political analyst", "Guest on news programmes").
2. **Timeline**: When did they appear? Mention dates or date ranges. If multiple appearances, list them chronologically.
3. **Content**: What did they discuss? Summarise topics and programmes. If multiple appearances, briefly mention each.
4. **Context** (optional): Note department or programme type if it adds clarity.

## Rules
- Use plain English. No bullet points or markdown in the output.
- Be factual. Only use information from the provided appearances.
- If a field is "—" or empty, omit it or say "unspecified".
- For a single appearance: keep it brief (2–3 sentences).
- For multiple appearances: mention each appearance with its date and topic.
- Do not add greetings, disclaimers, or meta-commentary.`;

    const userPrompt = `Write a guest assessment for:

**Guest name:** ${guestName}

**Appearances data:**
${appearancesText}

Provide a concise assessment following the format described.`;

    let assessment: string;
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.EXTRACTION_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
      });
      assessment = completion.choices[0]?.message?.content?.trim() || "Unable to generate assessment.";
    } catch (openaiError) {
      const msg = openaiError instanceof Error ? openaiError.message : String(openaiError);
      const isAuth = /api_key|invalid|authentication|401|unauthorized/i.test(msg);
      const isRateLimit = /rate_limit|429|too many/i.test(msg);
      const isTimeout = /timeout|timed out|ETIMEDOUT|ECONNRESET/i.test(msg);
      if (isAuth) {
        assessment = "AI assessment unavailable: OpenAI API key is invalid or missing. Check OPENAI_API_KEY in Vercel environment variables.";
      } else if (isRateLimit) {
        assessment = "AI assessment temporarily unavailable: Too many requests. Please try again in a moment.";
      } else if (isTimeout) {
        assessment = "AI assessment timed out. The OpenAI API took too long to respond. Please try again.";
      } else {
        assessment = `AI assessment temporarily unavailable: ${msg}`;
      }
    }

    return NextResponse.json({
      assessment,
      appearances: appearancesPayload,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
