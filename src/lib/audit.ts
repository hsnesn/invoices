import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditPayload {
  [key: string]: unknown;
}

export async function createAuditEvent(params: {
  invoice_id?: string | null;
  actor_user_id: string | null;
  event_type: string;
  from_status?: string | null;
  to_status?: string | null;
  payload?: AuditPayload;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_events").insert({
    invoice_id: params.invoice_id ?? null,
    actor_user_id: params.actor_user_id,
    event_type: params.event_type,
    from_status: params.from_status ?? null,
    to_status: params.to_status ?? null,
    payload: params.payload ?? {},
  });
  if (error) {
    console.error("Audit event insert failed:", error);
  }
}
