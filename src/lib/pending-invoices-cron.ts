/**
 * Cron logic: SLA reminders and pending digest emails.
 * - SLA: Send reminder to managers when invoices exceed X days in pending_manager
 * - Digest: Send daily/weekly summary of pending invoices to each manager
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSlaReminderEmail, sendPendingDigestEmail, type PendingInvoiceItem } from "@/lib/email";
import { filterUserIdsByEmailPreference } from "@/lib/email-settings";
import { parseGuestNameFromServiceDesc } from "@/lib/guest-utils";

type CronResult = { slaReminders: number; digestEmails: number; errors: string[] };

async function getSetting(key: string, defaultValue: number): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).single();
  if (!data?.value) return defaultValue;
  const v = data.value;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "value" in v) return (v as { value: number }).value as number;
  return defaultValue;
}

function buildPendingItem(
  inv: { id: string; service_description?: string | null; invoice_type?: string },
  extracted: { gross_amount?: number | null; extracted_currency?: string | null; invoice_number?: string | null } | null,
  fl: { contractor_name?: string | null; company_name?: string | null } | null,
  pendingSince: string | null
): PendingInvoiceItem {
  const daysPending = pendingSince
    ? Math.floor((Date.now() - new Date(pendingSince).getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const guestOrContractor =
    (inv as { invoice_type?: string }).invoice_type === "freelancer"
      ? (fl?.company_name || fl?.contractor_name || "—") as string
      : (parseGuestNameFromServiceDesc(inv.service_description) || "—");
  const amount =
    extracted?.gross_amount != null
      ? `${extracted.extracted_currency ?? "£"}${Number(extracted.gross_amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
      : "—";
  return {
    invoiceId: inv.id,
    invoiceNumber: extracted?.invoice_number ?? undefined,
    guestOrContractor,
    amount,
    daysPending,
  };
}

export async function runSlaReminders(): Promise<CronResult> {
  const result: CronResult = { slaReminders: 0, digestEmails: 0, errors: [] };
  const supabase = createAdminClient();

  const slaDays = await getSetting("manager_sla_days", 5);
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - slaDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: workflows } = await supabase
    .from("invoice_workflows")
    .select("invoice_id, manager_user_id, pending_manager_since")
    .eq("status", "pending_manager")
    .not("manager_user_id", "is", null);

  if (!workflows?.length) return result;

  const overdueByManager = new Map<string, { invoiceId: string; pendingSince: string | null }[]>();
  for (const wf of workflows) {
    const since = (wf as { pending_manager_since?: string | null }).pending_manager_since;
    if (!since || since <= cutoffStr) {
      const mid = (wf as { manager_user_id: string }).manager_user_id;
      if (!mid) continue;
      const list = overdueByManager.get(mid) ?? [];
      list.push({ invoiceId: (wf as { invoice_id: string }).invoice_id, pendingSince: since ?? null });
      overdueByManager.set(mid, list);
    }
  }

  const invoiceIds = Array.from(new Set(workflows.map((w) => (w as { invoice_id: string }).invoice_id)));
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, service_description, invoice_type")
    .in("id", invoiceIds);
  const { data: extracted } = await supabase
    .from("invoice_extracted_fields")
    .select("invoice_id, gross_amount, extracted_currency, invoice_number")
    .in("invoice_id", invoiceIds);
  const { data: fl } = await supabase
    .from("freelancer_invoice_fields")
    .select("invoice_id, contractor_name, company_name")
    .in("invoice_id", invoiceIds);

  const invMap = new Map((invoices ?? []).map((i) => [i.id, i]));
  const extMap = new Map((extracted ?? []).map((e) => [(e as { invoice_id: string }).invoice_id, e]));
  const flMap = new Map((fl ?? []).map((f) => [(f as { invoice_id: string }).invoice_id, f]));

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map<string, string>();
  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, (p as { full_name?: string }).full_name]));

  for (const u of authUsers?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  for (const [managerId, list] of Array.from(overdueByManager.entries())) {
    const filtered = await filterUserIdsByEmailPreference([managerId]);
    if (!filtered.includes(managerId)) continue;
    const managerEmail = emailMap.get(managerId);
    if (!managerEmail) continue;

    const items: PendingInvoiceItem[] = list.map(({ invoiceId, pendingSince }) => {
      const inv = invMap.get(invoiceId);
      const ext = extMap.get(invoiceId);
      const flRow = flMap.get(invoiceId);
      return buildPendingItem(inv ?? { id: invoiceId }, ext ?? null, flRow ?? null, pendingSince);
    });

    try {
      await sendSlaReminderEmail({
        managerEmail,
        managerName: nameMap.get(managerId) ?? undefined,
        slaDays,
        items,
      });
      result.slaReminders++;
    } catch (e) {
      result.errors.push(`SLA reminder to ${managerEmail}: ${(e as Error).message}`);
    }
  }

  return result;
}

export async function runPendingDigest(): Promise<CronResult> {
  const result: CronResult = { slaReminders: 0, digestEmails: 0, errors: [] };
  const supabase = createAdminClient();

  const { data: workflows } = await supabase
    .from("invoice_workflows")
    .select("invoice_id, manager_user_id, pending_manager_since")
    .eq("status", "pending_manager")
    .not("manager_user_id", "is", null);

  if (!workflows?.length) return result;

  const byManager = new Map<string, { invoiceId: string; pendingSince: string | null }[]>();
  for (const wf of workflows) {
    const mid = (wf as { manager_user_id: string }).manager_user_id;
    if (!mid) continue;
    const list = byManager.get(mid) ?? [];
    list.push({
      invoiceId: (wf as { invoice_id: string }).invoice_id,
      pendingSince: (wf as { pending_manager_since?: string | null }).pending_manager_since ?? null,
    });
    byManager.set(mid, list);
  }

  const invoiceIds = Array.from(new Set(workflows.map((w) => (w as { invoice_id: string }).invoice_id)));
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, service_description, invoice_type")
    .in("id", invoiceIds);
  const { data: extracted } = await supabase
    .from("invoice_extracted_fields")
    .select("invoice_id, gross_amount, extracted_currency, invoice_number")
    .in("invoice_id", invoiceIds);
  const { data: fl } = await supabase
    .from("freelancer_invoice_fields")
    .select("invoice_id, contractor_name, company_name")
    .in("invoice_id", invoiceIds);

  const invMap = new Map((invoices ?? []).map((i) => [i.id, i]));
  const extMap = new Map((extracted ?? []).map((e) => [(e as { invoice_id: string }).invoice_id, e]));
  const flMap = new Map((fl ?? []).map((f) => [(f as { invoice_id: string }).invoice_id, f]));

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map<string, string>();
  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, (p as { full_name?: string }).full_name]));

  for (const u of authUsers?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  const dow = new Date().getDay();
  const isMonday = dow === 1;
  const freqDays = await getSetting("pending_digest_frequency_days", 1);
  const shouldSendDigest = freqDays === 1 || (freqDays === 7 && isMonday);

  if (!shouldSendDigest) return result;

  const periodLabel = freqDays === 7 ? "Weekly" : "Daily";

  for (const [managerId, list] of Array.from(byManager.entries())) {
    const filtered = await filterUserIdsByEmailPreference([managerId]);
    if (!filtered.includes(managerId)) continue;
    const managerEmail = emailMap.get(managerId);
    if (!managerEmail) continue;

    const items: PendingInvoiceItem[] = list.map(({ invoiceId, pendingSince }) => {
      const inv = invMap.get(invoiceId);
      const ext = extMap.get(invoiceId);
      const flRow = flMap.get(invoiceId);
      return buildPendingItem(inv ?? { id: invoiceId }, ext ?? null, flRow ?? null, pendingSince);
    });

    try {
      await sendPendingDigestEmail({
        managerEmail,
        managerName: nameMap.get(managerId) ?? undefined,
        periodLabel,
        items,
      });
      result.digestEmails++;
    } catch (e) {
      result.errors.push(`Digest to ${managerEmail}: ${(e as Error).message}`);
    }
  }

  return result;
}
