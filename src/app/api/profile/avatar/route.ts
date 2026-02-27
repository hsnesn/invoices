/**
 * Profile avatar upload. Stores in avatars bucket: {user_id}/avatar.{ext}
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
    }
    const mime = file.type?.toLowerCase();
    if (!ALLOWED_TYPES.includes(mime)) {
      return NextResponse.json({ error: "Invalid type. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    const storagePath = `${userId}/avatar.${ext}`;

    const supabase = createAdminClient();

    // Ensure bucket exists (create if not)
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
      if (bucketErr) console.warn("Avatar bucket create:", bucketErr.message);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { upsert: true, contentType: mime });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const baseUrl = urlData?.publicUrl ?? null;
    const avatarUrl = baseUrl ? `${baseUrl}?t=${Date.now()}` : null;

    if (avatarUrl) {
      await supabase.from("profiles").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", userId);
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { session } = await requireAuth();
    const userId = session.user.id;
    const supabase = createAdminClient();

    const exts = ["jpg", "jpeg", "png", "webp"];
    for (const ext of exts) {
      await supabase.storage.from(BUCKET).remove([`${userId}/avatar.${ext}`]);
    }

    await supabase.from("profiles").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
