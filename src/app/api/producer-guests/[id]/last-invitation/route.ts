/**
 * Get last invitation details for a producer guest (record_date, program_name).
 * Used to pre-fill the acceptance modal.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await params;
    const supabase = createAdminClient();

    const isAdmin = profile.role === "admin";
    let query = supabase
      .from("producer_guests")
      .select("id, producer_user_id, guest_name, email")
      .eq("id", id);
    if (!isAdmin) query = query.eq("producer_user_id", session.user.id);
    const { data: guest, error: guestErr } = await query.single();
    if (guestErr || !guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const guestNameNorm = (guest.guest_name ?? "").trim().toLowerCase();
    const { data: invitations } = await supabase
      .from("guest_invitations")
      .select("record_date, record_time, program_name, topic, format, studio_address, guest_name")
      .eq("producer_user_id", guest.producer_user_id)
      .order("sent_at", { ascending: false })
      .limit(20);
    const inv = (invitations ?? []).find(
      (i) => (i as { guest_name?: string }).guest_name?.trim().toLowerCase() === guestNameNorm
    );

    const recordDate = (inv as { record_date?: string })?.record_date?.trim();
    const recordTime = (inv as { record_time?: string })?.record_time?.trim();
    const programName = (inv as { program_name?: string })?.program_name?.trim();
    const topic = (inv as { topic?: string })?.topic?.trim();
    const format = (inv as { format?: string })?.format as "remote" | "studio" | undefined;
    const studioAddress = (inv as { studio_address?: string })?.studio_address?.trim();

    return NextResponse.json({
      record_date: recordDate && /^\d{4}-\d{2}-\d{2}$/.test(recordDate) ? recordDate : null,
      record_time: recordTime || null,
      program_name: programName || null,
      program_specific_topic: topic || null,
      format: format === "remote" || format === "studio" ? format : null,
      studio_address: studioAddress || null,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
