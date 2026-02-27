/**
 * Import guest contacts from GUEST LOG.xlsx format.
 * Columns: RX, TX, TOPIC, TYPE, GUEST NAME, GUEST TITLE, PROD., PHONE, FEE, INVOICES, EMAIL
 * Uses AI to categorize titles and topics in batches.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { categorizeTitles, categorizeTopics } from "@/lib/categorize-title-topic";
import * as XLSX from "xlsx";

export const maxDuration = 300;

function trim(s: unknown): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t || null;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      return NextResponse.json({ error: "Use Excel (.xlsx or .xls)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames.find((n) => n.toUpperCase().includes("ALL EVENTS") || n.toUpperCase().includes("EVENTS")) ?? wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Excel has no sheets" }, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

    const headers = (rows[1] ?? []) as string[];
    const guestNameIdx = headers.findIndex((h) => /guest\s*name/i.test(String(h ?? "")));
    const titleIdx = headers.findIndex((h) => /guest\s*title/i.test(String(h ?? "")));
    const topicIdx = headers.findIndex((h) => /topic/i.test(String(h ?? "")));
    const phoneIdx = headers.findIndex((h) => /phone/i.test(String(h ?? "")));
    const emailIdx = headers.findIndex((h) => /email/i.test(String(h ?? "")));

    if (guestNameIdx < 0) {
      return NextResponse.json({ error: "Could not find GUEST NAME column" }, { status: 400 });
    }

    const parsed: { guestName: string; title: string | null; topic: string | null; phone: string | null; email: string | null }[] = [];
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const guestName = trim(row[guestNameIdx]);
      if (!guestName || guestName.length < 2) continue;
      if (/^--\s*\d{4}\s*--$/i.test(guestName)) continue;
      parsed.push({
        guestName,
        title: titleIdx >= 0 ? trim(row[titleIdx]) : null,
        topic: topicIdx >= 0 ? trim(row[topicIdx]) : null,
        phone: phoneIdx >= 0 ? trim(row[phoneIdx]) : null,
        email: emailIdx >= 0 ? trim(row[emailIdx]) : null,
      });
    }

    const allTitles = Array.from(new Set(parsed.map((p) => p.title).filter((t): t is string => Boolean(t))));
    const allTopics = Array.from(new Set(parsed.map((p) => p.topic).filter((t): t is string => Boolean(t))));

    const supabase = createAdminClient();
    const titleMap = new Map<string, string>();
    const topicMap = new Map<string, string>();

    const BATCH = 30;
    for (let i = 0; i < allTitles.length; i += BATCH) {
      const batch = allTitles.slice(i, i + BATCH);
      const result = await categorizeTitles(batch);
      for (const [raw, cat] of Array.from(result.entries())) titleMap.set(raw, cat);
    }
    for (let i = 0; i < allTopics.length; i += BATCH) {
      const batch = allTopics.slice(i, i + BATCH);
      const result = await categorizeTopics(batch);
      for (const [raw, cat] of Array.from(result.entries())) topicMap.set(raw, cat);
    }

    for (const [raw, category] of Array.from(titleMap.entries())) {
      await supabase.from("title_category_mapping").upsert({ raw_title: raw, category }, { onConflict: "raw_title" });
    }
    for (const [raw, category] of Array.from(topicMap.entries())) {
      await supabase.from("topic_category_mapping").upsert({ raw_topic: raw, category }, { onConflict: "raw_topic" });
    }

    const results: { guest_name: string; status: "ok" | "skip" | "error"; message?: string }[] = [];
    let added = 0;
    let updated = 0;

    for (const p of parsed) {
      const key = p.guestName.toLowerCase().trim();
      const { data: existing } = await supabase
        .from("guest_contacts")
        .select("id, phone, email, title, topic")
        .eq("guest_name_key", key)
        .maybeSingle();

      const rawTitle = p.title || (existing?.title as string) || null;
      const rawTopic = p.topic || (existing?.topic as string) || null;
      const titleCategory = rawTitle ? titleMap.get(rawTitle) ?? rawTitle : null;
      const topicCategory = rawTopic ? topicMap.get(rawTopic) ?? rawTopic : null;

      const payload = {
        guest_name: p.guestName.trim(),
        phone: p.phone || (existing?.phone as string) || null,
        email: p.email || (existing?.email as string) || null,
        title: rawTitle,
        topic: rawTopic,
        title_category: titleCategory,
        topic_category: topicCategory,
        source: "guest_log_import",
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase.from("guest_contacts").update(payload).eq("id", existing.id);
        if (error) {
          results.push({ guest_name: p.guestName, status: "error", message: error.message });
        } else {
          updated++;
          results.push({ guest_name: p.guestName, status: "ok" });
        }
      } else {
        const { error } = await supabase.from("guest_contacts").insert(payload);
        if (error) {
          results.push({ guest_name: p.guestName, status: "error", message: error.message });
        } else {
          added++;
          results.push({ guest_name: p.guestName, status: "ok" });
        }
      }
    }

    return NextResponse.json({
      message: `Imported ${added + updated} contacts (${added} new, ${updated} updated).`,
      added,
      updated,
      total: added + updated,
      results: results.slice(-50),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
