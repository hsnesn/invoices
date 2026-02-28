/**
 * Producer's invited guests - list (producer sees own, admin sees all)
 * Matches with invoices to show accepted date; no match = yellow in UI
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import { parseGuestNameFromServiceDesc } from "@/lib/guest-utils";

function normalizeName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const isAdmin = profile.role === "admin";
    let query = supabase
      .from("producer_guests")
      .select("id, producer_user_id, guest_name, email, title, program_name, invited_at, accepted, matched_invoice_id, matched_at, payment_received, payment_amount, payment_currency, recording_date, recording_topic, notes, is_favorite, created_at")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("producer_user_id", session.user.id);
    }

    const { data: guests, error } = await query;
    if (error) throw error;

    const producerIds = Array.from(new Set((guests ?? []).map((r) => r.producer_user_id)));

    // Include guests from guest_invitations (invited via Guest Contacts bulk email) that are not in producer_guests
    let invQuery = supabase
      .from("guest_invitations")
      .select("producer_user_id, guest_name, guest_email, program_name, sent_at")
      .not("producer_user_id", "is", null)
      .order("sent_at", { ascending: false });
    if (!isAdmin) {
      invQuery = invQuery.eq("producer_user_id", session.user.id);
    }
    const { data: invitations } = await invQuery;

    const pgKeys = new Set(
      (guests ?? []).map((r) => `${r.producer_user_id}|${normalizeName(r.guest_name)}|${(r.email ?? "").toLowerCase()}`)
    );
    const seenInvKeys = new Set<string>();
    const extraFromInv: typeof guests = [];
    for (const inv of invitations ?? []) {
      const pid = (inv as { producer_user_id?: string | null }).producer_user_id;
      const gname = (inv as { guest_name?: string }).guest_name ?? "";
      const gemail = (inv as { guest_email?: string }).guest_email ?? "";
      if (!pid || !gname.trim()) continue;
      const key = `${pid}|${normalizeName(gname)}|${gemail.toLowerCase()}`;
      if (pgKeys.has(key) || seenInvKeys.has(key)) continue;
      seenInvKeys.add(key);
      extraFromInv.push({
        id: `inv-${(inv as { sent_at?: string }).sent_at}-${key}`,
        producer_user_id: pid,
        guest_name: gname,
        email: gemail,
        title: null,
        program_name: (inv as { program_name?: string }).program_name ?? null,
        invited_at: (inv as { sent_at?: string }).sent_at ?? null,
        accepted: null,
        matched_invoice_id: null,
        matched_at: null,
        payment_received: null,
        payment_amount: null,
        payment_currency: null,
        recording_date: null,
        recording_topic: null,
        notes: null,
        is_favorite: null,
        created_at: (inv as { sent_at?: string }).sent_at ?? new Date().toISOString(),
      } as (typeof guests)[number]);
    }
    const allGuests = [...(guests ?? []), ...extraFromInv].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const producerIdsAll = Array.from(new Set(allGuests.map((r) => r.producer_user_id)));
    const [{ data: producers }, { data: invoicesRaw }] = await Promise.all([
      producerIdsAll.length ? supabase.from("profiles").select("id, full_name").in("id", producerIdsAll) : { data: [] },
      supabase
        .from("invoices")
        .select("id, created_at, service_description, invoice_extracted_fields(raw_json)")
        .in("invoice_type", ["guest", "salary"])
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    const producerMap = new Map((producers ?? []).map((p) => [p.id, p.full_name || "Unknown"]));

    const invoiceGuestNames = new Map<string, { id: string; created_at: string }[]>();
    for (const inv of invoicesRaw ?? []) {
      const ext = (inv as { invoice_extracted_fields?: { raw_json?: { beneficiary_name?: string } }[] | { raw_json?: { beneficiary_name?: string } } }).invoice_extracted_fields;
      const raw = Array.isArray(ext) ? ext[0] : ext;
      const beneficiary = raw?.raw_json?.beneficiary_name;
      const guestName =
        parseGuestNameFromServiceDesc((inv as { service_description?: string }).service_description) ||
        (typeof beneficiary === "string" ? beneficiary.trim() : null);
      if (guestName) {
        const key = normalizeName(guestName);
        if (!invoiceGuestNames.has(key)) invoiceGuestNames.set(key, []);
        invoiceGuestNames.get(key)!.push({ id: inv.id, created_at: inv.created_at });
      }
    }

    const rows = allGuests.map((r) => {
      const key = normalizeName(r.guest_name);
      const invs = invoiceGuestNames.get(key) ?? [];
      const invitedAt = r.invited_at ? new Date(r.invited_at).getTime() : 0;
      const match = invs.find((i) => new Date(i.created_at).getTime() >= invitedAt);
      return {
        ...r,
        producer_name: producerMap.get(r.producer_user_id) ?? "—",
        matched_invoice_id: r.matched_invoice_id ?? match?.id ?? null,
        matched_at: r.matched_at ?? (match ? match.created_at : null),
      };
    });

    return NextResponse.json(rows);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, profile } = await requireAuth();
    const supabase = createAdminClient();

    const body = (await request.json()) as {
      guest_name: string;
      email?: string | null;
      title?: string | null;
      program_name?: string | null;
      accepted?: boolean | null;
    };

    const guestName = body.guest_name?.trim();
    if (!guestName || guestName.length < 2) {
      return NextResponse.json({ error: "Guest name is required (min 2 chars)" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("producer_guests")
      .insert({
        producer_user_id: session.user.id,
        guest_name: guestName,
        email: body.email?.trim() || null,
        title: body.title?.trim() || null,
        program_name: body.program_name?.trim() || null,
        accepted: body.accepted ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
