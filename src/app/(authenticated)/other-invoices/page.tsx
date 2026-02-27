import { OtherInvoicesBoard } from "@/components/OtherInvoicesBoard";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function canAccessOtherInvoices(role: string, allowedPages: string[] | null): boolean {
  if (role === "admin" || role === "finance" || role === "operations") return true;
  if (role === "viewer" && allowedPages?.includes("other_invoices")) return true;
  return false;
}

export default async function OtherInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ expand?: string }>;
}) {
  const { session, profile } = await requireAuth();
  const { expand: expandId } = await searchParams;

  if (!canAccessOtherInvoices(profile.role, profile.allowed_pages ?? null)) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">You do not have permission to view Other Invoices.</p>
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("invoices")
    .select(`
      id,
      service_description,
      created_at,
      storage_path,
      submitter_user_id,
      invoice_workflows(status, paid_date, payment_reference),
      invoice_extracted_fields(beneficiary_name, invoice_number, invoice_date, gross_amount, extracted_currency, net_amount, vat_amount, account_number, sort_code, raw_json),
      invoice_files(storage_path, file_name)
    `)
    .eq("invoice_type", "other")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-red-600">Error</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{(error as Error).message}</p>
      </div>
    );
  }

  const list = rows ?? [];
  const submitterIds = Array.from(new Set(list.map((r) => (r as { submitter_user_id?: string }).submitter_user_id).filter((id): id is string => Boolean(id))));
  const { data: profiles } = submitterIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", submitterIds)
    : { data: [] };
  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || p.id])
  );

  const enriched = list.map((r) => {
    const sid = (r as { submitter_user_id?: string }).submitter_user_id;
    return { ...r, submitted_by: sid ? profileMap[sid] ?? sid : null };
  });

  const canUpload = profile.role === "admin" || profile.role === "finance" || profile.role === "operations";

  return (
    <OtherInvoicesBoard
      invoices={enriched as never[]}
      currentRole={profile.role}
      currentUserId={session.user.id}
      canUpload={canUpload}
      initialExpandedId={expandId ?? undefined}
    />
  );
}
