import { requirePageAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GuestContactsClient } from "./GuestContactsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuestContactsPage() {
  const { profile } = await requirePageAccess("guest_contacts");
  const supabase = createAdminClient();
  const [
    { data: invoices },
    { data: guestContactsRows },
    { data: departments },
    { data: programs },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, service_description, generated_invoice_data, created_at, department_id, program_id, invoice_extracted_fields(raw_json)")
      .neq("invoice_type", "freelancer")
      .neq("invoice_type", "guest_contact_scan")
      .order("created_at", { ascending: false }),
    supabase.from("guest_contacts").select("id, guest_name, phone, email, title, ai_contact_info, ai_searched_at, updated_at, is_favorite, tags").order("guest_name"),
    supabase.from("departments").select("id, name"),
    supabase.from("programs").select("id, name, department_id"),
  ]);

  const deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const progMap = new Map((programs ?? []).map((p) => [p.id, p.name]));

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
  type Row = {
    guest_name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    invoice_id: string | null;
    created_at: string;
    last_appearance_date: string;
    department_name: string | null;
    program_name: string | null;
    ai_contact_info: AiContactInfo;
    guest_contact_id?: string;
    is_favorite?: boolean;
    tags?: string[];
  };
  const rows: Row[] = [];

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

    const invTyped = inv as { department_id?: string; program_id?: string };
    const department_name = invTyped.department_id ? deptMap.get(invTyped.department_id) ?? null : null;
    const program_name = invTyped.program_id ? progMap.get(invTyped.program_id) ?? null : null;

    rows.push({
      guest_name: guestName,
      title,
      phone: phone || null,
      email: email || null,
      invoice_id: inv.id,
      created_at: inv.created_at,
      last_appearance_date: inv.created_at,
      department_name,
      program_name,
      ai_contact_info: null,
    });
  }

  const seen = new Map<string, Row>();
  for (const r of rows) {
    const key = r.guest_name.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...r });
    } else {
      const existingDate = new Date(existing.last_appearance_date).getTime();
      const rDate = new Date(r.last_appearance_date).getTime();
      if (rDate > existingDate) {
        seen.set(key, {
          ...existing,
          last_appearance_date: r.last_appearance_date,
          department_name: r.department_name ?? existing.department_name,
          program_name: r.program_name ?? existing.program_name,
          invoice_id: r.invoice_id ?? existing.invoice_id,
          created_at: r.created_at,
        });
      } else {
        seen.set(key, {
          ...existing,
          department_name: existing.department_name ?? r.department_name,
          program_name: existing.program_name ?? r.program_name,
        });
      }
    }
  }

  function findMatchingKey(gcKey: string): string | undefined {
    if (seen.has(gcKey)) return gcKey;
    const gcParts = gcKey.split(/\s+/).filter(Boolean);
    const gcFirstLast = gcParts.length >= 2 ? `${gcParts[0]} ${gcParts[gcParts.length - 1]}` : gcKey;
    for (const seenKey of Array.from(seen.keys())) {
      const seenParts = seenKey.split(/\s+/).filter(Boolean);
      const seenFirstLast = seenParts.length >= 2 ? `${seenParts[0]} ${seenParts[seenParts.length - 1]}` : seenKey;
      if (gcFirstLast === seenFirstLast || gcKey.includes(seenKey) || seenKey.includes(gcKey)) return seenKey;
    }
    return undefined;
  }

  for (const gc of guestContactsRows ?? []) {
    const key = (gc.guest_name ?? "").toLowerCase().trim();
    if (!key) continue;
    const gcId = (gc as { id?: string }).id ?? null;
    const gcData = gc as { ai_contact_info?: AiContactInfo; is_favorite?: boolean; tags?: string[] };
    const matchKey = findMatchingKey(key);
    const existing = matchKey ? seen.get(matchKey) : undefined;
    const aiInfo = gcData.ai_contact_info ?? null;
    const merged: Row = {
      guest_name: gc.guest_name ?? "",
      title: existing?.title ?? gc.title ?? null,
      phone: (existing?.phone || gc.phone) ?? null,
      email: (existing?.email || gc.email) ?? null,
      invoice_id: (existing?.invoice_id as string) || null,
      created_at: existing?.created_at ?? gc.updated_at ?? "",
      last_appearance_date: existing?.last_appearance_date ?? gc.updated_at ?? "",
      department_name: existing?.department_name ?? null,
      program_name: existing?.program_name ?? null,
      ai_contact_info: aiInfo ?? (existing?.ai_contact_info ?? null),
      guest_contact_id: gcId ?? existing?.guest_contact_id ?? undefined,
      is_favorite: gcData.is_favorite ?? existing?.is_favorite ?? false,
      tags: (gcData.tags?.length ? gcData.tags : existing?.tags) ?? [],
    };
    if (!existing) {
      seen.set(key, { ...merged, phone: gc.phone ?? null, email: gc.email ?? null, invoice_id: null, guest_contact_id: gcId ?? undefined });
    } else {
      const updateKey = matchKey ?? key;
      seen.set(updateKey, {
        ...merged,
        guest_name: existing.guest_name,
        last_appearance_date: existing.last_appearance_date,
        department_name: existing.department_name,
        program_name: existing.program_name,
      });
    }
  }

  const contacts = Array.from(seen.values()).sort((a, b) =>
    a.guest_name.localeCompare(b.guest_name)
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <GuestContactsClient contacts={contacts} isAdmin={profile.role === "admin"} />
    </div>
  );
}
