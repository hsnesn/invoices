import { FreelancerBoard } from "@/components/FreelancerBoard";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function canUserSeeInvoice(
  inv: {
    submitter_user_id: string;
    department_id: string | null;
    program_id: string | null;
    invoice_workflows:
      | { status: string; manager_user_id: string | null }
      | { status: string; manager_user_id: string | null }[]
      | null;
  },
  userId: string,
  role: string,
  userDepartmentId: string | null,
  userProgramIds: string[] | null,
  isOperationsRoomMember: boolean
): boolean {
  if (role === "admin" || role === "viewer" || role === "operations") return true;
  if (isOperationsRoomMember) return true;
  if (inv.submitter_user_id === userId) return true;

  const wfRaw = inv.invoice_workflows;
  const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw;

  if (role === "manager") {
    if (wf?.manager_user_id === userId) return true;
    if (userDepartmentId && inv.department_id === userDepartmentId) return true;
    if (userProgramIds?.length && inv.program_id && userProgramIds.includes(inv.program_id))
      return true;
    return false;
  }

  if (role === "finance") {
    const status = wf?.status ?? "submitted";
    return ["ready_for_payment", "paid", "archived"].includes(status);
  }

  return false;
}

export default async function FreelancerInvoicesPage() {
  const { session, profile } = await requireAuth();
  const supabase = createAdminClient();

  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select(`
      id,
      service_description,
      currency,
      created_at,
      service_date_from,
      service_date_to,
      department_id,
      program_id,
      submitter_user_id,
      invoice_type,
      invoice_workflows(status, rejection_reason, manager_user_id, paid_date),
      invoice_extracted_fields(invoice_number, beneficiary_name, account_number, sort_code, gross_amount, extracted_currency),
      freelancer_invoice_fields(contractor_name, company_name, service_description, service_days_count, service_days, service_rate_per_day, service_month, additional_cost, additional_cost_reason, booked_by, department_2, istanbul_team)
    `)
    .eq("invoice_type", "freelancer")
    .order("created_at", { ascending: false })
    .limit(500);

  const [{ data: departments }, { data: profiles }, { data: orMembers }] = await Promise.all([
    supabase.from("departments").select("id,name"),
    supabase.from("profiles").select("id,full_name,role"),
    supabase.from("operations_room_members").select("user_id").eq("user_id", session.user.id).maybeSingle(),
  ]);

  const isOperationsRoomMember = !!orMembers || profile.role === "operations";

  const visibleInvoicesFiltered = (invoicesRaw ?? []).filter((inv) =>
    canUserSeeInvoice(
      inv as never,
      session.user.id,
      profile.role,
      profile.department_id,
      profile.program_ids,
      isOperationsRoomMember
    )
  );

  const allProfiles = (profiles ?? []) as { id: string; full_name: string | null; role?: string }[];
  const profilePairs = allProfiles.map((p) => [p.id, p.full_name || p.id] as [string, string]);
  const managerProfilePairs = allProfiles
    .filter((p) => p.role === "manager" || p.role === "admin")
    .map((p) => [p.id, p.full_name || p.id] as [string, string]);

  return (
    <FreelancerBoard
      invoices={visibleInvoicesFiltered as never[]}
      departmentPairs={(departments ?? []).map((d: { id: string; name: string }) => [d.id, d.name])}
      profilePairs={profilePairs}
      managerProfilePairs={managerProfilePairs}
      currentRole={profile.role}
      currentUserId={session.user.id}
      isOperationsRoomMember={isOperationsRoomMember}
    />
  );
}
