import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();

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

  const invoiceType = (invoice as { invoice_type?: string }).invoice_type;
  const isOtherInvoice = invoiceType === "other";
  const canAccessOther =
    isOtherInvoice &&
    (["admin", "finance", "operations"].includes(profile.role) ||
      (profile.role === "viewer" && profile.allowed_pages?.includes("other_invoices")));

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
  const isProducer = (() => {
    const desc = (invoice as { service_description?: string | null }).service_description;
    if (!desc || !profile.full_name) return false;
    for (const line of desc.split("\n")) {
      const l = line.trim();
      if (l.toLowerCase().startsWith("producer:")) {
        const val = l.slice(l.indexOf(":") + 1).trim();
        return val.trim().toLowerCase() === profile.full_name.trim().toLowerCase();
      }
    }
    return false;
  })();

  if (!isOwner && !isAssigned && !isAdmin && !isOperations && !isFinance && !isProducer && !canAccessOther) {
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
