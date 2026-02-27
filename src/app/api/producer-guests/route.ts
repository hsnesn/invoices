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
      .select("id, producer_user_id, guest_name, email, title, program_name, invited_at, accepted, matched_invoice_id, matched_at, created_at")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("producer_user_id", session.user.id);
    }

    const { data: guests, error } = await query;
    if (error) throw error;

    const producerIds = Array.from(new Set((guests ?? []).map((r) => r.producer_user_id)));
    const [{ data: producers }, { data: invoicesRaw }] = await Promise.all([
      producerIds.length ? supabase.from("profiles").select("id, full_name").in("id", producerIds) : { data: [] },
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

    const rows = (guests ?? []).map((r) => {
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
