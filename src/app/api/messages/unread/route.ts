/**
 * Get unread message count and recent unread messages for quick actions.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const supabase = createAdminClient();
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const withMessages = searchParams.get("list") === "true";

    const { data: unreadRows, count, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at, invoice_id", { count: "exact" })
      .eq("recipient_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(withMessages ? 10 : 1);

    if (error) throw error;

    if (!withMessages) {
      return NextResponse.json({ unread: count ?? 0 });
    }

    const senderIds = Array.from(new Set((unreadRows ?? []).map((r) => r.sender_id)));
    const { data: profiles } =
      senderIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
        : { data: [] };
    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name || p.id])
    );

    const invoiceIds = (unreadRows ?? []).map((r) => r.invoice_id).filter(Boolean) as string[];
    const invoiceMap: Record<string, { invoice_number: string; invoice_type: string }> = {};
    if (invoiceIds.length > 0) {
      const { data: invRows } = await supabase
        .from("invoices")
        .select("id, invoice_type")
        .in("id", invoiceIds);
      const { data: extRows } = await supabase
        .from("invoice_extracted_fields")
        .select("invoice_id, invoice_number")
        .in("invoice_id", invoiceIds);
      const extMap = Object.fromEntries(
        (extRows ?? []).map((e: { invoice_id: string; invoice_number: string | null }) => [
          e.invoice_id,
          (e.invoice_number as string) ?? e.invoice_id.slice(0, 8),
        ])
      );
      for (const inv of invRows ?? []) {
        invoiceMap[inv.id] = {
          invoice_number: extMap[inv.id] ?? inv.id.slice(0, 8),
          invoice_type: (inv.invoice_type as string) ?? "guest",
        };
      }
    }

    const list = (unreadRows ?? []).map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      sender_name: profileMap[r.sender_id] ?? r.sender_id,
      content: r.content.slice(0, 80) + (r.content.length > 80 ? "…" : ""),
      created_at: r.created_at,
      invoice_id: r.invoice_id,
      invoice_display: r.invoice_id ? invoiceMap[r.invoice_id]?.invoice_number ?? r.invoice_id.slice(0, 8) : null,
      invoice_type: r.invoice_id ? invoiceMap[r.invoice_id]?.invoice_type ?? null : null,
    }));

    return NextResponse.json({ unread: count ?? 0, messages: list });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ unread: 0, messages: [] });
  }
}
