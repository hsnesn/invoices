/**
 * GET /api/guest-contacts/names-for-research
 * Returns the current guest list for Research chat. Fetches fresh from DB each time.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGuestContacts } from "@/lib/guest-contacts-fetch";

function normalizeKey(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

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

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session, profile } = await requireAuth();
    const canAccess =
      profile.role === "admin" ||
      (Array.isArray(profile.allowed_pages) && (profile.allowed_pages as PageKey[]).includes("guest_risk_research"));
    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const INVOICE_LIMIT = 2000;

    const [guestContactsRows, { data: invoices }, { data: gcSettings }, { data: producerVisibleGuests }, { data: producerVisibleInvitations }] =
      await Promise.all([
        fetchGuestContacts(null),
        supabase
          .from("invoices")
          .select("id, service_description, generated_invoice_data, invoice_extracted_fields(raw_json)")
          .neq("invoice_type", "freelancer")
          .neq("invoice_type", "guest_contact_scan")
          .order("created_at", { ascending: false })
          .limit(INVOICE_LIMIT),
        supabase.from("app_settings").select("key, value").in("key", ["guest_contacts_producer_scoped"]),
        profile.role === "submitter"
          ? supabase.from("producer_guests").select("guest_name").eq("producer_user_id", session.user.id)
          : Promise.resolve({ data: [] as { guest_name: string }[] }),
        profile.role === "submitter"
          ? supabase.from("guest_invitations").select("guest_name").eq("producer_user_id", session.user.id)
          : Promise.resolve({ data: [] as { guest_name?: string }[] }),
      ]);

    const seen = new Map<string, string>();

    for (const inv of invoices ?? []) {
      const meta = parseServiceDesc(inv.service_description);
      const gen = inv.generated_invoice_data as { guest_name?: string | null } | null;
      const extRaw = (inv as { invoice_extracted_fields?: { raw_json?: Record<string, unknown> }[] | { raw_json?: Record<string, unknown> } | null })
        .invoice_extracted_fields;
      const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw;
      const raw = ext?.raw_json ?? {};

      const guestName =
        gen?.guest_name?.trim() ||
        fromMeta(meta, ["guest name", "guest", "guest_name"]) ||
        (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name.trim() : null) ||
        null;

      if (!guestName) continue;
      const key = normalizeKey(guestName);
      if (!seen.has(key)) seen.set(key, guestName);
    }

    for (const gc of guestContactsRows ?? []) {
      const name = (gc as { guest_name?: string }).guest_name?.trim();
      if (!name) continue;
      const key = normalizeKey(name);
      if (!seen.has(key)) seen.set(key, name);
    }

    let names = Array.from(seen.values()).sort((a, b) => a.localeCompare(b));

    const settingsMap = new Map((gcSettings ?? []).map((r) => [(r as { key: string }).key, (r as { value: unknown }).value]));
    const producerScoped = settingsMap.get("guest_contacts_producer_scoped") === true;

    if (producerScoped && profile.role === "submitter") {
      const visibleKeys = new Set<string>();
      for (const r of producerVisibleGuests ?? []) {
        const k = normalizeKey(r.guest_name ?? "");
        if (k) visibleKeys.add(k);
      }
      for (const r of producerVisibleInvitations ?? []) {
        const k = normalizeKey((r as { guest_name?: string }).guest_name ?? "");
        if (k) visibleKeys.add(k);
      }
      names = names.filter((n) => visibleKeys.has(normalizeKey(n)));
    }

    return NextResponse.json({ names });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
