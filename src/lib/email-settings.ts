/**
 * Email settings: templates, stage toggles, user preferences.
 * Used when sending invoice emails. Booking form emails are always sent.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export const EMAIL_STAGE_KEYS = [
  "submission",
  "manager_approved",
  "manager_rejected",
  "ready_for_payment",
  "paid",
  "manager_assigned",
  "resubmitted",
  "admin_approved",
] as const;

export type EmailStageKey = (typeof EMAIL_STAGE_KEYS)[number];

export type EmailTemplateRow = {
  template_key: string;
  subject_template: string | null;
  body_template: string | null;
  variables: string[];
};

export type EmailStageRow = {
  stage_key: string;
  enabled: boolean;
};

export type RecipientType = "submitter" | "dept_ep" | "admin" | "finance" | "operations" | "producers";

/** Check if a recipient type is enabled for a stage. Default true if no row exists or table missing. */
export async function isRecipientEnabled(stageKey: string, recipientType: RecipientType): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("email_recipient_settings")
      .select("enabled")
      .eq("stage_key", stageKey)
      .eq("recipient_type", recipientType)
      .maybeSingle();
    if (error) return true;
    return data?.enabled !== false;
  } catch {
    return true;
  }
}

/** Check if emails for this stage should be sent. */
export async function isEmailStageEnabled(stageKey: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("email_stage_settings")
    .select("enabled")
    .eq("stage_key", stageKey)
    .single();
  return data?.enabled !== false;
}

/** Filter recipient list: remove users who opted out of invoice emails. */
export async function filterRecipientsByPreference(
  userIds: string[],
  options?: { forceInclude?: boolean }
): Promise<string[]> {
  if (options?.forceInclude) return userIds;
  if (!userIds.length) return [];
  const supabase = createAdminClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, receive_invoice_emails")
    .in("id", userIds);
  return (profiles ?? [])
    .filter((p) => (p as { receive_invoice_emails?: boolean }).receive_invoice_emails !== false)
    .map((p) => p.id);
}

/** Batch fetch emails for multiple user IDs using listUsers. */
async function batchGetUserEmails(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const supabase = createAdminClient();
  const result = new Map<string, string>();
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const idSet = new Set(userIds);
  for (const u of data?.users ?? []) {
    if (idSet.has(u.id) && u.email) result.set(u.id, u.email);
  }
  return result;
}

/** Get emails for user IDs, filtering out those who opted out. */
export async function getFilteredEmailsForUserIds(userIds: string[]): Promise<string[]> {
  const allowed = await filterRecipientsByPreference(userIds);
  if (!allowed.length) return [];
  const emailMap = await batchGetUserEmails(allowed);
  return allowed.map((id) => emailMap.get(id)).filter((e): e is string => !!e);
}

/** Batch fetch user emails by IDs (no preference filtering). */
export { batchGetUserEmails };

/** Alias for filterRecipientsByPreference. */
export const filterUserIdsByEmailPreference = filterRecipientsByPreference;

/** Check if a single user wants to receive invoice update emails. */
export async function userWantsUpdateEmails(userId: string): Promise<boolean> {
  const allowed = await filterRecipientsByPreference([userId]);
  return allowed.length > 0;
}

/** Filter email addresses: keep only those whose user has receive_invoice_emails = true. */
export async function filterEmailsByPreference(
  emailToUserId: Map<string, string>,
  options?: { forceInclude?: boolean }
): Promise<string[]> {
  if (options?.forceInclude) return Array.from(emailToUserId.keys());
  const userIds = Array.from(emailToUserId.values());
  const allowed = await filterRecipientsByPreference(userIds);
  const allowedSet = new Set(allowed);
  return Array.from(emailToUserId.entries())
    .filter(([, uid]) => allowedSet.has(uid))
    .map(([email]) => email);
}

/** Get custom template if set, else null (caller uses built-in). */
export async function getEmailTemplate(
  templateKey: string
): Promise<{ subject: string | null; body: string | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("email_templates")
    .select("subject_template, body_template")
    .eq("template_key", templateKey)
    .single();
  if (!data) return null;
  if (data.subject_template == null && data.body_template == null) return null;
  return {
    subject: data.subject_template,
    body: data.body_template,
  };
}

/** Replace placeholders in template. */
export function applyTemplateVars(
  text: string,
  vars: Record<string, string | undefined>
): string {
  let out = text;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val ?? "");
  }
  return out;
}
