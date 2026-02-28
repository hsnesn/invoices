/**
 * Helper to get merged requirements (explicit + recurring) for a month.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMergedRequirements(
  supabase: SupabaseClient,
  start: string,
  end: string,
  departmentId?: string | null,
  programId?: string | null
): Promise<{ date: string; role: string; count_needed: number }[]> {
  const [y, m] = start.split("-").map(Number);

  let explicitQuery = supabase
    .from("contractor_availability_requirements")
    .select("date, role, count_needed")
    .gte("date", start)
    .lte("date", end);
  if (departmentId) {
    explicitQuery = explicitQuery.eq("department_id", departmentId);
    if (programId) {
      explicitQuery = explicitQuery.eq("program_id", programId);
    } else {
      explicitQuery = explicitQuery.is("program_id", null);
    }
  }
  const { data: explicitData } = await explicitQuery;

  let recurringQuery = supabase
    .from("contractor_availability_recurring")
    .select("day_of_week, role, count_needed");
  if (departmentId) {
    recurringQuery = recurringQuery.eq("department_id", departmentId);
    if (programId) {
      recurringQuery = recurringQuery.eq("program_id", programId);
    } else {
      recurringQuery = recurringQuery.is("program_id", null);
    }
  }
  const { data: recurringData } = await recurringQuery;
  const recurring = (recurringData ?? []) as { day_of_week: number; role: string; count_needed: number }[];

  const byKey = new Map<string, number>();
  for (const r of explicitData ?? []) {
    byKey.set(`${(r as { date: string }).date}|${(r as { role: string }).role}`, (r as { count_needed: number }).count_needed);
  }

  for (let d = new Date(y, m - 1, 1); d <= new Date(y, m, 0); d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    for (const rec of recurring) {
      if (rec.day_of_week !== dow) continue;
      const key = `${dateStr}|${rec.role}`;
      if (!byKey.has(key)) byKey.set(key, rec.count_needed);
    }
  }

  return Array.from(byKey.entries()).map(([key, count_needed]) => {
    const [date, role] = key.split("|");
    return { date, role, count_needed };
  });
}
