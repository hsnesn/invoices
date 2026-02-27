/**
 * Upload a file attachment for a message. Returns storage path and filename.
 * Call this before POST /api/messages; include attachment_path and attachment_name in the body.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BUCKET = "message-attachments";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
    "text/csv": "csv",
  };
  return map[mime] ?? "bin";
}

export async function POST(request: NextRequest) {
  try {
    const { session } = await requireAuth();
    const userId = session.user.id;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }
    const mime = (file.type || "application/octet-stream").toLowerCase();
    if (!ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json(
        { error: "Invalid type. Use PDF, images, Word, Excel, or text." },
        { status: 400 }
      );
    }

    const ext = extFromMime(mime);
    const safeName = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const stem = safeName.replace(/\.[^.]+$/, "") || "file";
    const storagePath = `${userId}/${Date.now()}-${stem}.${ext}`;

    const supabase = createAdminClient();

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_SIZE,
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mime, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({
      attachment_path: storagePath,
      attachment_name: file.name || `${stem}.${ext}`,
    });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
