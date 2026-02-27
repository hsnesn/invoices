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
    const searchQ = searchParams.get("q")?.trim().toLowerCase();

    const supabase = createAdminClient();

    let query = supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, created_at, read_at, invoice_id, parent_message_id, attachment_path, attachment_name")
      .limit(200);

    if (conversationWith) {
      const [r1, r2] = await Promise.all([
        supabase
          .from("messages")
          .select("id, sender_id, recipient_id, content, created_at, read_at, invoice_id, parent_message_id, attachment_path, attachment_name")
          .eq("sender_id", userId)
          .eq("recipient_id", conversationWith)
          .order("created_at", { ascending: true })
          .limit(200),
        supabase
          .from("messages")
          .select("id, sender_id, recipient_id, content, created_at, read_at, invoice_id, parent_message_id, attachment_path, attachment_name")
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
            (e.invoice_number as string) ?? String(e.invoice_id).slice(0, 8),
          ])
        );
        for (const inv of invRows ?? []) {
          invoiceMap[inv.id] = {
            invoice_number: extMap[inv.id] ?? String(inv.id).slice(0, 8),
            invoice_type: (inv.invoice_type as string) ?? "guest",
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
        invoice_type: r.invoice_id && invoiceMap[r.invoice_id] ? invoiceMap[r.invoice_id].invoice_type : null,
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
    if (searchQ) {
      query = query.ilike("content", `%${searchQ}%`);
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
          (e.invoice_number as string) ?? String(e.invoice_id).slice(0, 8),
        ])
      );
      for (const inv of invRows ?? []) {
        invoiceMap[inv.id] = {
          invoice_number: extMap[inv.id] ?? String(inv.id).slice(0, 8),
          invoice_type: (inv.invoice_type as string) ?? "guest",
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
      invoice_type: r.invoice_id && invoiceMap[r.invoice_id] ? invoiceMap[r.invoice_id].invoice_type : null,
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
      parent_message_id?: string | null;
      attachment_path?: string | null;
      attachment_name?: string | null;
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
    if (body.invoice_id) insertPayload.invoice_id = body.invoice_id;
    if (body.parent_message_id) insertPayload.parent_message_id = body.parent_message_id;
    if (body.attachment_path) insertPayload.attachment_path = body.attachment_path;
    if (body.attachment_name) insertPayload.attachment_name = body.attachment_name;
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
