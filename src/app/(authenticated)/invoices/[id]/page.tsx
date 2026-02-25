import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { InvoiceDetail } from "@/components/InvoiceDetail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { session, profile } = await requireAuth();
  const supabase =
    process.env.DEV_BYPASS_AUTH === "true" ? createAdminClient() : await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *,
      invoice_workflows(*),
      invoice_extracted_fields(*)
    `)
    .eq("id", id)
    .single();

  if (!invoice) notFound();

  const wfCheck = Array.isArray(invoice.invoice_workflows)
    ? invoice.invoice_workflows[0]
    : invoice.invoice_workflows;
  const userId = session.user.id;
  const isOwner = invoice.submitter_user_id === userId;
  const isAssigned = wfCheck?.manager_user_id === userId;
  const isAdmin = profile.role === "admin";
  const isOperations = profile.role === "operations";
  const isFinance =
    profile.role === "finance" &&
    ["ready_for_payment", "paid", "archived"].includes(wfCheck?.status ?? "");
  const inDeptScope =
    profile.role === "manager" &&
    profile.department_id != null &&
    invoice.department_id === profile.department_id;
  const inProgScope =
    profile.role === "manager" &&
    (profile.program_ids ?? []).length > 0 &&
    invoice.program_id != null &&
    (profile.program_ids ?? []).includes(invoice.program_id);

  if (!isOwner && !isAssigned && !isAdmin && !isOperations && !isFinance && !inDeptScope && !inProgScope) {
    notFound();
  }

  const wf = Array.isArray(invoice.invoice_workflows)
    ? invoice.invoice_workflows[0]
    : invoice.invoice_workflows;
  const ext = Array.isArray(invoice.invoice_extracted_fields)
    ? invoice.invoice_extracted_fields[0]
    : invoice.invoice_extracted_fields;

  return (
    <InvoiceDetail
      invoice={invoice}
      workflow={wf}
      extracted={ext}
      profile={profile}
    />
  );
}
