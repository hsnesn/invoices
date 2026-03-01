/**
 * Validate guest invoice submit token and return guest details for the form.
 * Public endpoint - no auth required.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("guest_invoice_submit_tokens")
      .select("id, producer_guest_id, expires_at, used_at")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Link not found or expired" }, { status: 404 });
    }

    const usedAt = (tokenRow as { used_at?: string | null }).used_at;
    if (usedAt) {
      return NextResponse.json({ error: "This link has already been used" }, { status: 410 });
    }

    const expiresAt = new Date((tokenRow as { expires_at: string }).expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 });
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
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
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

    let deptId: string | null = null;
    let progId: string | null = null;
    if (g.program_name?.trim()) {
      const { data: programs } = await supabase.from("programs").select("id, name, department_id");
      const match = (programs ?? []).find((p) => (p.name ?? "").toLowerCase() === g.program_name!.toLowerCase());
      if (match) {
        progId = match.id;
        deptId = match.department_id;
      }
    }

    return NextResponse.json({
      guest_name: g.guest_name,
      email: g.email,
      title: g.title,
      program_name: g.program_name,
      recording_date: g.recording_date,
      recording_topic: g.recording_topic,
      payment_received: g.payment_received,
      payment_amount: g.payment_amount,
      payment_currency: g.payment_currency,
      department_id: deptId,
      program_id: progId,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
