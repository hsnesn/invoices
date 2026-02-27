export type ContactForFilter = {
  guest_name: string;
  title: string | null;
  title_category?: string | null;
  topic: string | null;
  topic_category?: string | null;
  phone: string | null;
  email: string | null;
  last_appearance_date?: string;
  created_at: string;
  appearance_count?: number;
  department_name?: string | null;
  program_name?: string | null;
  ai_contact_info?: { phone?: string | null; email?: string | null } | null;
  is_favorite?: boolean;
  tags?: string[];
  invite_status?: "accepted" | "rejected" | "no_response" | "no_match" | null;
};

export type FilterParams = {
  search?: string;
  filterBy?: string;
  inviteFilter?: string;
  dateFilter?: string;
  deptFilter?: string;
  progFilter?: string;
  favoriteFilter?: boolean | null;
  titleFilter?: string;
  topicFilter?: string;
  sortBy?: string;
};

export function filterAndSortContacts<T extends ContactForFilter>(
  contacts: T[],
  params: FilterParams
): T[] {
  const {
    search = "",
    filterBy = "all",
    inviteFilter = "all",
    dateFilter = "all",
    deptFilter = "all",
    progFilter = "all",
    favoriteFilter = null,
    titleFilter = "all",
    topicFilter = "all",
    sortBy = "name",
  } = params;

  const now = new Date();
  const dateCutoff = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.getTime();
  };
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  return contacts
    .filter((c) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.guest_name.toLowerCase().includes(q) ||
        (c.title?.toLowerCase().includes(q) ?? false) ||
        (c.title_category?.toLowerCase().includes(q) ?? false) ||
        (c.topic?.toLowerCase().includes(q) ?? false) ||
        (c.topic_category?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false) ||
        (c.tags?.some((t) => t.toLowerCase().includes(q)) ?? false);
      if (!matchesSearch) return false;
      if (filterBy === "has_phone") return !!(c.phone || c.ai_contact_info?.phone);
      if (filterBy === "has_email") return !!(c.email || c.ai_contact_info?.email);
      if (filterBy === "has_ai") return !!c.ai_contact_info;
      if (filterBy === "missing_phone") return !c.phone && !c.ai_contact_info?.phone;
      if (filterBy === "missing_email") return !c.email && !c.ai_contact_info?.email;
      if (inviteFilter !== "all" && inviteFilter) {
        const status = c.invite_status;
        if (inviteFilter === "accepted" && status !== "accepted") return false;
        if (inviteFilter === "rejected" && status !== "rejected") return false;
        if (inviteFilter === "no_response" && status !== "no_response") return false;
        if (inviteFilter === "no_match" && status !== "no_match") return false;
      }
      if (dateFilter !== "all") {
        const d = c.last_appearance_date || c.created_at;
        if (!d) return false;
        const t = new Date(d).getTime();
        if (dateFilter === "7" && t < dateCutoff(7)) return false;
        if (dateFilter === "30" && t < dateCutoff(30)) return false;
        if (dateFilter === "90" && t < dateCutoff(90)) return false;
        if (dateFilter === "year" && t < startOfYear) return false;
      }
      if (deptFilter !== "all" && c.department_name !== deptFilter) return false;
      if (progFilter !== "all" && c.program_name !== progFilter) return false;
      if (titleFilter !== "all") {
        const contactTitle = (c.title_category?.trim() || c.title?.trim() || "") || "";
        const matchEmpty = titleFilter === "__empty__";
        if (matchEmpty && contactTitle !== "") return false;
        if (!matchEmpty && contactTitle !== titleFilter) return false;
      }
      if (topicFilter !== "all") {
        const contactTopic = (c.topic_category?.trim() || c.topic?.trim() || "") || "";
        const matchEmpty = topicFilter === "__empty__";
        if (matchEmpty && contactTopic !== "") return false;
        if (!matchEmpty && contactTopic !== topicFilter) return false;
      }
      if (favoriteFilter === true && !c.is_favorite) return false;
      if (favoriteFilter === false && c.is_favorite) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        const ta = (a.last_appearance_date || a.created_at) ? new Date(a.last_appearance_date || a.created_at).getTime() : 0;
        const tb = (b.last_appearance_date || b.created_at) ? new Date(b.last_appearance_date || b.created_at).getTime() : 0;
        return tb - ta;
      }
      if (sortBy === "usage") {
        const ca = a.appearance_count ?? 0;
        const cb = b.appearance_count ?? 0;
        if (cb !== ca) return cb - ca;
      }
      return a.guest_name.localeCompare(b.guest_name);
    });
}
