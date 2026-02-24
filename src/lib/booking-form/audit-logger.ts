import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditStatus = "pending" | "processing" | "completed" | "failed";

export type AuditRecord = {
  id: string;
  invoice_id: string;
  approver_user_id: string;
  approved_at: string;
  idempotency_key: string;
  email_a_sent_at: string | null;
  email_b_sent_at: string | null;
  status: AuditStatus;
  errors: string | null;
  created_at: string;
};

export function buildIdempotencyKey(invoiceId: string, approvedAt: Date): string {
  return `${invoiceId}_${approvedAt.toISOString()}`;
}

export async function checkIdempotency(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<AuditRecord | null> {
  const { data } = await supabase
    .from("booking_form_email_audit")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (data && (data as AuditRecord).status === "completed") {
    return data as AuditRecord;
  }
  return null;
}

export async function createAuditRecord(
  supabase: SupabaseClient,
  params: {
    invoiceId: string;
    approverUserId: string;
    approvedAt: Date;
    idempotencyKey: string;
  }
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("booking_form_email_audit")
    .insert({
      invoice_id: params.invoiceId,
      approver_user_id: params.approverUserId,
      approved_at: params.approvedAt.toISOString(),
      idempotency_key: params.idempotencyKey,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "duplicate" };
    return { error: error.message };
  }
  return { id: data.id };
}

export async function updateAuditRecord(
  supabase: SupabaseClient,
  auditId: string,
  params: {
    emailASentAt?: Date | null;
    emailBSentAt?: Date | null;
    status: AuditStatus;
    errors?: string | null;
  }
): Promise<void> {
  const update: Record<string, unknown> = {
    status: params.status,
    errors: params.errors ?? null,
  };
  if (params.emailASentAt !== undefined) update.email_a_sent_at = params.emailASentAt?.toISOString() ?? null;
  if (params.emailBSentAt !== undefined) update.email_b_sent_at = params.emailBSentAt?.toISOString() ?? null;
  await supabase.from("booking_form_email_audit").update(update).eq("id", auditId);
}
