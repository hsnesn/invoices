import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/types";

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
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, service_description, generated_invoice_data, created_at")
      .neq("invoice_type", "freelancer")
      .order("created_at", { ascending: false });

    const rows: { guest_name: string; title: string | null; phone: string | null; email: string | null; invoice_id: string; created_at: string }[] = [];

    for (const inv of invoices ?? []) {
      const meta = parseServiceDesc(inv.service_description);
      const gen = inv.generated_invoice_data as {
        guest_name?: string | null;
        guest_phone?: string | null;
        guest_email?: string | null;
        title?: string | null;
      } | null;

      const guestName =
        gen?.guest_name?.trim() ||
        fromMeta(meta, ["guest name", "guest", "guest_name"]) ||
        null;
      const title =
        gen?.title?.trim() ||
        fromMeta(meta, ["title", "programme title", "program title"]) ||
        null;
      const phone =
        gen?.guest_phone?.trim() ||
        fromMeta(meta, ["guest phone", "guest phone number", "phone"]) ||
        null;
      const email =
        gen?.guest_email?.trim() ||
        fromMeta(meta, ["guest email", "guest email address", "email"]) ||
        null;

      if (!guestName) continue;

      rows.push({
        guest_name: guestName,
        title,
        phone: phone || null,
        email: email || null,
        invoice_id: inv.id,
        created_at: inv.created_at,
      });
    }

    // Dedupe by guest_name, keep latest (first due to order)
    const seen = new Map<string, typeof rows[0]>();
    for (const r of rows) {
      const key = r.guest_name.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, r);
    }

    const result = Array.from(seen.values()).sort((a, b) =>
      a.guest_name.localeCompare(b.guest_name)
    );

    return NextResponse.json(result);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
