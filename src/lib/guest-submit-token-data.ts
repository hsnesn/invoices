/**
 * Validate guest invoice submit token and return guest details.
 * Used by both the API route and the server-rendered page to avoid loading flash for used/expired links.
 */
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GuestSubmitData = {
  guest_name: string;
  email: string | null;
  title: string | null;
  program_name: string | null;
  recording_date: string | null;
  recording_topic: string | null;
  payment_received: boolean | null;
  payment_amount: number | null;
  payment_currency: string | null;
  department_id: string | null;
  program_id: string | null;
};

export type TokenResult =
  | { ok: true; data: GuestSubmitData }
  | { ok: false; error: string; status: 400 | 404 | 410 | 500; expiresAt?: string; errorType?: "expired" | "used" };

export async function getGuestSubmitTokenData(token: string): Promise<TokenResult> {
  try {
    if (!token || !UUID_RE.test(token)) {
      return { ok: false, error: "Invalid link", status: 400 };
    }

    const supabase = createAdminClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("guest_invoice_submit_tokens")
      .select("id, producer_guest_id, expires_at, used_at, program_name, recording_date, recording_topic, payment_amount, payment_currency, title")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return { ok: false, error: "Link not found or expired", status: 404 };
    }

    const usedAt = (tokenRow as { used_at?: string | null }).used_at;
    const expiresAtStr = (tokenRow as { expires_at: string }).expires_at;
    if (usedAt) {
      return { ok: false, error: "This link has already been used", status: 410, errorType: "used" };
    }

    const expiresAt = new Date(expiresAtStr);
    if (expiresAt < new Date()) {
      return { ok: false, error: "This link has expired", status: 410, expiresAt: expiresAtStr, errorType: "expired" };
    }

    const guestId = (tokenRow as { producer_guest_id: string }).producer_guest_id;
    const { data: guest, error: guestErr } = await supabase
      .from("producer_guests")
      .select(`
        id,
        guest_name,
        email,
        title,
        program_name,
        recording_date,
        recording_topic,
        payment_received,
        payment_amount,
        payment_currency,
        producer_user_id
      `)
      .eq("id", guestId)
      .single();

    if (guestErr || !guest) {
      return { ok: false, error: "Guest not found", status: 404 };
    }

    const g = guest as {
      guest_name: string;
      email: string | null;
      title: string | null;
      program_name: string | null;
      recording_date: string | null;
      recording_topic: string | null;
      payment_received: boolean | null;
      payment_amount: number | null;
      payment_currency: string | null;
      producer_user_id: string;
    };

    const t = tokenRow as {
      program_name?: string | null;
      recording_date?: string | null;
      recording_topic?: string | null;
      payment_amount?: number | null;
      payment_currency?: string | null;
      title?: string | null;
    };
    const programName = (t.program_name?.trim() || g.program_name?.trim()) ?? null;
    const recordingDate = t.recording_date ?? g.recording_date;
    const recordingTopic = t.recording_topic ?? g.recording_topic;
    const paymentAmount = t.payment_amount ?? g.payment_amount;
    const paymentCurrency = t.payment_currency ?? g.payment_currency;
    const title = (t.title ?? g.title)?.trim() || g.title;

    let deptId: string | null = null;
    let progId: string | null = null;
    if (programName?.trim()) {
      const { data: programs } = await supabase.from("programs").select("id, name, department_id");
      const match = (programs ?? []).find((p) => (p.name ?? "").toLowerCase() === programName!.toLowerCase());
      if (match) {
        progId = match.id;
        deptId = match.department_id;
      }
    }

    return {
      ok: true,
      data: {
        guest_name: g.guest_name,
        email: g.email,
        title: title ?? g.title,
        program_name: programName,
        recording_date: recordingDate,
        recording_topic: recordingTopic,
        payment_received: g.payment_received,
        payment_amount: paymentAmount,
        payment_currency: paymentCurrency,
        department_id: deptId,
        program_id: progId,
      },
    };
  } catch {
    return { ok: false, error: "Failed to load", status: 500 };
  }
}
