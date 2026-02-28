import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Optimistic-locking wrapper for invoice_workflows updates.
 * Returns true if the update succeeded, false if version mismatch (concurrent edit).
 */
export async function updateWorkflowWithVersion(
  supabase: SupabaseClient,
  invoiceId: string,
  currentVersion: number,
  fields: Record<string, unknown>
): Promise<{ ok: boolean }> {
  const { data } = await supabase
    .from("invoice_workflows")
    .update({ ...fields, version: currentVersion + 1 })
    .eq("invoice_id", invoiceId)
    .eq("version", currentVersion)
    .select("invoice_id")
    .maybeSingle();

  return { ok: !!data };
}
