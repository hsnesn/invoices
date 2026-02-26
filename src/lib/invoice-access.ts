/**
 * Shared invoice access control. Used by API routes and pages.
 */

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

function producerNameMatches(invoiceProducer: string | null, userFullName: string | null): boolean {
  if (!invoiceProducer || !userFullName) return false;
  return invoiceProducer.trim().toLowerCase() === userFullName.trim().toLowerCase();
}

export type SupabaseAdmin = Awaited<ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>>;

/**
 * Check if a user can access an invoice (view, download PDF, files, notes, etc.).
 * Producers can see invoices where they are the producer (e.g. admin uploaded on their behalf).
 */
export async function canAccessInvoice(
  supabase: SupabaseAdmin,
  invoiceId: string,
  userId: string,
  overrideProfile?: { role: string; department_id: string | null; program_ids: string[] | null; full_name?: string | null }
): Promise<boolean> {
  const profile = overrideProfile ?? await (async () => {
    const { data } = await supabase
      .from("profiles")
      .select("role, department_id, program_ids, full_name")
      .eq("id", userId)
      .eq("is_active", true)
      .single();
    return data;
  })();

  if (!profile) return false;
  if (profile.role === "admin" || profile.role === "operations" || profile.role === "viewer") return true;

  const { data: invoice } = await supabase
    .from("invoices")
    .select("submitter_user_id, service_description, department_id, program_id")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return false;
  if (invoice.submitter_user_id === userId) return true;

  // Producer: see invoices where they are the producer (admin uploaded on their behalf)
  const userFullName = overrideProfile?.full_name ?? (profile as { full_name?: string | null }).full_name ?? null;
  if (userFullName) {
    const producer = parseProducerFromServiceDesc(invoice.service_description ?? null);
    if (producerNameMatches(producer, userFullName)) return true;
  }

  const { data: wf } = await supabase
    .from("invoice_workflows")
    .select("manager_user_id, status")
    .eq("invoice_id", invoiceId)
    .single();

  if (profile.role === "manager") {
    return wf?.manager_user_id === userId;
  }

  if (profile.role === "finance") {
    return wf?.status
      ? ["ready_for_payment", "paid", "archived"].includes(wf.status)
      : false;
  }

  const { data: or } = await supabase.from("operations_room_members").select("id").eq("user_id", userId).single();
  if (or) return true;

  return false;
}
