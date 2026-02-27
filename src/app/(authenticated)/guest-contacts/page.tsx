import { requirePageAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GuestContactsClient } from "./GuestContactsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuestContactsPage() {
  const { profile } = await requirePageAccess("guest_contacts");
  const supabase = createAdminClient();
  const [{ data: invoices }, { data: guestContactsRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, service_description, generated_invoice_data, created_at, invoice_extracted_fields(raw_json)")
      .neq("invoice_type", "freelancer")
      .neq("invoice_type", "guest_contact_scan")
      .order("created_at", { ascending: false }),
    supabase.from("guest_contacts").select("id, guest_name, phone, email, title, ai_contact_info, ai_searched_at, updated_at").order("guest_name"),
  ]);

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

  type AiContactInfo = { phone?: string | null; email?: string | null; social_media?: string[] } | null;
  const rows: { guest_name: string; title: string | null; phone: string | null; email: string | null; invoice_id: string | null; created_at: string; ai_contact_info: AiContactInfo; guest_contact_id?: string }[] = [];

  for (const inv of invoices ?? []) {
    const meta = parseServiceDesc(inv.service_description);
    const gen = inv.generated_invoice_data as {
      guest_name?: string | null;
      guest_phone?: string | null;
      guest_email?: string | null;
      title?: string | null;
    } | null;
    const extRaw = (inv as { invoice_extracted_fields?: { raw_json?: Record<string, unknown> }[] | { raw_json?: Record<string, unknown> } | null }).invoice_extracted_fields;
    const ext = Array.isArray(extRaw) ? extRaw[0] : extRaw;
    const raw = ext?.raw_json ?? {};

    const guestName =
      gen?.guest_name?.trim() ||
      fromMeta(meta, ["guest name", "guest", "guest_name"]) ||
      (typeof raw.beneficiary_name === "string" ? raw.beneficiary_name.trim() : null) ||
      null;
    const title =
      gen?.title?.trim() ||
      fromMeta(meta, ["title", "programme title", "program title"]) ||
      null;
    const phone =
      gen?.guest_phone?.trim() ||
      fromMeta(meta, ["guest phone", "guest phone number", "phone"]) ||
      (typeof raw.guest_phone === "string" ? raw.guest_phone.trim() : null) ||
      null;
    const email =
      gen?.guest_email?.trim() ||
      fromMeta(meta, ["guest email", "guest email address", "email"]) ||
      (typeof raw.guest_email === "string" ? raw.guest_email.trim() : null) ||
      null;

    if (!guestName) continue;

    rows.push({
      guest_name: guestName,
      title,
      phone: phone || null,
      email: email || null,
      invoice_id: inv.id,
      created_at: inv.created_at,
      ai_contact_info: null,
    });
  }

  const seen = new Map<string, (typeof rows)[0]>();
  for (const r of rows) {
    const key = r.guest_name.toLowerCase().trim();
    if (!seen.has(key)) seen.set(key, r);
  }

  for (const gc of guestContactsRows ?? []) {
    const key = (gc.guest_name ?? "").toLowerCase().trim();
    if (!key) continue;
    const gcId = (gc as { id?: string }).id ?? null;
    const existing = seen.get(key);
    const aiInfo = (gc as { ai_contact_info?: AiContactInfo }).ai_contact_info ?? null;
    const merged = {
      guest_name: gc.guest_name ?? "",
      title: existing?.title ?? gc.title ?? null,
      phone: existing?.phone ?? gc.phone ?? null,
      email: existing?.email ?? gc.email ?? null,
      invoice_id: (existing?.invoice_id as string) || null,
      created_at: existing?.created_at ?? gc.updated_at ?? "",
      ai_contact_info: aiInfo,
      guest_contact_id: gcId ?? undefined,
    };
    if (!existing) {
      seen.set(key, { ...merged, phone: gc.phone ?? null, email: gc.email ?? null, invoice_id: null, guest_contact_id: gcId ?? undefined });
    } else if ((gc.phone && !existing.phone) || (gc.email && !existing.email) || aiInfo || gcId) {
      seen.set(key, {
        ...merged,
        phone: (merged.phone || gc.phone) ?? null,
        email: (merged.email || gc.email) ?? null,
        ai_contact_info: aiInfo ?? (existing as { ai_contact_info?: AiContactInfo }).ai_contact_info ?? null,
        guest_contact_id: gcId ?? (existing as { guest_contact_id?: string }).guest_contact_id ?? undefined,
      });
    }
  }

  const contacts = Array.from(seen.values()).sort((a, b) =>
    a.guest_name.localeCompare(b.guest_name)
  );

  return (
    <div className="mx-auto max-w-5xl p-6">
      <GuestContactsClient contacts={contacts} isAdmin={profile.role === "admin"} />
    </div>
  );
}
