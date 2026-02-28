/**
 * Admin: upload logo file and update app_settings.
 * Uploads to Supabase Storage "logos" bucket (must exist, public).
 * Falls back to storing filename if bucket missing - admin can add file to public/.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

const BUCKET = "logos";
const LOGO_KEYS = ["logo_trt", "logo_trt_world", "logo_email"] as const;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const key = formData.get("key") as string | null;
    const file = formData.get("file") as File | null;

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
    const storagePath = `${key.replace("logo_", "")}-${Date.now()}.${safeExt}`;

    const supabase = createAdminClient();

    // Try upload to storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error: `Upload failed: ${uploadError.message}. Create a public "logos" bucket in Supabase Dashboard (Storage → New bucket → logos, set Public). Or use the path field to enter a filename (e.g. trt-logo.png) if the file is in public/.`,
        },
        { status: 400 }
      );
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData!.path);
    const logoValue = urlData.publicUrl;

    const { error: settingsError } = await supabase
      .from("app_settings")
      .upsert({ key, value: logoValue, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (settingsError) throw settingsError;

    return NextResponse.json({ ok: true, value: logoValue });
  } catch (e) {
    if ((e as { digest?: string })?.digest === "NEXT_REDIRECT") throw e;
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
