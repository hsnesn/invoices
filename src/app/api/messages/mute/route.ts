/**
 * Mute/unmute a conversation. GET: check muted, POST: mute, DELETE: unmute.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const peerId = request.nextUrl.searchParams.get("peer_id");
    if (!peerId) {
      return NextResponse.json({ error: "peer_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("conversation_mutes")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("peer_id", peerId)
      .maybeSingle();

    return NextResponse.json({ muted: !!data });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const peerId = request.nextUrl.searchParams.get("peer_id");
    if (!peerId) {
      return NextResponse.json({ error: "peer_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    await supabase.from("conversation_mutes").upsert(
      { user_id: session.user.id, peer_id: peerId },
      { onConflict: "user_id,peer_id" }
    );

    return NextResponse.json({ muted: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const peerId = request.nextUrl.searchParams.get("peer_id");
    if (!peerId) {
      return NextResponse.json({ error: "peer_id required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    await supabase
      .from("conversation_mutes")
      .delete()
      .eq("user_id", session.user.id)
      .eq("peer_id", peerId);

    return NextResponse.json({ muted: false });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
