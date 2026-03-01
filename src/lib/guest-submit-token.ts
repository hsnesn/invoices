/**
 * Create or reuse a guest invoice submit token for a producer_guest.
 * Returns the full URL for the guest to submit their invoice.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type ProgramOverride = {
  program_name: string;
  recording_date: string;
  recording_topic: string;
  payment_amount: number;
  payment_currency?: string | null;
};

export async function getOrCreateGuestSubmitLink(
  supabase: SupabaseClient,
  producerGuestId: string,
  programOverride?: ProgramOverride
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  if (!programOverride) {
    const { data: existing } = await supabase
      .from("guest_invoice_submit_tokens")
      .select("token")
      .eq("producer_guest_id", producerGuestId)
      .is("used_at", null)
      .is("program_name", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.token) {
      return `${APP_URL}/submit/guest/${(existing as { token: string }).token}`;
    }
  }

  const insertPayload: Record<string, unknown> = {
    producer_guest_id: producerGuestId,
    expires_at: expiresAt.toISOString(),
  };
  if (programOverride) {
    insertPayload.program_name = programOverride.program_name;
    insertPayload.recording_date = programOverride.recording_date;
    insertPayload.recording_topic = programOverride.recording_topic;
    insertPayload.payment_amount = programOverride.payment_amount;
    if (programOverride.payment_currency != null && programOverride.payment_currency !== "") {
      insertPayload.payment_currency = programOverride.payment_currency;
    }
  }

  const { data: inserted, error } = await supabase
    .from("guest_invoice_submit_tokens")
    .insert(insertPayload)
    .select("token")
    .single();

  if (error || !inserted) {
    throw new Error("Failed to create submit link");
  }

  return `${APP_URL}/submit/guest/${(inserted as { token: string }).token}`;
}
