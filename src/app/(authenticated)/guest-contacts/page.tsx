import { requirePageAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterAndSortContacts } from "@/lib/guest-contacts-utils";
import { GuestContactsClient } from "./GuestContactsClient";
import { fetchGuestContacts } from "@/lib/guest-contacts-fetch";
import { getCached, setCache } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;
const CACHE_TTL = 300;

export default async function GuestContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; filterBy?: string; dateFilter?: string; deptFilter?: string; progFilter?: string; favoriteFilter?: string; titleFilter?: string; topicFilter?: string; sortBy?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);
  const filterParams = {
    search: sp?.search ?? "",
    filterBy: sp?.filterBy ?? "all",
    dateFilter: sp?.dateFilter ?? "all",
    deptFilter: sp?.deptFilter ?? "all",
    progFilter: sp?.progFilter ?? "all",
    favoriteFilter: sp?.favoriteFilter === "true" ? true : sp?.favoriteFilter === "false" ? false : null,
    titleFilter: sp?.titleFilter ?? "all",
    topicFilter: sp?.topicFilter ?? "all",
    sortBy: sp?.sortBy ?? "name",
  };
  const { profile } = await requirePageAccess("guest_contacts");
  const supabase = createAdminClient();
  const INVOICE_LIMIT = 2000;

  let departments = getCached<{ id: string; name: string }[]>("departments");
  let programs = getCached<{ id: string; name: string; department_id: string }[]>("programs");
  if (!departments) {
    const { data } = await supabase.from("departments").select("id, name");
    departments = data ?? [];
    setCache("departments", departments, CACHE_TTL);
  }
  if (!programs) {
    const { data } = await supabase.from("programs").select("id, name, department_id");
    programs = data ?? [];
    setCache("programs", programs, CACHE_TTL);
  }

  const [
    { data: invoices },
    guestContactsRows,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, service_description, generated_invoice_data, created_at, department_id, program_id, invoice_extracted_fields(raw_json)")
      .neq("invoice_type", "freelancer")
      .neq("invoice_type", "guest_contact_scan")
      .order("created_at", { ascending: false })
      .limit(INVOICE_LIMIT),
    fetchGuestContacts(filterParams.search),
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
    title_category: string | null;
    topic: string | null;
    topic_category: string | null;
    phone: string | null;
    email: string | null;
    invoice_id: string | null;
    created_at: string;
    last_appearance_date: string;
    appearance_count: number;
    department_name: string | null;
    program_name: string | null;
    organization: string | null;
    bio: string | null;
    photo_url: string | null;
    ai_contact_info: AiContactInfo;
    ai_assessment: string | null;
    guest_contact_id?: string;
    is_favorite?: boolean;
    tags?: string[];
    affiliated_orgs?: string[];
    prohibited_topics?: string[];
    conflict_of_interest_notes?: string | null;
    last_invited_at?: string | null;
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
    const topic = fromMeta(meta, ["topic", "description", "service description"]) || null;
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
      title_category: null,
      topic: topic || null,
      topic_category: null,
      phone: phone || null,
      email: email || null,
      invoice_id: inv.id,
      created_at: inv.created_at,
      last_appearance_date: inv.created_at,
      appearance_count: 1,
      department_name,
      program_name,
      organization: null,
      bio: null,
      photo_url: null,
      ai_contact_info: null,
      ai_assessment: null,
    });
  }

  const seen = new Map<string, Row>();
  function normalizeKey(s: string): string {
    return s.toLowerCase().trim().replace(/\s+/g, " ");
  }
  for (const r of rows) {
    const key = normalizeKey(r.guest_name);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...r });
    } else {
      const existingDate = new Date(existing.last_appearance_date).getTime();
      const rDate = new Date(r.last_appearance_date).getTime();
      const count = (existing.appearance_count ?? 0) + 1;
      if (rDate > existingDate) {
        seen.set(key, {
          ...existing,
          last_appearance_date: r.last_appearance_date,
          appearance_count: count,
          department_name: r.department_name ?? existing.department_name,
          program_name: r.program_name ?? existing.program_name,
          topic: r.topic ?? existing.topic,
          topic_category: r.topic_category ?? existing.topic_category,
          invoice_id: r.invoice_id ?? existing.invoice_id,
          created_at: r.created_at,
        });
      } else {
        seen.set(key, {
          ...existing,
          appearance_count: count,
          department_name: existing.department_name ?? r.department_name,
          program_name: existing.program_name ?? r.program_name,
          topic: existing.topic ?? r.topic,
          topic_category: existing.topic_category ?? r.topic_category,
        });
      }
    }
  }

  function findMatchingKey(gcKey: string): string | undefined {
    const n = normalizeKey(gcKey);
    if (seen.has(n)) return n;
    const gcParts = n.split(/\s+/).filter(Boolean);
    const gcFirstLast = gcParts.length >= 2 ? `${gcParts[0]} ${gcParts[gcParts.length - 1]}` : n;
    for (const seenKey of Array.from(seen.keys())) {
      const seenNorm = normalizeKey(seenKey);
      const seenParts = seenNorm.split(/\s+/).filter(Boolean);
      const seenFirstLast = seenParts.length >= 2 ? `${seenParts[0]} ${seenParts[seenParts.length - 1]}` : seenNorm;
      if (gcFirstLast === seenFirstLast || n.includes(seenNorm) || seenNorm.includes(n)) return seenKey;
    }
    return undefined;
  }

  for (const gc of guestContactsRows ?? []) {
    const key = normalizeKey(gc.guest_name ?? "");
    if (!key) continue;
    const gcId = (gc as { id?: string }).id ?? null;
    const gcData = gc as { ai_contact_info?: AiContactInfo; ai_assessment?: string | null; is_favorite?: boolean; tags?: string[]; title_category?: string | null; topic_category?: string | null; affiliated_orgs?: string[]; prohibited_topics?: string[]; conflict_of_interest_notes?: string | null; organization?: string | null; bio?: string | null; photo_url?: string | null; last_invited_at?: string | null };
    const matchKey = findMatchingKey(key);
    const existing = matchKey ? seen.get(matchKey) : undefined;
    const aiInfo = gcData.ai_contact_info ?? null;
    const aiAssessment = gcData.ai_assessment ?? null;
    const merged: Row = {
      guest_name: gc.guest_name ?? "",
      title: existing?.title ?? gc.title ?? null,
      title_category: gcData.title_category ?? existing?.title_category ?? null,
      topic: existing?.topic ?? (gc as { topic?: string | null }).topic ?? null,
      topic_category: gcData.topic_category ?? existing?.topic_category ?? null,
      phone: (existing?.phone || gc.phone) ?? null,
      email: (existing?.email || gc.email) ?? null,
      invoice_id: (existing?.invoice_id as string) || null,
      created_at: existing?.created_at ?? gc.updated_at ?? "",
      last_appearance_date: existing?.last_appearance_date ?? gc.updated_at ?? "",
      appearance_count: existing?.appearance_count ?? 0,
      department_name: existing?.department_name ?? null,
      program_name: existing?.program_name ?? null,
      organization: gcData.organization ?? existing?.organization ?? null,
      bio: gcData.bio ?? existing?.bio ?? null,
      photo_url: gcData.photo_url ?? existing?.photo_url ?? null,
      ai_contact_info: aiInfo ?? (existing?.ai_contact_info ?? null),
      ai_assessment: aiAssessment ?? (existing?.ai_assessment ?? null),
      guest_contact_id: gcId ?? existing?.guest_contact_id ?? undefined,
      is_favorite: gcData.is_favorite ?? existing?.is_favorite ?? false,
      tags: (gcData.tags?.length ? gcData.tags : existing?.tags) ?? [],
      affiliated_orgs: gcData.affiliated_orgs ?? existing?.affiliated_orgs ?? [],
      prohibited_topics: gcData.prohibited_topics ?? existing?.prohibited_topics ?? [],
      conflict_of_interest_notes: gcData.conflict_of_interest_notes ?? existing?.conflict_of_interest_notes ?? null,
      last_invited_at: gcData.last_invited_at ?? existing?.last_invited_at ?? null,
    };
    if (!existing) {
      seen.set(key, { ...merged, phone: gc.phone ?? null, email: gc.email ?? null, invoice_id: null, guest_contact_id: gcId ?? undefined, title_category: gcData.title_category ?? null, topic_category: gcData.topic_category ?? null, appearance_count: 0 });
    } else {
      const updateKey = matchKey ?? key;
      seen.set(updateKey, {
        ...merged,
        guest_name: existing.guest_name,
        last_appearance_date: existing.last_appearance_date,
        appearance_count: existing.appearance_count,
        department_name: existing.department_name,
        program_name: existing.program_name,
      });
    }
  }

  const allContacts = Array.from(seen.values()).sort((a, b) =>
    a.guest_name.localeCompare(b.guest_name)
  );

  const filtered = filterAndSortContacts(allContacts, filterParams);
  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedContacts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filteredContacts = filtered;

  const departmentNames = Array.from(new Set(allContacts.map((c) => c.department_name).filter(Boolean))) as string[];
  const programNames = Array.from(new Set(allContacts.map((c) => c.program_name).filter(Boolean))) as string[];
  const titleNames = Array.from(new Set(allContacts.map((c) => (c.title_category?.trim() || c.title?.trim() || "")).filter(Boolean))).sort();
  const topicNames = Array.from(new Set(allContacts.map((c) => (c.topic_category?.trim() || c.topic?.trim() || "")).filter(Boolean))).sort();
  const hasEmptyTitle = allContacts.some((c) => !(c.title?.trim()));
  const hasEmptyTopic = allContacts.some((c) => !(c.topic?.trim()));
  const similarNames = (() => {
    const seen = new Map<string, string[]>();
    for (const c of allContacts) {
      const key = c.guest_name.toLowerCase().replace(/\s+/g, " ").trim();
      const parts = key.split(/\s+/);
      const short = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : key;
      if (!seen.has(short)) seen.set(short, []);
      const arr = seen.get(short)!;
      if (!arr.includes(c.guest_name)) arr.push(c.guest_name);
    }
    return Array.from(seen.values()).filter((arr) => arr.length > 1);
  })();

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <GuestContactsClient
        contacts={paginatedContacts}
        filteredContacts={filteredContacts}
        totalCount={totalCount}
        page={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        filterParams={filterParams}
        departments={departmentNames}
        programs={programNames}
        titles={titleNames}
        topics={topicNames}
        hasEmptyTitle={hasEmptyTitle}
        hasEmptyTopic={hasEmptyTopic}
        similarNames={similarNames}
        isAdmin={profile.role === "admin"}
      />
    </div>
  );
}
