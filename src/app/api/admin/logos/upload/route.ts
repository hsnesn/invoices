/**
 * Admin: upload logo file and update app_settings.
 * Auto-creates public "logos" bucket if missing. Supports custom filename.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const BUCKET = "logos";
const LOGO_KEYS = ["logo_trt", "logo_trt_world", "logo_email"] as const;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "logo";
  const ext = base.includes(".") ? base.split(".").pop()?.toLowerCase() ?? "png" : "png";
  const safeExt = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? ext : "png";
  const stem = base.replace(/\.[^.]+$/, "") || "logo";
  return `${stem}.${safeExt}`;
}

export async function POST(request: NextRequest) {
  try {
    let adminProfile;
    try {
      adminProfile = await requireAdmin();
    } catch (e) {
      if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") {
        return NextResponse.json(
          { error: "Not authorised. Please refresh the page and log in again." },
          { status: 401 }
        );
      }
      throw e;
    }

    void adminProfile;

    const formData = await request.formData();
    const key = formData.get("key") as string | null;
    const file = formData.get("file") as File | null;
    const customName = (formData.get("filename") as string | null)?.trim();

    if (!key || !LOGO_KEYS.includes(key as (typeof LOGO_KEYS)[number])) {
      return NextResponse.json({ error: "Invalid key. Use logo_trt, logo_trt_world, or logo_email." }, { status: 400 });
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 2MB." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid type. Use PNG, JPEG, GIF, or WebP." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const safeExt = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? ext : "png";
    const ts = Date.now();
    const baseName = customName ? sanitizeFilename(customName).replace(/\.[^.]+$/, "") : key.replace("logo_", "");
    const storagePath = `${baseName}-${ts}.${safeExt}`;

    const supabase = createAdminClient();

    // Ensure logos bucket exists (create if not)
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
      if (bucketErr) {
        return NextResponse.json(
          { error: `Could not create logos bucket: ${bucketErr.message}` },
          { status: 500 }
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 400 });
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData!.path);
    const logoValue = urlData.publicUrl;

    const { error: rpcError } = await supabase.rpc("update_logo_setting", {
      p_key: key,
      p_value: logoValue,
    });

    if (rpcError) {
      return NextResponse.json({ error: `DB update failed: ${rpcError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, value: logoValue });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
