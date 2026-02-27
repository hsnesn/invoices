/**
 * Get a signed download URL for a message attachment.
 * Query: ?path=user_id/timestamp-file.ext
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BUCKET = "message-attachments";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const path = request.nextUrl.searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "path required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600); // 1 hour

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ url: data?.signedUrl ?? null });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
