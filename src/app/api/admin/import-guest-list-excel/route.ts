/**
 * Import guest list from Guest_List_FINAL_Single_List.xlsx format.
 * Overwrites guest_contacts with Excel data while preserving:
 * - Links to invoices (matched by guest name)
 * - AI assessment, ai_contact_info, is_favorite, tags, COI fields
 *
 * Excel columns: Category, Full Name, Primary Title, Secondary Expertise Tags,
 * Program Name, Programme Topics, Institution/Affiliation, Email, Phone, Dept,
 * Last appearance, Source Title, Invoice Link
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { getOrCreateTitleCategory, getOrCreateTopicCategory } from "@/lib/guest-contact-categorize";
import { formatPhone } from "@/lib/contact-validation";
import * as XLSX from "xlsx";

export const maxDuration = 300;

function trim(s: unknown): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t || null;
}

function normalizeKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

// Map Excel Category to topic_category (Foreign Policy, Security, Domestic)
function mapCategory(cat: string | null): string | null {
  if (!cat) return null;
  const c = cat.trim();
  if (/foreign|policy|security/i.test(c)) return "Foreign Policy / Security";
  if (/domestic|politics/i.test(c)) return "Domestic Politics";
  return c;
}

type ExcelRow = {
  guest_name: string;
  title: string | null;
  topic: string | null;
  topic_category: string | null;
  organization: string | null;
  email: string | null;
  phone: string | null;
  primary_program: string | null;
  dept: string | null;
};

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
    const sheetName = wb.SheetNames.find((n) => /all.?guests|guests/i.test(n)) ?? wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: "Excel has no sheets" }, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

    const headers = (rows[0] ?? []) as string[];
    const catIdx = headers.findIndex((h) => /category/i.test(String(h ?? "")));
    const nameIdx = headers.findIndex((h) => /full\s*name|name/i.test(String(h ?? "")));
    const titleIdx = headers.findIndex((h) => /primary\s*title|title/i.test(String(h ?? "")));
    const tagsIdx = headers.findIndex((h) => /secondary\s*expertise|expertise/i.test(String(h ?? "")));
    const progIdx = headers.findIndex((h) => /program\s*name|programme/i.test(String(h ?? "")));
    const topicIdx = headers.findIndex((h) => /programme\s*topics|topics/i.test(String(h ?? "")));
    const orgIdx = headers.findIndex((h) => /institution|affiliation/i.test(String(h ?? "")));
    const emailIdx = headers.findIndex((h) => /email/i.test(String(h ?? "")));
    const phoneIdx = headers.findIndex((h) => /phone/i.test(String(h ?? "")));
    const deptIdx = headers.findIndex((h) => /dept/i.test(String(h ?? "")));

    if (nameIdx < 0) {
      return NextResponse.json({ error: "Could not find Full Name column" }, { status: 400 });
    }

    const parsed: ExcelRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const guestName = trim(row[nameIdx]);
      if (!guestName || guestName.length < 2) continue;

      const category = catIdx >= 0 ? trim(row[catIdx]) : null;
      const topicCategory = mapCategory(category);
      const primaryTitle = titleIdx >= 0 ? trim(row[titleIdx]) : null;
      const tags = tagsIdx >= 0 ? trim(row[tagsIdx]) : null;
      const progTopics = topicIdx >= 0 ? trim(row[topicIdx]) : null;
      const topic = tags || progTopics || null;

      parsed.push({
        guest_name: guestName,
        title: primaryTitle,
        topic,
        topic_category: topicCategory,
        organization: orgIdx >= 0 ? trim(row[orgIdx]) : null,
        email: emailIdx >= 0 ? trim(row[emailIdx]) : null,
        phone: phoneIdx >= 0 ? trim(row[phoneIdx]) : null,
        primary_program: progIdx >= 0 ? trim(row[progIdx]) : null,
        dept: deptIdx >= 0 ? trim(row[deptIdx]) : null,
      });
    }

    const supabase = createAdminClient();
    const excelKeys = new Set(parsed.map((p) => normalizeKey(p.guest_name)));

    // Preserve these when updating existing
    const { data: allExisting } = await supabase
      .from("guest_contacts")
      .select("id, guest_name, guest_name_key, phone, email, ai_assessment, ai_assessed_at, ai_contact_info, ai_searched_at, is_favorite, tags, affiliated_orgs, prohibited_topics, conflict_of_interest_notes");

    type ExistingRow = NonNullable<typeof allExisting>[number];
    const existingByKey = new Map<string, ExistingRow>();
    for (const e of allExisting ?? []) {
      const k = (e as { guest_name_key?: string }).guest_name_key ?? normalizeKey((e as { guest_name?: string }).guest_name ?? "");
      existingByKey.set(k, e);
    }

    let added = 0;
    let updated = 0;
    const results: { guest_name: string; status: "ok" | "skip" | "error"; message?: string }[] = [];

    for (const p of parsed) {
      const key = normalizeKey(p.guest_name);
      const existing = existingByKey.get(key);

      const rawTitle = p.title;
      const rawTopic = p.topic;
      const topicCat = p.topic_category || (rawTopic ? await getOrCreateTopicCategory(rawTopic) : null);
      const titleCat = rawTitle ? await getOrCreateTitleCategory(rawTitle) : null;

      const rawPhone = p.phone || (existing ? (existing as { phone?: string }).phone : null) || null;
      const phone = rawPhone ? (formatPhone(rawPhone) ?? rawPhone.trim()) : null;

      const payload: Record<string, unknown> = {
        guest_name: p.guest_name.trim(),
        phone,
        email: p.email || (existing ? (existing as { email?: string }).email : null) || null,
        title: rawTitle,
        topic: rawTopic,
        title_category: titleCat,
        topic_category: topicCat,
        organization: p.organization,
        primary_program: p.primary_program,
        source: "guest_list_import",
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const ex = existing as {
          ai_assessment?: string | null;
          ai_assessed_at?: string | null;
          ai_contact_info?: unknown;
          ai_searched_at?: string | null;
          is_favorite?: boolean;
          tags?: string[];
          affiliated_orgs?: string[];
          prohibited_topics?: string[];
          conflict_of_interest_notes?: string | null;
        };
        if (ex.ai_assessment != null) payload.ai_assessment = ex.ai_assessment;
        if (ex.ai_assessed_at != null) payload.ai_assessed_at = ex.ai_assessed_at;
        if (ex.ai_contact_info != null) payload.ai_contact_info = ex.ai_contact_info;
        if (ex.ai_searched_at != null) payload.ai_searched_at = ex.ai_searched_at;
        if (ex.is_favorite != null) payload.is_favorite = ex.is_favorite;
        if (ex.tags != null) payload.tags = ex.tags;
        if (ex.affiliated_orgs != null) payload.affiliated_orgs = ex.affiliated_orgs;
        if (ex.prohibited_topics != null) payload.prohibited_topics = ex.prohibited_topics;
        if (ex.conflict_of_interest_notes != null) payload.conflict_of_interest_notes = ex.conflict_of_interest_notes;

        const { error } = await supabase.from("guest_contacts").update(payload).eq("id", existing.id);
        if (error) {
          results.push({ guest_name: p.guest_name, status: "error", message: error.message });
        } else {
          updated++;
          results.push({ guest_name: p.guest_name, status: "ok" });
        }
      } else {
        const { error } = await supabase.from("guest_contacts").insert(payload);
        if (error) {
          results.push({ guest_name: p.guest_name, status: "error", message: error.message });
        } else {
          added++;
          results.push({ guest_name: p.guest_name, status: "ok" });
        }
      }
    }

    // Overwrite: remove contacts not in Excel
    const toDelete = (allExisting ?? []).filter((e) => {
      const k = (e as { guest_name_key?: string }).guest_name_key ?? normalizeKey((e as { guest_name?: string }).guest_name ?? "");
      return !excelKeys.has(k);
    });
    let deleted = 0;
    for (const row of toDelete) {
      const { error } = await supabase.from("guest_contacts").delete().eq("id", row.id);
      if (!error) deleted++;
    }

    return NextResponse.json({
      message: `Imported ${added + updated} contacts (${added} new, ${updated} updated). Removed ${deleted} not in list.`,
      added,
      updated,
      deleted,
      total: added + updated,
      results: results.slice(-80),
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
