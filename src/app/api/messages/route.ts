/**
 * List messages for the current user (inbox + sent).
 * Query: ?folder=inbox|sent|all (default: all)
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "all";
    const conversationWith = searchParams.get("conversation_with");

    const supabase = createAdminClient();

    let query = supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, created_at, read_at, invoice_id")
      .limit(200);

    if (conversationWith) {
      const [r1, r2] = await Promise.all([
        supabase
          .from("messages")
          .select("id, sender_id, recipient_id, content, created_at, read_at, invoice_id")
          .eq("sender_id", userId)
          .eq("recipient_id", conversationWith)
          .order("created_at", { ascending: true })
          .limit(200),
        supabase
          .from("messages")
          .select("id, sender_id, recipient_id, content, created_at, read_at, invoice_id")
          .eq("sender_id", conversationWith)
          .eq("recipient_id", userId)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);
      const merged = [
        ...(r1.data ?? []),
        ...(r2.data ?? []),
      ].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const userIds = Array.from(
        new Set(merged.flatMap((r) => [r.sender_id, r.recipient_id]))
      );
      const { data: profiles } =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", userIds)
          : { data: [] };
      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
          p.id,
          p.full_name || p.id,
        ])
      );
      const invoiceIds = Array.from(
        new Set(merged.map((r) => r.invoice_id).filter(Boolean) as string[])
      );
      const invoiceMap: Record<string, { invoice_number: string }> = {};
      if (invoiceIds.length > 0) {
        const { data: invRows } = await supabase
          .from("invoice_extracted_fields")
          .select("invoice_id, invoice_number")
          .in("invoice_id", invoiceIds);
        for (const inv of invRows ?? []) {
          invoiceMap[inv.invoice_id] = {
            invoice_number: (inv.invoice_number as string) ?? String(inv.invoice_id).slice(0, 8),
          };
        }
      }
      const enriched = merged.map((r) => ({
        ...r,
        sender_name: profileMap[r.sender_id] ?? r.sender_id,
        recipient_name: profileMap[r.recipient_id] ?? r.recipient_id,
        is_from_me: r.sender_id === userId,
        is_to_me: r.recipient_id === userId,
        invoice_display:
          r.invoice_id && invoiceMap[r.invoice_id]
            ? invoiceMap[r.invoice_id].invoice_number
            : r.invoice_id
              ? String(r.invoice_id).slice(0, 8)
              : null,
      }));
      return NextResponse.json(enriched);
    }

    query = query.order("created_at", { ascending: false });
    if (folder === "inbox") {
      query = query.eq("recipient_id", userId);
    } else if (folder === "sent") {
      query = query.eq("sender_id", userId);
    } else {
      query = query.or(`recipient_id.eq.${userId},sender_id.eq.${userId}`);
    }

    const { data: rows, error } = await query;

    if (error) throw error;

    const userIds = Array.from(
      new Set((rows ?? []).flatMap((r) => [r.sender_id, r.recipient_id]))
    );
    const { data: profiles } =
      userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", userIds)
        : { data: [] };
    const profileMap = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
        p.id,
        p.full_name || p.id,
      ])
    );

    const invoiceIds = Array.from(
      new Set((rows ?? []).map((r) => r.invoice_id).filter(Boolean) as string[])
    );
    const invoiceMap: Record<string, { invoice_number: string }> = {};
    if (invoiceIds.length > 0) {
      const { data: invRows } = await supabase
        .from("invoice_extracted_fields")
        .select("invoice_id, invoice_number")
        .in("invoice_id", invoiceIds);
      for (const inv of invRows ?? []) {
        invoiceMap[inv.invoice_id] = {
          invoice_number: (inv.invoice_number as string) ?? String(inv.invoice_id).slice(0, 8),
        };
      }
    }

    const enriched = (rows ?? []).map((r) => ({
      ...r,
      sender_name: profileMap[r.sender_id] ?? r.sender_id,
      recipient_name: profileMap[r.recipient_id] ?? r.recipient_id,
      is_from_me: r.sender_id === userId,
      is_to_me: r.recipient_id === userId,
      invoice_display:
        r.invoice_id && invoiceMap[r.invoice_id]
          ? invoiceMap[r.invoice_id].invoice_number
          : r.invoice_id
            ? String(r.invoice_id).slice(0, 8)
            : null,
    }));

    return NextResponse.json(enriched);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const userId = session.user.id;
    const body = (await request.json()) as {
      recipient_id: string;
      content: string;
      invoice_id?: string | null;
    };

    if (!body.recipient_id || !body.content?.trim()) {
      return NextResponse.json(
        { error: "recipient_id and content are required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: recipient } = await supabase
      .from("profiles")
      .select("id, is_active")
      .eq("id", body.recipient_id)
      .single();

    if (!recipient || !(recipient as { is_active?: boolean }).is_active) {
      return NextResponse.json(
        { error: "Recipient not found or inactive" },
        { status: 400 }
      );
    }

    const insertPayload: Record<string, unknown> = {
      sender_id: userId,
      recipient_id: body.recipient_id,
      content: body.content.trim(),
    };
    if (body.invoice_id) {
      insertPayload.invoice_id = body.invoice_id;
    }
    const { data, error } = await supabase
      .from("messages")
      .insert(insertPayload)
      .select("id, sender_id, recipient_id, content, created_at, read_at, invoice_id")
      .single();

    if (error) throw error;

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    return NextResponse.json({
      ...data,
      sender_name: prof?.full_name || userId,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
