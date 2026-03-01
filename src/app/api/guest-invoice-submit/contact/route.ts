/**
 * Get producer contact info for a submit token (when link is expired or used).
 * Allows error page to show "Contact [Producer] at [email]".
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { batchGetUserEmails } from "@/lib/email-settings";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();

    if (!token || !UUID_RE.test(token)) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("guest_invoice_submit_tokens")
      .select("producer_guest_id")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const { data: guest, error: guestErr } = await supabase
      .from("producer_guests")
      .select("guest_name, program_name, producer_user_id")
      .eq("id", (tokenRow as { producer_guest_id: string }).producer_guest_id)
      .single();

    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const g = guest as { producer_user_id: string };
    const producerEmailMap = await batchGetUserEmails([g.producer_user_id]);
    const producerEmail = producerEmailMap.get(g.producer_user_id)?.trim();

    const { data: producerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", g.producer_user_id)
      .single();
    const producerName = producerProfile?.full_name?.trim() || "The Producer";

    return NextResponse.json({
      producerName,
      producerEmail: producerEmail || null,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
