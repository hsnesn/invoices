/**
 * Office request attachments: list and upload.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BUCKET = "office-request-attachments";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file";
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await context.params;

    const supabase = createAdminClient();
    const { data: req, error: fetchErr } = await supabase
      .from("office_requests")
      .select("id, requester_user_id")
      .eq("id", id)
      .single();

    if (fetchErr || !req) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const canAccess = (req as { requester_user_id: string }).requester_user_id === session.user.id ||
      profile.role === "admin" || profile.role === "operations";
    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: attachments, error } = await supabase
      .from("office_request_attachments")
      .select("id, file_name, storage_path, created_at")
      .eq("office_request_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const withUrls = await Promise.all((attachments ?? []).map(async (a) => {
      const path = (a as { storage_path: string }).storage_path;
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      const { storage_path: _, ...rest } = a as { storage_path: string };
      return { ...rest, download_url: signed?.signedUrl ?? null };
    }));

    return NextResponse.json(withUrls);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, profile } = await requireAuth();
    const { id } = await context.params;

    const supabase = createAdminClient();
    const { data: req, error: fetchErr } = await supabase
      .from("office_requests")
      .select("id, requester_user_id")
      .eq("id", id)
      .single();

    if (fetchErr || !req) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const canUpload = (req as { requester_user_id: string }).requester_user_id === session.user.id ||
      profile.role === "admin" || profile.role === "operations";
    if (!canUpload) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "File type not allowed" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const attachmentId = crypto.randomUUID();
    const storagePath = `${id}/${attachmentId}-${safeFileName(file.name)}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) throw uploadErr;

    const { data: att, error: insertErr } = await supabase
      .from("office_request_attachments")
      .insert({
        office_request_id: id,
        storage_path: storagePath,
        file_name: file.name,
      })
      .select()
      .single();

    if (insertErr) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw insertErr;
    }

    return NextResponse.json(att);
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
