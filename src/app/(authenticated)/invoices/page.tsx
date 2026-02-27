import { InvoicesBoard } from "@/components/InvoicesBoard";
import { requirePageAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseProducerFromServiceDesc(serviceDescription: string | null): string | null {
  if (!serviceDescription) return null;
  for (const line of serviceDescription.split("\n")) {
    const l = line.trim();
    if (l.toLowerCase().startsWith("producer:")) {
      const val = l.slice(l.indexOf(":") + 1).trim();
      return val || null;
    }
  }
  return null;
}

function canUserSeeInvoice(
  inv: {
    submitter_user_id: string;
    service_description?: string | null;
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
  userFullName: string | null
): boolean {
  if (role === "admin" || role === "viewer" || role === "operations") return true;
  if (inv.submitter_user_id === userId) return true;

  // Producer: see invoices where they are the producer (e.g. admin uploaded on their behalf)
  if (userFullName) {
    const producer = parseProducerFromServiceDesc(inv.service_description ?? null);
    if (producer && producer.trim().toLowerCase() === userFullName.trim().toLowerCase()) {
      return true;
    }
  }

  const wfRaw = inv.invoice_workflows;
  const wf = Array.isArray(wfRaw) ? wfRaw[0] : wfRaw;

  if (role === "manager") {
    return wf?.manager_user_id === userId;
  }

  if (role === "finance") {
    const status = wf?.status ?? "submitted";
    return ["ready_for_payment", "paid", "archived"].includes(status);
  }

  return false;
}

export default async function InvoicesPage() {
  const { session, profile } = await requirePageAccess("guest_invoices");
  const supabase = createAdminClient();

  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select(`
      id,
      storage_path,
      service_description,
      currency,
      created_at,
      service_date_from,
      service_date_to,
      department_id,
      program_id,
      previous_invoice_id,
      submitter_user_id,
      invoice_workflows(status, rejection_reason, manager_user_id, paid_date),
      invoice_extracted_fields(invoice_number, beneficiary_name, account_number, sort_code, gross_amount, extracted_currency, raw_json, needs_review),
      invoice_files(storage_path, file_name, sort_order)
    `)
    .in("invoice_type", ["guest", "salary"])
    .order("created_at", { ascending: false })
    .limit(500);

  const visibleInvoices = (invoicesRaw ?? []).filter((inv) =>
    canUserSeeInvoice(
      inv as never,
      session.user.id,
      profile.role,
      profile.department_id,
      profile.program_ids,
      profile.full_name ?? null
    )
  );

  const [{ data: departments }, { data: programs }, { data: profiles }, { data: producerColors }, { data: orMembers }] = await Promise.all([
    supabase.from("departments").select("id,name"),
    supabase.from("programs").select("id,name"),
    supabase.from("profiles").select("id,full_name,role"),
    supabase.from("producer_colors").select("producer_name,color_hex"),
    supabase.from("operations_room_members").select("user_id").eq("user_id", session.user.id).maybeSingle(),
  ]);

  const allProfiles = (profiles ?? []) as { id: string; full_name: string | null; role?: string }[];
  const profilePairs = allProfiles.map((p) => [p.id, p.full_name || p.id] as [string, string]);
  const managerProfilePairs = allProfiles
    .filter((p) => p.role === "manager")
    .map((p) => [p.id, p.full_name || p.id] as [string, string]);

  const producerColorsMap: Record<string, string> = {};
  (producerColors ?? []).forEach((r: { producer_name: string; color_hex: string }) => {
    producerColorsMap[r.producer_name] = r.color_hex;
  });

  const isOperationsRoomMember = !!orMembers || profile.role === "operations";

  return (
    <InvoicesBoard
      invoices={visibleInvoices as never[]}
      departmentPairs={(departments ?? []).map((d: { id: string; name: string }) => [d.id, d.name])}
      programPairs={(programs ?? []).map((p: { id: string; name: string }) => [p.id, p.name])}
      profilePairs={profilePairs}
      managerProfilePairs={managerProfilePairs}
      producerColorsMap={producerColorsMap}
      currentRole={profile.role}
      currentUserId={session.user.id}
      isOperationsRoomMember={isOperationsRoomMember}
    />
  );
}
