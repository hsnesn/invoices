/**
 * Limit producers to 5 guest invoice link sends per day.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_LINKS_PER_DAY = 5;

function startOfDayUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Check if producer can send more links today. Returns { ok: true, count } or { ok: false, count }.
 *  Pass producerUserId: the guest's producer (for quota), not necessarily the current user. */
export async function checkGuestInvoiceLinkLimit(
  supabase: SupabaseClient,
  producerUserId: string
): Promise<{ ok: boolean; count: number }> {
  const { count, error } = await supabase
    .from("guest_invoice_link_sends")
    .select("*", { count: "exact", head: true })
    .eq("producer_user_id", producerUserId)
    .gte("created_at", startOfDayUTC());

  if (error) {
    console.error("[guest-invoice-link-limit] Check failed:", error);
    return { ok: true, count: 0 };
  }

  const n = count ?? 0;
  return { ok: n < MAX_LINKS_PER_DAY, count: n };
}

/** Record a link send. Call after successfully sending. */
export async function recordGuestInvoiceLinkSend(
  supabase: SupabaseClient,
  producerUserId: string
): Promise<void> {
  await supabase.from("guest_invoice_link_sends").insert({
    producer_user_id: producerUserId,
  });
}

/** Check if producer can send N more links today. For bulk operations. */
export async function canSendGuestInvoiceLinks(
  supabase: SupabaseClient,
  producerUserId: string,
  toSend: number
): Promise<boolean> {
  const { count } = await checkGuestInvoiceLinkLimit(supabase, producerUserId);
  return count + toSend <= MAX_LINKS_PER_DAY;
}
