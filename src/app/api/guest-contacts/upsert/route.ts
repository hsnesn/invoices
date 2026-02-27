import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { profile } = await requireAuth();
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = (await request.json()) as {
      guest_name?: string;
      phone?: string | null;
      email?: string | null;
      title?: string | null;
    };

    const guestName = body.guest_name?.trim();
    if (!guestName || guestName.length < 2) {
      return NextResponse.json({ error: "guest_name is required (min 2 chars)" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const key = guestName.toLowerCase().trim();
    const { data: existing } = await supabase
      .from("guest_contacts")
      .select("id")
      .eq("guest_name_key", key)
      .maybeSingle();

    const payload = {
      guest_name: guestName,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      title: body.title?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data, error } = await supabase
        .from("guest_contacts")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from("guest_contacts")
      .insert({ ...payload, source: "manual" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
