import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const body = await request.json();
    const { invoice_id, tags } = body as { invoice_id: string; tags: string[] };

    if (!invoice_id || !Array.isArray(tags)) {
      return NextResponse.json({ error: "invoice_id and tags[] required" }, { status: 400 });
    }

    const cleaned = Array.from(new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean)));

    const supabase = createAdminClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (!profile || !["admin", "manager", "operations", "submitter"].includes(profile.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error } = await supabase
      .from("invoices")
      .update({ tags: cleaned })
      .eq("id", invoice_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tags: cleaned });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAuth();
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("invoices")
      .select("tags")
      .not("tags", "eq", "{}");

    const allTags = new Set<string>();
    (data ?? []).forEach((row: { tags: string[] | null }) => {
      (row.tags ?? []).forEach((t: string) => allTags.add(t));
    });

    return NextResponse.json({ tags: Array.from(allTags).sort() });
  } catch {
    return NextResponse.json({ tags: [] });
  }
}
