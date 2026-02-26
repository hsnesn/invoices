/**
 * Shared logic for assigning Dept EP (line manager) to guest invoices.
 * Program-specific overrides from Setup → Guest Invoices → Program-specific Dept EP.
 */

type SupabaseAdmin = Awaited<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>;

type ManagerProfile = { id: string; department_id: string | null; program_ids: string[] | null };

function pickManager(
  managers: ManagerProfile[],
  departmentId: string | null,
  programId: string | null
): string | null {
  if (!managers.length) return null;
  if (programId) {
    const byProgram = managers.find((m) => Array.isArray(m.program_ids) && m.program_ids.includes(programId));
    if (byProgram) return byProgram.id;
  }
  if (departmentId) {
    const byDepartment = managers.find((m) => m.department_id === departmentId);
    if (byDepartment) return byDepartment.id;
  }
  return managers[0].id;
}

/**
 * Resolve manager_user_id for a guest invoice.
 * Uses program_manager_overrides from Setup when program name matches (e.g. Newsmaker).
 */
export async function pickManagerForGuestInvoice(
  supabase: SupabaseAdmin,
  departmentId: string | null,
  programId: string | null
): Promise<string | null> {
  if (programId) {
    const { data: program } = await supabase
      .from("programs")
      .select("name")
      .eq("id", programId)
      .single();
    const programName = (program?.name ?? "").trim().toLowerCase();
    if (programName && programName.includes("newsmaker")) {
      const { data: override, error } = await supabase
        .from("program_manager_overrides")
        .select("manager_user_id")
        .eq("program_name_key", "newsmaker")
        .maybeSingle();
      if (!error && override?.manager_user_id) return override.manager_user_id;
    }
  }

  if (departmentId) {
    const { data: dm } = await supabase
      .from("department_managers")
      .select("manager_user_id")
      .eq("department_id", departmentId)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (dm?.manager_user_id) return dm.manager_user_id;
  }

  if (programId) {
    const { data: managerProfiles } = await supabase
      .from("profiles")
      .select("id,department_id,program_ids")
      .eq("role", "manager")
      .eq("is_active", true);
    return pickManager(
      (managerProfiles ?? []) as ManagerProfile[],
      departmentId,
      programId
    );
  }

  return null;
}
