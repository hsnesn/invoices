/**
 * Create or reuse a guest invoice submit token for a producer_guest.
 * Returns the full URL for the guest to submit their invoice.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function getOrCreateGuestSubmitLink(
  supabase: SupabaseClient,
  producerGuestId: string
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data: existing } = await supabase
    .from("guest_invoice_submit_tokens")
    .select("token")
    .eq("producer_guest_id", producerGuestId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) {
    return `${APP_URL}/submit/guest/${(existing as { token: string }).token}`;
  }

  const { data: inserted, error } = await supabase
    .from("guest_invoice_submit_tokens")
    .insert({
      producer_guest_id: producerGuestId,
      expires_at: expiresAt.toISOString(),
    })
    .select("token")
    .single();

  if (error || !inserted) {
    throw new Error("Failed to create submit link");
  }

  return `${APP_URL}/submit/guest/${(inserted as { token: string }).token}`;
}
