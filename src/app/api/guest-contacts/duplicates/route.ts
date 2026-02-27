import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import stringSimilarity from "string-similarity";

function normalizeKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** First + last token for fuzzy matching (e.g. "John Smith" vs "John A. Smith") */
function firstLastKey(s: string): string {
  const parts = normalizeKey(s).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]!} ${parts[parts.length - 1]!}`;
}

const SIMILARITY_THRESHOLD = 0.85;

/** Fuzzy duplicate check: exact, first+last, contains, or Levenshtein similarity */
function mightBeDuplicate(a: string, b: string): boolean {
  const na = normalizeKey(a);
  const nb = normalizeKey(b);
  if (na === nb) return true;
  const fa = firstLastKey(a);
  const fb = firstLastKey(b);
  if (fa && fb && fa === fb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const similarity = stringSimilarity.compareTwoStrings(na, nb);
  if (similarity >= SIMILARITY_THRESHOLD) return true;
  const flSimilarity = stringSimilarity.compareTwoStrings(fa, fb);
  return flSimilarity >= SIMILARITY_THRESHOLD;
}

/** GET /api/guest-contacts/duplicates - Find potential duplicate groups */
export async function GET() {
  try {
    const { profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_contacts"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data: contacts } = await supabase
      .from("guest_contacts")
      .select("id, guest_name, phone, email, title, title_category, topic, topic_category")
      .order("guest_name");

    if (!contacts?.length) {
      return NextResponse.json({ groups: [] });
    }

    const groups: { primary: string; duplicates: { guest_name: string; id: string }[] }[] = [];
    const used = new Set<string>();

    for (const c of contacts) {
      const name = (c.guest_name as string) ?? "";
      const key = normalizeKey(name);
      if (!key || used.has(key)) continue;

      const duplicates: { guest_name: string; id: string }[] = [];
      for (const other of contacts) {
        if (other.id === c.id) continue;
        const otherName = (other.guest_name as string) ?? "";
        const otherKey = normalizeKey(otherName);
        if (!otherKey || used.has(otherKey)) continue;
        if (mightBeDuplicate(name, otherName)) {
          duplicates.push({ guest_name: otherName, id: other.id });
          used.add(otherKey);
        }
      }

      if (duplicates.length > 0) {
        groups.push({
          primary: name,
          duplicates,
        });
        used.add(key);
      }
    }

    return NextResponse.json({
      groups,
      totalGroups: groups.length,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
