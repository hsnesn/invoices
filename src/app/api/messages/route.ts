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

    const supabase = createAdminClient();

    let query = supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(100);

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

    const enriched = (rows ?? []).map((r) => ({
      ...r,
      sender_name: profileMap[r.sender_id] ?? r.sender_id,
      recipient_name: profileMap[r.recipient_id] ?? r.recipient_id,
      is_from_me: r.sender_id === userId,
      is_to_me: r.recipient_id === userId,
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

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: userId,
        recipient_id: body.recipient_id,
        content: body.content.trim(),
      })
      .select("id, sender_id, recipient_id, content, created_at, read_at")
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
